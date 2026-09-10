import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { POST } from "./route";

vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/v1/baas/rtp", {
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

describe("POST /api/v1/baas/rtp", () => {
  it("records a sandbox RTP payment as settled immediately", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          amount_cents: 3000,
          currency: "usd",
        }),
      ) as never,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.rail).toBe("rtp");
    expect(body.transfer.status).toBe("settled");
    expect(body.transfer.currency).toBe("USD");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("not-json") as never);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("malformed_body");
  });
});
