/**
 * Split-run reversal ledger — invert the original royalty_ingest journal,
 * debit vault buckets that were credited, restore recoupment current, and
 * mark the run reversed. Append-only: the original journal stays posted.
 */

import type { Store } from "@/lib/server/store";
import { GL_ACCOUNT_FBO_CASH } from "@/modules/don/constants";
import { postJournal } from "./engine";
import { invertLegs, parseVaultAccount } from "./journal";
import { canTransitionSplit } from "./machine";
import { debitTarget } from "@/modules/vaults/balances";

export function reverseSplitRun(
  store: Store,
  splitRunId: string,
  now: Date = new Date(),
) {
  const run = store.getSplitRun(splitRunId);
  if (run === undefined) {
    return {
      ok: false as const,
      status: 404,
      code: "split_run_not_found",
      message: "No split run matches that id.",
    };
  }
  const existing = store.getSplitReversalByRun(splitRunId);
  if (existing !== undefined) {
    return {
      ok: true as const,
      idempotent: true,
      split_run: run,
      reversal: existing,
    };
  }
  if (!canTransitionSplit(run.status, "reversed")) {
    return {
      ok: false as const,
      status: 409,
      code: "split_already_reversed",
      message: "That split run is not in a reversible state.",
    };
  }

  const journals = store.listGlJournalsByRef("split_run", splitRunId);
  const original = journals.find((row) => row.kind === "royalty_ingest");
  if (original === undefined) {
    return {
      ok: false as const,
      status: 404,
      code: "journal_not_found",
      message: "No royalty_ingest journal exists for that split run.",
    };
  }
  const originalLegs = store.listGlEntriesByJournal(original.id);
  const inverted = invertLegs(originalLegs);

  for (const leg of inverted) {
    if (leg.debit_cents < 1) {
      continue;
    }
    const vaultAccount = parseVaultAccount(leg.account);
    if (vaultAccount === null) {
      continue;
    }
    const vault = store.getVault(vaultAccount.payeeId);
    if (vault === undefined) {
      return {
        ok: false as const,
        status: 422,
        code: "split_reversal_insufficient",
        message: `Cannot reverse ${vaultAccount.bucket} for ${vaultAccount.payeeId}.`,
      };
    }
    const debited = debitTarget(vault, leg.debit_cents, vaultAccount.bucket);
    if (!debited.ok) {
      return {
        ok: false as const,
        status: 422,
        code: "split_reversal_insufficient",
        message: `Cannot reverse ${vaultAccount.bucket} for ${vaultAccount.payeeId}.`,
      };
    }
    store.upsertVault({
      payee_id: vault.payee_id,
      payee_name: vault.payee_name,
      ...debited.balances,
      updated_at: now.toISOString(),
    });
  }

  for (const row of store.listRecoupmentLedgerByRun(splitRunId)) {
    const advance = store.getRecoupmentAdvance(row.creator_id);
    if (advance === undefined) {
      continue;
    }
    store.upsertRecoupmentAdvance({
      ...advance,
      recoupment_current_cents: Math.max(
        0,
        advance.recoupment_current_cents - row.recouped_cents,
      ),
      updated_at: now.toISOString(),
    });
  }

  for (const row of store.listLedgerTransactionsByRun(splitRunId)) {
    store.updateLedgerSettlement(row.id, {
      status: "failed",
      rail: row.rail,
      baas_provider: row.baas_provider,
      baas_transfer_id: row.baas_transfer_id,
      settled_at: null,
    });
  }

  const posted = postJournal(
    store,
    {
      kind: "royalty_reversal",
      ref_type: "split_run",
      ref_id: splitRunId,
      legs: inverted,
    },
    now,
  );
  if (!posted.ok) {
    return {
      ok: false as const,
      status: 500,
      code: posted.code,
      message: posted.message,
    };
  }

  store.updateSplitRunStatus(splitRunId, "reversed");
  const reversal = store.insertSplitReversal({
    split_run_id: splitRunId,
    journal_id: posted.journal.id,
    created_at: now.toISOString(),
  });
  return {
    ok: true as const,
    idempotent: false,
    split_run: { ...run, status: "reversed" as const },
    reversal,
    journal: posted.journal,
    fbo_cash_reversed: inverted
      .filter((leg) => leg.account === GL_ACCOUNT_FBO_CASH)
      .reduce((total, leg) => total + leg.credit_cents, 0),
  };
}
