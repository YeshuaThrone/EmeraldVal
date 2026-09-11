import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import { upsertAdvance } from "@/modules/recoupment/engine";
import { creditVault } from "@/modules/vaults/engine";
import { postJournal } from "./engine";
import { fboCredit, fboDebit, vaultCredit } from "./journal";
import { reverseSplitRun } from "./reversal";

const SPLIT = {
  source: "spotify",
  period: "2026-08",
  currency: "USD",
  settle: false as const,
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

describe("reverseSplitRun", () => {
  it("returns split_run_not_found for an unknown run", () => {
    const store = new SqliteStore(":memory:");
    const result = reverseSplitRun(store, "missing");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("split_run_not_found");
  });

  it("inverts a posted royalty ingest, restores recoupment, and is idempotent", async () => {
    const store = new SqliteStore(":memory:");
    upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 5000,
    });
    const split = await calculateUdrSplits(store, SPLIT);
    expect(split.ok).toBe(true);
    if (!split.ok) {
      return;
    }
    const runId = split.value.split_run.id;
    expect(store.getVault("c1")?.available_balance).toBe(320);
    expect(store.getRecoupmentAdvance("c1")?.recoupment_current_cents).toBe(5000);

    const reversed = reverseSplitRun(store, runId);
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) {
      return;
    }
    expect(reversed.idempotent).toBe(false);
    expect(reversed.split_run.status).toBe("reversed");
    expect(store.getVault("c1")?.available_balance).toBe(0);
    expect(store.getVault("l1")?.pending_balance).toBe(0);
    expect(store.getVault("platform")?.available_balance).toBe(0);
    expect(store.getRecoupmentAdvance("c1")?.recoupment_current_cents).toBe(0);
    expect(store.listLedgerTransactionsByRun(runId).every((row) => row.status === "failed")).toBe(
      true,
    );
    expect(reversed.fbo_cash_reversed).toBe(10_000);

    const replay = reverseSplitRun(store, runId);
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.idempotent).toBe(true);
    expect(store.listGlJournals().filter((row) => row.kind === "royalty_reversal")).toHaveLength(
      1,
    );
  });

  it("rejects a run that is already reversed without a reversal row", () => {
    const store = new SqliteStore(":memory:");
    const run = store.insertSplitRun({
      source: "spotify",
      period: null,
      currency: "USD",
      gross_cents: 1,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: new Date().toISOString(),
      status: "reversed",
    });
    const result = reverseSplitRun(store, run.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("split_already_reversed");
  });

  it("returns journal_not_found when the ingest journal is missing", () => {
    const store = new SqliteStore(":memory:");
    const run = store.insertSplitRun({
      source: "spotify",
      period: null,
      currency: "USD",
      gross_cents: 1,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: new Date().toISOString(),
    });
    const result = reverseSplitRun(store, run.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("journal_not_found");
  });

  it("fails when the credited vault was never opened", () => {
    const store = new SqliteStore(":memory:");
    const run = store.insertSplitRun({
      source: "spotify",
      period: null,
      currency: "USD",
      gross_cents: 10,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: new Date().toISOString(),
    });
    postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: run.id,
      legs: [fboDebit(10), vaultCredit("ghost", "pending", 10)],
    });
    const result = reverseSplitRun(store, run.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("split_reversal_insufficient");
  });

  it("fails when the credited vault cannot cover the reversal debit", async () => {
    const store = new SqliteStore(":memory:");
    const split = await calculateUdrSplits(store, SPLIT);
    expect(split.ok).toBe(true);
    if (!split.ok) {
      return;
    }
    store.upsertVault({
      payee_id: "l1",
      payee_name: "Throne Records",
      available_balance: 0,
      pending_balance: 0,
      reserve_balance: 0,
      updated_at: new Date().toISOString(),
    });
    const result = reverseSplitRun(store, split.value.split_run.id);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("split_reversal_insufficient");
  });

  it("skips non-vault reversal debits such as FBO cash", () => {
    const store = new SqliteStore(":memory:");
    const run = store.insertSplitRun({
      source: "spotify",
      period: null,
      currency: "USD",
      gross_cents: 10,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: new Date().toISOString(),
    });
    creditVault(store, "c1", "Yeshua Throne", 5, "pending");
    postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: run.id,
      legs: [fboDebit(10), vaultCredit("c1", "pending", 5), fboCredit(5)],
    });
    const reversed = reverseSplitRun(store, run.id);
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) {
      return;
    }
    expect(store.getVault("c1")?.pending_balance).toBe(0);
    expect(reversed.fbo_cash_reversed).toBe(10);
  });

  it("skips recoupment unwind when the advance row is gone and posts an unbalanced ingest as 500", () => {
    const store = new SqliteStore(":memory:");
    const run = store.insertSplitRun({
      source: "spotify",
      period: null,
      currency: "USD",
      gross_cents: 10,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: new Date().toISOString(),
    });
    creditVault(store, "c1", "Yeshua Throne", 10, "pending");
    postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: run.id,
      legs: [fboDebit(10), vaultCredit("c1", "pending", 10)],
    });
    store.insertRecoupmentLedger({
      creator_id: "c1",
      split_run_id: run.id,
      incoming_cents: 10,
      recouped_cents: 4,
      excess_cents: 6,
      recoupment_current_cents: 4,
      created_at: new Date().toISOString(),
    });
    const reversed = reverseSplitRun(store, run.id);
    expect(reversed.ok).toBe(true);

    const broken = store.insertSplitRun({
      source: "spotify",
      period: null,
      currency: "USD",
      gross_cents: 9,
      line_item_count: 1,
      variance_account_cents: 0,
      created_at: new Date().toISOString(),
    });
    const journal = store.insertGlJournal({
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: broken.id,
      created_at: new Date().toISOString(),
    });
    store.insertGlEntry({
      journal_id: journal.id,
      account: "fbo_cash",
      debit_cents: 9,
      credit_cents: 0,
      created_at: new Date().toISOString(),
    });
    const failed = reverseSplitRun(store, broken.id);
    expect(failed.ok).toBe(false);
    if (failed.ok) {
      return;
    }
    expect(failed.status).toBe(500);
    expect(failed.code).toBe("unbalanced_journal");
  });
});
