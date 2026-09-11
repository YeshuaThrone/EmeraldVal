import { afterEach, describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { ColumnAdapter, setBaasAdapter } from "@/services/baas";
import {
  creditVault,
  payoutFromVault,
  releaseVaultPending,
  reverseVaultPayout,
  settleVaultPayout,
} from "./engine";

afterEach(() => {
  setBaasAdapter(null);
});

describe("creditVault / releaseVaultPending", () => {
  it("credits pending then releases into available", () => {
    const store = new SqliteStore(":memory:");
    const pending = creditVault(store, "c1", "Yeshua Throne", 7000, "pending");
    expect(pending.pending_balance).toBe(7000);
    creditVault(store, "c1", "Yeshua Throne", 50, "reserve");
    expect(store.getVault("c1")?.reserve_balance).toBe(50);
    const released = releaseVaultPending(store, "c1", undefined);
    expect(released.ok).toBe(true);
    if (!released.ok) {
      return;
    }
    expect(released.vault.available_balance).toBe(7000);
    expect(released.vault.pending_balance).toBe(0);
  });

  it("returns vault_not_found for an unknown payee", () => {
    const store = new SqliteStore(":memory:");
    const result = releaseVaultPending(store, "missing", 1);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("vault_not_found");
  });

  it("rejects releasing more than pending", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "pending");
    const result = releaseVaultPending(store, "c1", 50);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("insufficient_pending");
  });

  it("rejects a negative pending release", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "pending");
    const result = releaseVaultPending(store, "c1", -1);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("insufficient_pending");
  });
});

describe("payoutFromVault", () => {
  it("debits available and records a sandbox RTP transfer", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 5000, "available");
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 2000,
      rail: "rtp",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.vault.available_balance).toBe(3000);
    expect(result.vault.pending_balance).toBe(2000);
    expect(result.transfer.rail).toBe("rtp");
    expect(result.transfer.status).toBe("settled");
    expect(store.listBaasTransfers()).toHaveLength(1);
  });

  it("submits ACH from available_balance into a pending payout hold", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 900, "available");
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 900,
      rail: "ach",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.transfer.rail).toBe("ach");
    expect(result.transfer.status).toBe("submitted");
    expect(result.vault.available_balance).toBe(0);
    expect(result.vault.pending_balance).toBe(900);
    expect(store.getPayoutHold(result.transfer.id)?.status).toBe("in_flight");
  });

  it("rejects a payout above available_balance", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 100, "available");
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 200,
      rail: "ach",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("insufficient_available");
  });

  it("returns vault_not_found when payout hits a missing vault", async () => {
    const store = new SqliteStore(":memory:");
    const result = await payoutFromVault(store, {
      payee_id: "ghost",
      amount_cents: 1,
      rail: "rtp",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("vault_not_found");
  });

  it("rolls available back when the BaaS adapter fails", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 1000, "available");
    setBaasAdapter(new ColumnAdapter({ store, mode: "live" }));
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 400,
      rail: "ach",
    });
    expect(result.ok).toBe(false);
    expect(store.getVault("c1")?.available_balance).toBe(1000);
  });

  it("refuses payouts while a dispute lock is active", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 1000, "available");
    store.upsertVaultDispute({
      payee_id: "c1",
      locked: 1,
      line_item_id: null,
      frozen_from_available: 0,
      frozen_from_pending: 0,
      updated_at: new Date().toISOString(),
    });
    const result = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 100,
      rail: "rtp",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("payout_frozen");
  });
});

