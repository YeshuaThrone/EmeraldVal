/**
 * System-wide GL audit: double-entry invariant, FBO vs vault
 * reconciliation, and the immutable hash chain.
 */

import type { Store } from "@/lib/server/store";
import {
  COMPANY_VARIANCE_PAYEE_ID,
  GL_ACCOUNT_FBO_CASH,
} from "@/modules/don/constants";
import { verifyHashChain, type ChainVerification } from "./chain";
import {
  expandDebitCreditPairs,
  isVaultAccount,
  journalIsBalanced,
  netDebit,
  sumCredits,
  sumDebits,
  type DebitCreditPair,
  type GlLeg,
} from "./journal";

export type VaultSheetRow = {
  payee_id: string;
  payee_name: string;
  available_balance: number;
  pending_balance: number;
  reserve_balance: number;
  total_cents: number;
  is_company_dust: boolean;
};

export type LedgerAuditReport = {
  double_entry: {
    debit_cents: number;
    credit_cents: number;
    balanced: boolean;
    pair_count: number;
    pairs: DebitCreditPair[];
  };
  immutable: ChainVerification;
  fbo_cash_cents: number;
  vaults: VaultSheetRow[];
  creator_vault_cents: number;
  company_dust_cents: number;
  vault_liability_cents: number;
  books_reconcile: boolean;
  variance_cents: number;
};

function toLegs(
  entries: ReadonlyArray<{
    account: string;
    debit_cents: number;
    credit_cents: number;
  }>,
): GlLeg[] {
  return entries.map((entry) => ({
    account: entry.account,
    debit_cents: entry.debit_cents,
    credit_cents: entry.credit_cents,
  }));
}

export function auditLedger(store: Store): LedgerAuditReport {
  const entries = store.listGlEntries();
  const legs = toLegs(entries);
  const debitCents = sumDebits(legs);
  const creditCents = sumCredits(legs);
  const pairs = expandDebitCreditPairs(legs);
  const fboCashCents = netDebit(legs, GL_ACCOUNT_FBO_CASH);

  const journals = store.listGlJournals();
  const legsByJournal = new Map<string, GlLeg[]>();
  for (const journal of journals) {
    legsByJournal.set(
      journal.id,
      toLegs(store.listGlEntriesByJournal(journal.id)),
    );
  }

  const vaults: VaultSheetRow[] = store.listVaults().map((vault) => {
    const total =
      vault.available_balance + vault.pending_balance + vault.reserve_balance;
    return {
      payee_id: vault.payee_id,
      payee_name: vault.payee_name,
      available_balance: vault.available_balance,
      pending_balance: vault.pending_balance,
      reserve_balance: vault.reserve_balance,
      total_cents: total,
      is_company_dust: vault.payee_id === COMPANY_VARIANCE_PAYEE_ID,
    };
  });

  let creatorVaultCents = 0;
  let companyDustCents = 0;
  for (const row of vaults) {
    if (row.is_company_dust) {
      companyDustCents += row.total_cents;
    } else {
      creatorVaultCents += row.total_cents;
    }
  }
  const vaultLiabilityCents = creatorVaultCents + companyDustCents;
  const varianceCents = fboCashCents - vaultLiabilityCents;

  return {
    double_entry: {
      debit_cents: debitCents,
      credit_cents: creditCents,
      balanced: journalIsBalanced(legs),
      pair_count: pairs.length,
      pairs,
    },
    immutable: verifyHashChain(journals, legsByJournal),
    fbo_cash_cents: fboCashCents,
    vaults,
    creator_vault_cents: creatorVaultCents,
    company_dust_cents: companyDustCents,
    vault_liability_cents: vaultLiabilityCents,
    books_reconcile: varianceCents === 0,
    variance_cents: varianceCents,
  };
}

export function glVaultLiabilityCents(
  legs: readonly GlLeg[],
): number {
  return legs.reduce((total, leg) => {
    if (!isVaultAccount(leg.account)) {
      return total;
    }
    return total + leg.credit_cents - leg.debit_cents;
  }, 0);
}

export type ImmutableJournalLogEntry = {
  id: string;
  sequence: number;
  kind: string;
  ref_type: string;
  ref_id: string;
  created_at: string;
  prev_hash: string;
  entry_hash: string;
  state: "posted";
  debit_account_pairs: DebitCreditPair[];
  legs: GlLeg[];
};

export type ImmutableLedgerLog = {
  journals: ImmutableJournalLogEntry[];
  immutable: ChainVerification;
  double_entry: LedgerAuditReport["double_entry"];
  books_reconcile: boolean;
};

export function immutableLedgerLog(store: Store): ImmutableLedgerLog {
  const report = auditLedger(store);
  const journals: ImmutableJournalLogEntry[] = store.listGlJournals().map((journal) => {
    const legs = toLegs(store.listGlEntriesByJournal(journal.id));
    return {
      id: journal.id,
      sequence: journal.sequence,
      kind: journal.kind,
      ref_type: journal.ref_type,
      ref_id: journal.ref_id,
      created_at: journal.created_at,
      prev_hash: journal.prev_hash,
      entry_hash: journal.entry_hash,
      state: journal.state,
      debit_account_pairs: expandDebitCreditPairs(legs),
      legs,
    };
  });
  return {
    journals,
    immutable: report.immutable,
    double_entry: report.double_entry,
    books_reconcile: report.books_reconcile,
  };
}
