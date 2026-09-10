/**
 * Pure double-entry helpers. A journal is balanced iff
 * sum(debit_cents) === sum(credit_cents). Persistence lives on the Store.
 */

import {
  GL_ACCOUNT_FBO_CASH,
  vaultGlAccount,
  type JournalKind,
  type VaultBucket,
} from "@/modules/don/constants";

export type GlLeg = {
  account: string;
  debit_cents: number;
  credit_cents: number;
};

export type JournalDraft = {
  kind: JournalKind;
  ref_type: string;
  ref_id: string;
  legs: GlLeg[];
};

export function debit(account: string, cents: number): GlLeg {
  return { account, debit_cents: cents, credit_cents: 0 };
}

export function credit(account: string, cents: number): GlLeg {
  return { account, debit_cents: 0, credit_cents: cents };
}

export function fboDebit(cents: number): GlLeg {
  return debit(GL_ACCOUNT_FBO_CASH, cents);
}

export function fboCredit(cents: number): GlLeg {
  return credit(GL_ACCOUNT_FBO_CASH, cents);
}

export function vaultDebit(
  payeeId: string,
  bucket: VaultBucket,
  cents: number,
): GlLeg {
  return debit(vaultGlAccount(payeeId, bucket), cents);
}

export function vaultCredit(
  payeeId: string,
  bucket: VaultBucket,
  cents: number,
): GlLeg {
  return credit(vaultGlAccount(payeeId, bucket), cents);
}

export function sumDebits(legs: readonly GlLeg[]): number {
  return legs.reduce((total, leg) => total + leg.debit_cents, 0);
}

export function sumCredits(legs: readonly GlLeg[]): number {
  return legs.reduce((total, leg) => total + leg.credit_cents, 0);
}

export function journalIsBalanced(legs: readonly GlLeg[]): boolean {
  return sumDebits(legs) === sumCredits(legs);
}

export function compactLegs(legs: readonly GlLeg[]): GlLeg[] {
  return legs.filter((leg) => leg.debit_cents !== 0 || leg.credit_cents !== 0);
}

export function validateJournal(
  legs: readonly GlLeg[],
):
  | { ok: true; legs: GlLeg[] }
  | { ok: false; code: "unbalanced_journal" | "empty_journal" } {
  const compact = compactLegs(legs);
  if (compact.length === 0) {
    return { ok: false, code: "empty_journal" };
  }
  for (const leg of compact) {
    if (leg.debit_cents < 0 || leg.credit_cents < 0) {
      return { ok: false, code: "unbalanced_journal" };
    }
    if (leg.debit_cents > 0 && leg.credit_cents > 0) {
      return { ok: false, code: "unbalanced_journal" };
    }
  }
  if (!journalIsBalanced(compact)) {
    return { ok: false, code: "unbalanced_journal" };
  }
  return { ok: true, legs: compact };
}

export function netDebit(legs: readonly GlLeg[], account: string): number {
  return legs.reduce((total, leg) => {
    if (leg.account !== account) {
      return total;
    }
    return total + leg.debit_cents - leg.credit_cents;
  }, 0);
}

export function isVaultAccount(account: string): boolean {
  return account.startsWith("vault:");
}
