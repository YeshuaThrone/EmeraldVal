/**
 * Split-dispute lock — freeze vault payouts and move line-item funds into
 * reserve_balance until the dispute is released.
 */

import type { Store } from "@/lib/server/store";
import type { VaultDisputeRecord } from "@/modules/don/records";
import { postJournal } from "@/modules/ledger/engine";
import { vaultCredit, vaultDebit } from "@/modules/ledger/journal";
import {
  freezeIntoReserve,
  unfreezeFromReserve,
} from "./balances";

export type DisputeLockInput = {
  payee_id: string;
  locked: boolean;
  line_item_id?: string;
  amount_cents?: number;
};

export type DisputeLockSuccess = {
  ok: true;
  dispute: VaultDisputeRecord;
  frozen_cents: number;
};

export type DisputeLockFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

function persistVault(
  store: Store,
  payeeId: string,
  payeeName: string,
  balances: {
    available_balance: number;
    pending_balance: number;
    reserve_balance: number;
  },
  now: Date,
) {
  return store.upsertVault({
    payee_id: payeeId,
    payee_name: payeeName,
    ...balances,
    updated_at: now.toISOString(),
  });
}

function lineItemAmount(store: Store, payeeId: string, lineItemId: string): number {
  return store
    .listLedgerTransactionsByLineItem(lineItemId)
    .filter((row) => row.payee_id === payeeId && row.kind === "royalty")
    .reduce((total, row) => total + row.amount_cents, 0);
}

export function applyDisputeLock(
  store: Store,
  input: DisputeLockInput,
  now: Date = new Date(),
): DisputeLockSuccess | DisputeLockFailure {
  const vault = store.getVault(input.payee_id);
  if (vault === undefined) {
    return {
      ok: false,
      status: 404,
      code: "vault_not_found",
      message: "No sovereign vault exists for that payee.",
    };
  }
  const existing = store.getVaultDispute(input.payee_id);

  if (!input.locked) {
    const frozenAvailable = existing?.frozen_from_available ?? 0;
    const frozenPending = existing?.frozen_from_pending ?? 0;
    if ((existing?.locked ?? 0) === 1 && frozenAvailable + frozenPending > 0) {
      const thawed = unfreezeFromReserve(vault, frozenAvailable, frozenPending);
      if (!thawed.ok) {
        return {
          ok: false,
          status: 422,
          code: thawed.code,
          message: "Reserve balance is insufficient to release the dispute freeze.",
        };
      }
      persistVault(store, vault.payee_id, vault.payee_name, thawed.balances, now);
      postJournal(store, {
        kind: "dispute_unlock",
        ref_type: "vault",
        ref_id: vault.payee_id,
        legs: [
          vaultDebit(vault.payee_id, "reserve", frozenAvailable),
          vaultCredit(vault.payee_id, "available", frozenAvailable),
          vaultDebit(vault.payee_id, "reserve", frozenPending),
          vaultCredit(vault.payee_id, "pending", frozenPending),
        ],
      }, now);
    }
    const dispute = store.upsertVaultDispute({
      payee_id: vault.payee_id,
      locked: 0,
      line_item_id: null,
      frozen_from_available: 0,
      frozen_from_pending: 0,
      updated_at: now.toISOString(),
    });
    return { ok: true, dispute, frozen_cents: 0 };
  }

  if ((existing?.locked ?? 0) === 1) {
    return { ok: true, dispute: existing!, frozen_cents: existing!.frozen_from_available + existing!.frozen_from_pending };
  }

  let amount = input.amount_cents;
  if (input.line_item_id !== undefined) {
    const fromItem = lineItemAmount(store, input.payee_id, input.line_item_id);
    if (fromItem < 1) {
      return {
        ok: false,
        status: 404,
        code: "line_item_not_found",
        message: "No royalty ledger rows match that line_item_id for the payee.",
      };
    }
    amount = amount ?? fromItem;
  }
  if (amount === undefined) {
    amount = vault.available_balance + vault.pending_balance;
  }
  if (amount < 1) {
    const dispute = store.upsertVaultDispute({
      payee_id: vault.payee_id,
      locked: 1,
      line_item_id: input.line_item_id ?? null,
      frozen_from_available: 0,
      frozen_from_pending: 0,
      updated_at: now.toISOString(),
    });
    return { ok: true, dispute, frozen_cents: 0 };
  }

  const frozen = freezeIntoReserve(vault, amount);
  if (!frozen.ok) {
    return {
      ok: false,
      status: 422,
      code: frozen.code,
      message: "available_balance + pending_balance cannot cover the dispute freeze.",
    };
  }
  persistVault(store, vault.payee_id, vault.payee_name, frozen.balances, now);
  postJournal(store, {
    kind: "dispute_lock",
    ref_type: input.line_item_id ? "line_item" : "vault",
    ref_id: input.line_item_id ?? vault.payee_id,
    legs: [
      vaultDebit(vault.payee_id, "available", frozen.frozen_from_available),
      vaultCredit(vault.payee_id, "reserve", frozen.frozen_from_available),
      vaultDebit(vault.payee_id, "pending", frozen.frozen_from_pending),
      vaultCredit(vault.payee_id, "reserve", frozen.frozen_from_pending),
    ],
  }, now);

  const dispute = store.upsertVaultDispute({
    payee_id: vault.payee_id,
    locked: 1,
    line_item_id: input.line_item_id ?? null,
    frozen_from_available: frozen.frozen_from_available,
    frozen_from_pending: frozen.frozen_from_pending,
    updated_at: now.toISOString(),
  });
  return {
    ok: true,
    dispute,
    frozen_cents: frozen.frozen_from_available + frozen.frozen_from_pending,
  };
}

export function isPayoutFrozen(store: Store, payeeId: string): boolean {
  return (store.getVaultDispute(payeeId)?.locked ?? 0) === 1;
}
