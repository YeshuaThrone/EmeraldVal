/**
 * Sovereign Vault FBO sub-ledger — available / pending / reserve balances
 * in integer cents. Pure helpers; persistence lives on the Store.
 */

export type VaultBalances = {
  available_balance: number;
  pending_balance: number;
  reserve_balance: number;
};

export type VaultCreditTarget = "pending" | "available" | "reserve";

export function emptyVaultBalances(): VaultBalances {
  return {
    available_balance: 0,
    pending_balance: 0,
    reserve_balance: 0,
  };
}

export function creditBalances(
  current: VaultBalances,
  amountCents: number,
  target: VaultCreditTarget,
): VaultBalances {
  if (amountCents === 0) {
    return { ...current };
  }
  if (target === "pending") {
    return { ...current, pending_balance: current.pending_balance + amountCents };
  }
  if (target === "available") {
    return {
      ...current,
      available_balance: current.available_balance + amountCents,
    };
  }
  return { ...current, reserve_balance: current.reserve_balance + amountCents };
}

export function releasePending(
  current: VaultBalances,
  amountCents?: number,
): { ok: true; balances: VaultBalances; released_cents: number } | { ok: false; code: "insufficient_pending" } {
  const release =
    amountCents === undefined ? current.pending_balance : amountCents;
  if (release < 0 || release > current.pending_balance) {
    return { ok: false, code: "insufficient_pending" };
  }
  return {
    ok: true,
    released_cents: release,
    balances: {
      ...current,
      pending_balance: current.pending_balance - release,
      available_balance: current.available_balance + release,
    },
  };
}

export function debitAvailable(
  current: VaultBalances,
  amountCents: number,
): { ok: true; balances: VaultBalances } | { ok: false; code: "insufficient_available" } {
  if (amountCents < 1 || amountCents > current.available_balance) {
    return { ok: false, code: "insufficient_available" };
  }
  return {
    ok: true,
    balances: {
      ...current,
      available_balance: current.available_balance - amountCents,
    },
  };
}

export function debitPending(
  current: VaultBalances,
  amountCents: number,
): { ok: true; balances: VaultBalances } | { ok: false; code: "insufficient_pending" } {
  if (amountCents < 1 || amountCents > current.pending_balance) {
    return { ok: false, code: "insufficient_pending" };
  }
  return {
    ok: true,
    balances: {
      ...current,
      pending_balance: current.pending_balance - amountCents,
    },
  };
}

/** available → pending while a BaaS payout is in flight. */
export function holdPayout(
  current: VaultBalances,
  amountCents: number,
): { ok: true; balances: VaultBalances } | { ok: false; code: "insufficient_available" } {
  const debited = debitAvailable(current, amountCents);
  if (!debited.ok) {
    return debited;
  }
  return {
    ok: true,
    balances: creditBalances(debited.balances, amountCents, "pending"),
  };
}

/** pending → available when a submitted payout returns or fails. */
export function reversePayoutHold(
  current: VaultBalances,
  amountCents: number,
): { ok: true; balances: VaultBalances } | { ok: false; code: "insufficient_pending" } {
  const debited = debitPending(current, amountCents);
  if (!debited.ok) {
    return debited;
  }
  return {
    ok: true,
    balances: creditBalances(debited.balances, amountCents, "available"),
  };
}

/**
 * Move `amountCents` into reserve, taking available first then pending.
 * Used by the dispute lock to freeze line-item funds.
 */
export function freezeIntoReserve(
  current: VaultBalances,
  amountCents: number,
):
  | {
      ok: true;
      balances: VaultBalances;
      frozen_from_available: number;
      frozen_from_pending: number;
    }
  | { ok: false; code: "insufficient_funds" } {
  if (amountCents < 1) {
    return { ok: false, code: "insufficient_funds" };
  }
  const total =
    current.available_balance + current.pending_balance;
  if (amountCents > total) {
    return { ok: false, code: "insufficient_funds" };
  }
  const fromAvailable = Math.min(amountCents, current.available_balance);
  const fromPending = amountCents - fromAvailable;
  return {
    ok: true,
    frozen_from_available: fromAvailable,
    frozen_from_pending: fromPending,
    balances: {
      available_balance: current.available_balance - fromAvailable,
      pending_balance: current.pending_balance - fromPending,
      reserve_balance: current.reserve_balance + amountCents,
    },
  };
}

export function unfreezeFromReserve(
  current: VaultBalances,
  fromAvailable: number,
  fromPending: number,
): { ok: true; balances: VaultBalances } | { ok: false; code: "insufficient_reserve" } {
  const total = fromAvailable + fromPending;
  if (total < 0 || total > current.reserve_balance) {
    return { ok: false, code: "insufficient_reserve" };
  }
  return {
    ok: true,
    balances: {
      available_balance: current.available_balance + fromAvailable,
      pending_balance: current.pending_balance + fromPending,
      reserve_balance: current.reserve_balance - total,
    },
  };
}
