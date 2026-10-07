import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { creditVault, payoutFromVault } from "@/modules/vaults/engine";
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

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/webhooks/baas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/v1/webhooks/baas", () => {
  it("settles an in-flight ACH payout", async () => {
    const store = mockedGetStore();
    creditVault(store, "c1", "Yeshua Throne", 500, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 500,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    const response = await POST(
      post({ event: "payout.settled", transfer_id: paid.transfer.id }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.vault.pending_balance).toBe(0);
  });

  it("returns 404 for an unknown transfer", async () => {
    const response = await POST(
      post({ event: "payout.failed", transfer_id: "missing" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed JSON and 422 for a bad event", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect(
      (await POST(post({ event: "payout.unknown", transfer_id: "x" }))).status,
    ).toBe(422);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      getBaasTransfer: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      post({ event: "payout.settled", transfer_id: "x" }),
    );
    expect(response.status).toBe(500);
  });
});
