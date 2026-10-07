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

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/v1/baas/ach", {
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

describe("POST /api/v1/baas/ach", () => {
  it("records a sandbox ACH transfer as submitted", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          amount_cents: 7000,
        }),
      ) as never,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.mode).toBe("sandbox");
    expect(body.rail).toBe("ach");
    expect(body.transfer.status).toBe("submitted");
    expect(body.transfer.provider).toBe("column");
    expect(mockedGetStore().listBaasTransfers()).toHaveLength(1);
  });

  it("honors an explicit unit provider", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          amount_cents: 100,
          provider: "unit",
        }),
      ) as never,
    );
    expect((await response.json()).provider).toBe("unit");
  });

  it("returns 422 for a missing payee", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ amount_cents: 100 })) as never,
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("invalid_payee");
  });

  it("returns 500 when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      insertBaasTransfer: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      postRequest(
        JSON.stringify({
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          amount_cents: 100,
        }),
      ) as never,
    );
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("store_failure");
  });
});