describe("settleVaultPayout / reverseVaultPayout", () => {
  it("settles an ACH hold and then returns funds after a later return", async () => {
    const store = new SqliteStore(":memory:");
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
    const settled = settleVaultPayout(store, paid.transfer.id);
    expect(settled.ok).toBe(true);
    if (!settled.ok) {
      return;
    }
    expect(settled.vault.pending_balance).toBe(0);
    expect(settled.idempotent).toBe(false);
    const replay = settleVaultPayout(store, paid.transfer.id);
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.idempotent).toBe(true);

    const returned = reverseVaultPayout(store, paid.transfer.id, "payout.returned");
    expect(returned.ok).toBe(true);
    if (!returned.ok) {
      return;
    }
    expect(returned.vault.available_balance).toBe(500);
    expect(returned.reversal.reason).toBe("payout.returned");
    const again = reverseVaultPayout(store, paid.transfer.id, "payout.failed");
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.idempotent).toBe(true);
  });

  it("reverses an in-flight ACH hold back to available", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 400, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 400,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    const failed = reverseVaultPayout(store, paid.transfer.id, "payout.failed");
    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      return;
    }
    expect(failed.vault.available_balance).toBe(400);
    expect(failed.vault.pending_balance).toBe(0);
    expect(store.getLedgerTransaction(failed.reversal.ledger_transaction_id ?? "")?.kind).toBe(
      "payout_failed_reversal",
    );
  });

  it("returns transfer_not_found for unknown transfers", () => {
    const store = new SqliteStore(":memory:");
    expect(settleVaultPayout(store, "missing").ok).toBe(false);
    expect(reverseVaultPayout(store, "missing", "payout.failed").ok).toBe(false);
  });

  it("returns vault_not_found when the payee vault was removed", () => {
    const store = new SqliteStore(":memory:");
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "ghost",
      payee_name: "Gone",
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: null,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    expect(settleVaultPayout(store, transfer.id).ok).toBe(false);
    expect(reverseVaultPayout(store, transfer.id, "payout.failed").ok).toBe(false);
  });

  it("refuses to settle a reversed hold", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 100, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 100,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    reverseVaultPayout(store, paid.transfer.id, "payout.failed");
    const settled = settleVaultPayout(store, paid.transfer.id);
    expect(settled.ok).toBe(false);
    if (settled.ok) {
      return;
    }
    expect(settled.code).toBe("payout_already_reversed");
  });

  it("credits available when reversing a split-direct transfer with no hold", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 0, "available");
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 250,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: null,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const reversed = reverseVaultPayout(store, transfer.id, "payout.failed");
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) {
      return;
    }
    expect(reversed.vault.available_balance).toBe(250);
  });

  it("reverses a linked ledger with null rail metadata", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 0, "available");
    const ledger = store.insertLedgerTransaction({
      split_run_id: "",
      line_item_id: "",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      role: "other",
      share_bps: 0,
      amount_cents: 40,
      currency: "USD",
      status: "submitted",
      rail: null,
      baas_provider: null,
      baas_transfer_id: null,
      created_at: new Date().toISOString(),
      settled_at: null,
    });
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 40,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: ledger.id,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const reversed = reverseVaultPayout(store, transfer.id, "payout.failed");
    expect(reversed.ok).toBe(true);
    expect(store.getLedgerTransaction(ledger.id)?.status).toBe("failed");
    expect(store.getLedgerTransaction(ledger.id)?.rail).toBe("ach");
  });

  it("ignores a stale ledger_transaction_id on reverse", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 0, "available");
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 15,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: "stale",
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const reversed = reverseVaultPayout(store, transfer.id, "payout.returned");
    expect(reversed.ok).toBe(true);
  });

  it("rejects settle when pending cannot cover the hold", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 100, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 100,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    store.upsertVault({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      available_balance: 0,
      pending_balance: 0,
      reserve_balance: 0,
      updated_at: new Date().toISOString(),
    });
    const settled = settleVaultPayout(store, paid.transfer.id);
    expect(settled.ok).toBe(false);
    if (settled.ok) {
      return;
    }
    expect(settled.code).toBe("insufficient_pending");
  });

  it("keeps in-flight payout holds out of a pending release", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 300, "pending");
    creditVault(store, "c1", "Yeshua Throne", 200, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 200,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    const blocked = releaseVaultPending(store, "c1", 400);
    expect(blocked.ok).toBe(false);
    const released = releaseVaultPending(store, "c1", undefined);
    expect(released.ok).toBe(true);
    if (!released.ok) {
      return;
    }
    expect(released.released_cents).toBe(300);
    expect(released.vault.pending_balance).toBe(200);
  });

  it("no-ops a zero pending release when only payout holds remain", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 50, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 50,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    const released = releaseVaultPending(store, "c1", undefined);
    expect(released.ok).toBe(true);
    if (!released.ok) {
      return;
    }
    expect(released.released_cents).toBe(0);
  });

  it("settles a split-direct transfer with no hold", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "available");
    const ledger = store.insertLedgerTransaction({
      split_run_id: "",
      line_item_id: "",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      role: "other",
      share_bps: 0,
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      rail: "ach",
      baas_provider: "column",
      baas_transfer_id: null,
      created_at: new Date().toISOString(),
      settled_at: null,
    });
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: ledger.id,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const settled = settleVaultPayout(store, transfer.id);
    expect(settled.ok).toBe(true);
    if (!settled.ok) {
      return;
    }
    expect(settled.idempotent).toBe(true);
    expect(store.getLedgerTransaction(ledger.id)?.status).toBe("settled");
  });

  it("settles a transfer with no hold and no ledger link", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 1, "available");
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 1,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: null,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const settled = settleVaultPayout(store, transfer.id);
    expect(settled.ok).toBe(true);
    if (!settled.ok) {
      return;
    }
    expect(settled.idempotent).toBe(true);
  });

  it("settles when the linked ledger row is missing or has null rail", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "available");
    const ghost = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: "missing-ledger",
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const ghostSettle = settleVaultPayout(store, ghost.id);
    expect(ghostSettle.ok).toBe(true);

    const ledger = store.insertLedgerTransaction({
      split_run_id: "",
      line_item_id: "",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      role: "other",
      share_bps: 0,
      amount_cents: 5,
      currency: "USD",
      status: "submitted",
      rail: null,
      baas_provider: null,
      baas_transfer_id: null,
      created_at: new Date().toISOString(),
      settled_at: null,
    });
    const transfer = store.insertBaasTransfer({
      provider: "unit",
      rail: "rtp",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 5,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: ledger.id,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const settled = settleVaultPayout(store, transfer.id);
    expect(settled.ok).toBe(true);
    expect(store.getLedgerTransaction(ledger.id)?.rail).toBe("rtp");
    expect(store.getLedgerTransaction(ledger.id)?.baas_provider).toBe("unit");
  });

  it("settles an in-flight hold whose ledger rail is still null", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 20, "pending");
    const ledger = store.insertLedgerTransaction({
      split_run_id: "",
      line_item_id: "",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      role: "other",
      share_bps: 0,
      amount_cents: 20,
      currency: "USD",
      status: "submitted",
      rail: null,
      baas_provider: null,
      baas_transfer_id: null,
      created_at: new Date().toISOString(),
      settled_at: null,
    });
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 20,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: ledger.id,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    store.insertPayoutHold({
      transfer_id: transfer.id,
      payee_id: "c1",
      amount_cents: 20,
      status: "in_flight",
      created_at: new Date().toISOString(),
    });
    const settled = settleVaultPayout(store, transfer.id);
    expect(settled.ok).toBe(true);
    if (!settled.ok) {
      return;
    }
    expect(settled.idempotent).toBe(false);
    expect(store.getLedgerTransaction(ledger.id)?.rail).toBe("ach");
  });

  it("settles an in-flight hold with no ledger, then with a stale ledger id", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 30, "pending");
    const unlabeled = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: null,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    store.insertPayoutHold({
      transfer_id: unlabeled.id,
      payee_id: "c1",
      amount_cents: 10,
      status: "in_flight",
      created_at: new Date().toISOString(),
    });
    expect(settleVaultPayout(store, unlabeled.id).ok).toBe(true);

    creditVault(store, "c1", "Yeshua Throne", 10, "pending");
    const stale = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 10,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: "missing-ledger",
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    store.insertPayoutHold({
      transfer_id: stale.id,
      payee_id: "c1",
      amount_cents: 10,
      status: "in_flight",
      created_at: new Date().toISOString(),
    });
    expect(settleVaultPayout(store, stale.id).ok).toBe(true);
  });

  it("rejects an in-flight reverse when pending was drained", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 80, "available");
    const paid = await payoutFromVault(store, {
      payee_id: "c1",
      amount_cents: 80,
      rail: "ach",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    store.upsertVault({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      available_balance: 0,
      pending_balance: 0,
      reserve_balance: 0,
      updated_at: new Date().toISOString(),
    });
    const reversed = reverseVaultPayout(store, paid.transfer.id, "payout.failed");
    expect(reversed.ok).toBe(false);
    if (reversed.ok) {
      return;
    }
    expect(reversed.code).toBe("insufficient_pending");
  });

  it("rejects a zero-amount reversal journal", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 1, "available");
    const transfer = store.insertBaasTransfer({
      provider: "column",
      rail: "ach",
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      amount_cents: 0,
      currency: "USD",
      status: "submitted",
      ledger_transaction_id: null,
      created_at: new Date().toISOString(),
      estimated_settlement: null,
    });
    const reversed = reverseVaultPayout(store, transfer.id, "payout.failed");
    expect(reversed.ok).toBe(false);
    if (reversed.ok) {
      return;
    }
    expect(reversed.code).toBe("empty_journal");
  });
});
