import { afterEach, describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import {
  ColumnAdapter,
  UnitAdapter,
  getBaasAdapter,
  setBaasAdapter,
  settleLedgerThroughBaas,
} from "@/services/baas";

afterEach(() => {
  setBaasAdapter(null);
  delete process.env.BAAS_MODE;
  delete process.env.BAAS_PROVIDER;
  delete process.env.COLUMN_API_KEY;
});

function seedLedger(store: SqliteStore) {
  const run = store.insertSplitRun({
    source: "spotify",
    period: null,
    currency: "USD",
    gross_cents: 7000,
    line_item_count: 1,
    created_at: "2026-09-10T15:00:00.000Z",
  });
  const item = store.insertRoyaltyLineItem({
    split_run_id: run.id,
    work_id: "trk_01",
    work_title: "Midnight On 6th",
    amount_cents: 7000,
    splits_json: "[]",
    created_at: run.created_at,
  });
  return store.insertLedgerTransaction({
    split_run_id: run.id,
    line_item_id: item.id,
    payee_id: "c1",
    payee_name: "Yeshua Throne",
    role: "creator",
    share_bps: 10_000,
    amount_cents: 7000,
    currency: "USD",
    status: "pending_settlement",
    rail: null,
    baas_provider: null,
    baas_transfer_id: null,
    created_at: run.created_at,
    settled_at: null,
  });
}

describe("ColumnAdapter sandbox", () => {
  it("submits ACH as submitted with a T+3 estimate", async () => {
    const store = new SqliteStore(":memory:");
    const adapter = new ColumnAdapter({ store, mode: "sandbox" });
    const result = await adapter.createAchTransfer({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 7000,
      currency: "USD",
      ledger_transaction_id: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.transfer.provider).toBe("column");
    expect(result.transfer.rail).toBe("ach");
    expect(result.transfer.status).toBe("submitted");
    expect(result.transfer.estimated_settlement).toBeTruthy();
  });

  it("settles RTP immediately", async () => {
    const store = new SqliteStore(":memory:");
    const adapter = new UnitAdapter({ store, mode: "sandbox" });
    const result = await adapter.createRtpPayment({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 2500,
      currency: "USD",
      ledger_transaction_id: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.transfer.provider).toBe("unit");
    expect(result.transfer.status).toBe("settled");
  });
});

describe("live gating", () => {
  it("returns baas_not_configured without a live key", async () => {
    const store = new SqliteStore(":memory:");
    const adapter = new ColumnAdapter({ store, mode: "live" });
    const result = await adapter.createAchTransfer({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 100,
      currency: "USD",
      ledger_transaction_id: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("baas_not_configured");
    expect(result.status).toBe(503);
  });

  it("returns baas_live_not_implemented when a live key is present", async () => {
    process.env.COLUMN_API_KEY = "col_live_test";
    const store = new SqliteStore(":memory:");
    const adapter = new ColumnAdapter({ store, mode: "live" });
    const result = await adapter.createRtpPayment({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 100,
      currency: "USD",
      ledger_transaction_id: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("baas_live_not_implemented");
    expect(result.status).toBe(501);
  });
});

describe("settleLedgerThroughBaas", () => {
  it("marks a ledger row settled on sandbox RTP", async () => {
    const store = new SqliteStore(":memory:");
    const ledger = seedLedger(store);
    const adapter = getBaasAdapter(store);
    const result = await settleLedgerThroughBaas(
      store,
      adapter,
      ledger.id,
      "rtp",
    );
    expect(result.ok).toBe(true);
    const updated = store.getLedgerTransaction(ledger.id);
    expect(updated?.status).toBe("settled");
    expect(updated?.rail).toBe("rtp");
    expect(updated?.baas_provider).toBe("column");
    expect(updated?.baas_transfer_id).toBeTruthy();
  });

  it("returns ledger_not_found for a missing id", async () => {
    const store = new SqliteStore(":memory:");
    const result = await settleLedgerThroughBaas(
      store,
      getBaasAdapter(store),
      "missing",
      "ach",
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("ledger_not_found");
  });
});
