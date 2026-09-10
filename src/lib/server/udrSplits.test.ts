import { describe, expect, it } from "vitest";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import { SqliteStore } from "@/lib/server/store";
import { setBaasAdapter } from "@/services/baas";

const INPUT = {
  source: "spotify",
  period: "2026-08",
  currency: "USD",
  settle: false,
  rail: "rtp" as const,
  line_items: [
    {
      work_id: "trk_01",
      work_title: "Midnight On 6th",
      amount_cents: 10_000,
      splits: [
        {
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          role: "creator" as const,
          share_bps: 7000,
        },
        {
          payee_id: "l1",
          payee_name: "Throne Records",
          role: "label" as const,
          share_bps: 3000,
        },
      ],
    },
  ],
};

describe("calculateUdrSplits", () => {
  it("writes a run, line item, and pending ledger rows", async () => {
    const store = new SqliteStore(":memory:");
    const result = await calculateUdrSplits(store, INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.split_run.gross_cents).toBe(10_000);
    expect(result.value.ledger.map((row) => row.amount_cents)).toEqual([
      7000, 3000,
    ]);
    expect(result.value.ledger.every((row) => row.status === "pending_settlement")).toBe(
      true,
    );
    expect(result.value.settlement).toBeNull();
    expect(store.listLedgerTransactionsByRun(result.value.split_run.id)).toHaveLength(
      2,
    );
  });

  it("settles every ledger row through sandbox RTP when settle is true", async () => {
    setBaasAdapter(null);
    const store = new SqliteStore(":memory:");
    const result = await calculateUdrSplits(store, { ...INPUT, settle: true });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.settlement?.rail).toBe("rtp");
    expect(result.value.settlement?.transfers).toHaveLength(2);
    expect(result.value.ledger.every((row) => row.status === "settled")).toBe(
      true,
    );
    expect(store.listBaasTransfers()).toHaveLength(2);
  });
});
