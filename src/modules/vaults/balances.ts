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
