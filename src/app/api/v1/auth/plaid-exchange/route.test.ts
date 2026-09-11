import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { createSandboxLinkToken } from "@/lib/server/plaid";
import { isEncryptedAccessToken } from "@/modules/plaid/crypto";
import { POST } from "./route";

vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  resetRateLimits();
});

describe("POST /api/v1/auth/plaid-exchange", () => {
  it("returns an encrypted access_token and processor token", async () => {
    const minted = createSandboxLinkToken(mockedGetStore(), {
      action: "create_link_token",
      creator_id: "creator-1",
      products: ["auth", "identity"],
    });
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/auth/plaid-exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creator_id: "creator-1",
          public_token: minted.value.public_token,
          processor: "unit",
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(isEncryptedAccessToken(body.access_token)).toBe(true);
    expect(body.processor_token).toMatch(/^processor-sandbox-unit-/);
  });

  it("returns 422 for an unknown public_token", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/auth/plaid-exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creator_id: "c1",
          public_token: "public-sandbox-nope",
        }),
      }),
    );
    expect(response.status).toBe(422);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/auth/plaid-exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{{{",
      }),
    );
    expect(response.status).toBe(400);
  });
});
