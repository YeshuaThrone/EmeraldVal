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

export function parseVaultAccount(
  account: string,
): { payeeId: string; bucket: VaultBucket } | null {
  const match = /^vault:([^:]+):(available|pending|reserve)$/.exec(account);
  if (match === null) {
    return null;
  }
  return {
    payeeId: match[1]!,
    bucket: match[2] as VaultBucket,
  };
}

export function invertLegs(legs: readonly GlLeg[]): GlLeg[] {
  return legs.map((leg) => ({
    account: leg.account,
    debit_cents: leg.credit_cents,
    credit_cents: leg.debit_cents,
  }));
}

export type DebitCreditPair = {
  debit_account: string;
  credit_account: string;
  amount_cents: number;
};

/**
 * Expand a balanced multi-leg journal into explicit debit/credit pairs
 * (one FBO debit may fund many vault credits).
 */
export function expandDebitCreditPairs(
  legs: readonly GlLeg[],
): DebitCreditPair[] {
  const debits = compactLegs(legs)
    .filter((leg) => leg.debit_cents > 0)
    .map((leg) => ({ account: leg.account, remaining: leg.debit_cents }));
  const credits = compactLegs(legs)
    .filter((leg) => leg.credit_cents > 0)
    .map((leg) => ({ account: leg.account, remaining: leg.credit_cents }));
  const pairs: DebitCreditPair[] = [];
  let di = 0;
  let ci = 0;
  while (di < debits.length && ci < credits.length) {
    const debit = debits[di]!;
    const credit = credits[ci]!;
    const amount = Math.min(debit.remaining, credit.remaining);
    pairs.push({
      debit_account: debit.account,
      credit_account: credit.account,
      amount_cents: amount,
    });
    debit.remaining -= amount;
    credit.remaining -= amount;
    if (debit.remaining === 0) {
      di += 1;
    }
    if (credit.remaining === 0) {
      ci += 1;
    }
  }
  return pairs;
}
