import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { POST } from "./route";

vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

const IDENTITY = {
  legal_name: "Yeshua Throne",
  date_of_birth: "1990-01-15",
  email: "yeshua@example.com",
};

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/v1/auth/plaid-kyc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  resetRateLimits();
});

describe("POST /api/v1/auth/plaid-kyc", () => {
  it("mints a sandbox Link token", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          action: "create_link_token",
          creator_id: "creator-1",
        }),
      ) as never,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.mode).toBe("sandbox");
    expect(body.link_token).toMatch(/^link-sandbox-/);
    expect(body.public_token).toMatch(/^public-sandbox-/);
    expect(body.products).toEqual(["auth", "identity"]);
  });

  it("verifies an identity payload and persists KYC", async () => {
    const minted = await POST(
      postRequest(
        JSON.stringify({
          action: "create_link_token",
          creator_id: "creator-1",
        }),
      ) as never,
    );
    const session = await minted.json();
    const response = await POST(
      postRequest(
        JSON.stringify({
          action: "verify_identity",
          creator_id: "creator-1",
          public_token: session.public_token,
          identity: IDENTITY,
        }),
      ) as never,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kyc.status).toBe("verified");
    expect(mockedGetStore().listKycVerificationsByCreator("creator-1")).toHaveLength(
      1,
    );
  });

  it("returns 422 for an unknown public_token", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          action: "verify_identity",
          creator_id: "creator-1",
          public_token: "public-sandbox-unknown",
          identity: IDENTITY,
        }),
      ) as never,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("unknown_plaid_token");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("{not json") as never);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("malformed_body");
  });

  it("returns 422 for a missing action", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ creator_id: "c1" })) as never,
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("invalid_action");
  });

  it("returns 500 when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      insertPlaidLinkToken: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      postRequest(
        JSON.stringify({
          action: "create_link_token",
          creator_id: "creator-1",
        }),
      ) as never,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to process Plaid KYC.",
      code: "store_failure",
    });
  });
});
