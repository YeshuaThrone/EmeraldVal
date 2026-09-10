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
  return new NextRequest("http://localhost:3000/api/v1/webhooks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/v1/webhooks", () => {
  it("dispatches a BaaS payout settlement", async () => {
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
  });

  it("dispatches a DSP royalty report", async () => {
    const response = await POST(
      post({
        event: "royalty.report",
        source: "spotify",
        line_items: [
          {
            work_id: "trk_01",
            work_title: "Midnight",
            amount_cents: 100,
            splits: [
              {
                payee_id: "c1",
                payee_name: "Yeshua Throne",
                role: "creator",
                share_percent: 100,
              },
            ],
          },
        ],
      }),
    );
    expect(response.status).toBe(201);
  });

  it("returns 400/422 for bad payloads and 404 for unknown transfers", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect((await POST(post({ event: "nope" }))).status).toBe(422);
    expect(
      (await POST(post({ event: "payout.failed", transfer_id: "missing" }))).status,
    ).toBe(404);
    expect(
      (await POST(post({ event: "royalty.reversed", split_run_id: "missing" }))).status,
    ).toBe(404);
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

  it("returns 500 when DSP ingest throws", async () => {
    mockedGetStore.mockReturnValue({
      getDspWebhookEvent: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      post({
        event: "royalty.report",
        source: "spotify",
        line_items: [
          {
            work_id: "trk_01",
            work_title: "Midnight",
            amount_cents: 100,
            splits: [
              {
                payee_id: "c1",
                payee_name: "Yeshua Throne",
                role: "creator",
                share_percent: 100,
              },
            ],
          },
        ],
      }),
    );
    expect(response.status).toBe(500);
  });
});
