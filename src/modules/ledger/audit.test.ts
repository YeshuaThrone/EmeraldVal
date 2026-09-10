import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import { auditLedger, glVaultLiabilityCents } from "./audit";
import { fboDebit, vaultCredit } from "./journal";
import { creditVault } from "@/modules/vaults/engine";

describe("auditLedger", () => {
  it("reports empty books as balanced and reconciled", () => {
    const store = new SqliteStore(":memory:");
    const report = auditLedger(store);
    expect(report.double_entry.balanced).toBe(true);
    expect(report.books_reconcile).toBe(true);
    expect(report.fbo_cash_cents).toBe(0);
  });

  it("reconciles FBO cash to creator vaults plus company dust after a split", async () => {
    const store = new SqliteStore(":memory:");
    const result = await calculateUdrSplits(store, {
      source: "spotify",
      period: "2026-08",
      currency: "USD",
      settle: false,
      rail: "rtp",
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
              share_bps: 7000,
            },
            {
              payee_id: "l1",
              payee_name: "Throne Records",
              role: "label",
              share_bps: 3000,
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    const report = auditLedger(store);
    expect(report.double_entry.balanced).toBe(true);
    expect(report.books_reconcile).toBe(true);
    expect(report.fbo_cash_cents).toBe(10_000);
    expect(report.vault_liability_cents).toBe(10_000);
  });

  it("flags a vault/FBO mismatch and splits company dust", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 50, "available");
    creditVault(store, "platform", "Don Engine Variance", 7, "pending");
    const report = auditLedger(store);
    expect(report.books_reconcile).toBe(false);
    expect(report.creator_vault_cents).toBe(50);
    expect(report.company_dust_cents).toBe(7);
    expect(report.variance_cents).toBe(-57);
  });

  it("flags an unbalanced GL even when vaults are empty", () => {
    const store = new SqliteStore(":memory:");
    const journal = store.insertGlJournal({
      kind: "royalty_ingest",
      ref_type: "x",
      ref_id: "1",
      created_at: new Date().toISOString(),
    });
    store.insertGlEntry({
      journal_id: journal.id,
      account: "fbo_cash",
      debit_cents: 9,
      credit_cents: 0,
      created_at: new Date().toISOString(),
    });
    const report = auditLedger(store);
    expect(report.double_entry.balanced).toBe(false);
    expect(report.fbo_cash_cents).toBe(9);
  });

  it("nets vault liability from GL legs", () => {
    const legs = [fboDebit(25), vaultCredit("c1", "pending", 25)];
    expect(glVaultLiabilityCents(legs)).toBe(25);
    expect(glVaultLiabilityCents([fboDebit(1)])).toBe(0);
  });
});
