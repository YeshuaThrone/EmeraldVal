import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { setBaasAdapter } from "@/services/baas";
import { POST } from "./route";

vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

const BODY = {
  source: "spotify",
  period: "2026-08",
  line_items: [
    {
      work_id: "trk_01",
      work_title: "Midnight On 6th",
      amount_cents: 10_000,
      splits: [
        {
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          role: "creator",
          share_percent: 70,
        },
        {
          payee_id: "l1",
          payee_name: "Throne Records",
          role: "label",
          share_percent: 30,
        },
      ],
    },
  ],
};

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/v1/splits/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  setBaasAdapter(null);
  resetRateLimits();
});

describe("POST /api/v1/splits/calculate", () => {
  it("allocates 70/30 and writes pending ledger rows", async () => {
    const response = await POST(postRequest(JSON.stringify(BODY)) as never);
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.split_run.gross_cents).toBe(10_000);
    expect(payload.ledger.map((row: { amount_cents: number }) => row.amount_cents)).toEqual(
      [7000, 3000],
    );
    expect(payload.settlement).toBeNull();
    expect(
      mockedGetStore().listLedgerTransactionsByRun(payload.split_run.id),
    ).toHaveLength(2);
  });

  it("sweeps three-way dust into the company variance account", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          source: "spotify",
          line_items: [
            {
              work_id: "trk_thirds",
              work_title: "Thirds",
              amount_cents: 1000,
              splits: [
                { payee_id: "a", payee_name: "A", role: "creator", share_bps: 3333 },
                { payee_id: "b", payee_name: "B", role: "creator", share_bps: 3333 },
                { payee_id: "c", payee_name: "C", role: "label", share_bps: 3334 },
              ],
            },
          ],
        }),
      ) as never,
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.variance_account_cents).toBe(1);
    expect(payload.zero_balance).toBe(true);
    expect(
      payload.ledger.reduce(
        (sum: number, row: { amount_cents: number }) => sum + row.amount_cents,
        0,
      ) + payload.variance_account_cents,
    ).toBe(1000);
  });

  it("settles through sandbox RTP when settle is true", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...BODY, settle: true, rail: "rtp" })) as never,
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.settlement.rail).toBe("rtp");
    expect(payload.ledger.every((row: { status: string }) => row.status === "settled")).toBe(
      true,
    );
  });

  it("returns 422 when shares do not sum to 100%", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({
          ...BODY,
          line_items: [
            {
              ...BODY.line_items[0],
              splits: [
                { ...BODY.line_items[0].splits[0], share_percent: 50 },
                { ...BODY.line_items[0].splits[1], share_percent: 30 },
              ],
            },
          ],
        }),
      ) as never,
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("splits_do_not_balance");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("[[[") as never);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("malformed_body");
  });

  it("returns 500 when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      insertSplitRun: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(postRequest(JSON.stringify(BODY)) as never);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to calculate and persist UDR splits.",
      code: "store_failure",
    });
  });
});
