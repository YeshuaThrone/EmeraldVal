/**
 * Sovereign vault engine — FBO credits, pending release, BaaS payout
 * from available_balance.
 */

import type { Store } from "@/lib/server/store";
import type { SettlementRail } from "@/lib/don/types";
import {
  getBaasAdapter,
  type BaasTransferResult,
} from "@/services/baas";
import {
  creditBalances,
  debitAvailable,
  emptyVaultBalances,
  releasePending,
  type VaultCreditTarget,
} from "./balances";
import type { SovereignVaultRecord } from "@/modules/don/records";

export function creditVault(
  store: Store,
  payeeId: string,
  payeeName: string,
  amountCents: number,
  target: VaultCreditTarget,
  now: Date = new Date(),
): SovereignVaultRecord {
  const current = store.getVault(payeeId);
  const balances = creditBalances(
    current ?? emptyVaultBalances(),
    amountCents,
    target,
  );
  return store.upsertVault({
    payee_id: payeeId,
    payee_name: payeeName,
    ...balances,
    updated_at: now.toISOString(),
  });
}

export function releaseVaultPending(
  store: Store,
  payeeId: string,
  amountCents: number | undefined,
  now: Date = new Date(),
):
  | { ok: true; vault: SovereignVaultRecord; released_cents: number }
  | { ok: false; status: number; code: string; message: string } {
  const current = store.getVault(payeeId);
  if (current === undefined) {
    return {
      ok: false,
      status: 404,
      code: "vault_not_found",
      message: "No sovereign vault exists for that payee.",
    };
  }
  const released = releasePending(current, amountCents);
  if (!released.ok) {
    return {
      ok: false,
      status: 422,
      code: released.code,
      message: "Pending balance is insufficient for that release.",
    };
  }
  const vault = store.upsertVault({
    payee_id: current.payee_id,
    payee_name: current.payee_name,
    ...released.balances,
    updated_at: now.toISOString(),
  });
  return { ok: true, vault, released_cents: released.released_cents };
}

export type VaultPayoutInput = {
  payee_id: string;
  amount_cents: number;
  rail: SettlementRail;
};

export async function payoutFromVault(
  store: Store,
  input: VaultPayoutInput,
  now: Date = new Date(),
): Promise<
  | {
      ok: true;
      vault: SovereignVaultRecord;
      transfer: Extract<BaasTransferResult, { ok: true }>["transfer"];
    }
  | { ok: false; status: number; code: string; message: string }
> {
  const current = store.getVault(input.payee_id);
  if (current === undefined) {
    return {
      ok: false,
      status: 404,
      code: "vault_not_found",
      message: "No sovereign vault exists for that payee.",
    };
  }
  const debited = debitAvailable(current, input.amount_cents);
  if (!debited.ok) {
    return {
      ok: false,
      status: 422,
      code: debited.code,
      message: "available_balance is insufficient for that payout.",
    };
  }
  store.upsertVault({
    payee_id: current.payee_id,
    payee_name: current.payee_name,
    ...debited.balances,
    updated_at: now.toISOString(),
  });
  const adapter = getBaasAdapter(store);
  const request = {
    payee_id: current.payee_id,
    payee_name: current.payee_name,
    amount_cents: input.amount_cents,
    currency: "USD",
    ledger_transaction_id: null,
  };
  const result =
    input.rail === "rtp"
      ? await adapter.createRtpPayment(request)
      : await adapter.createAchTransfer(request);
  if (!result.ok) {
    store.upsertVault({
      payee_id: current.payee_id,
      payee_name: current.payee_name,
      available_balance: current.available_balance,
      pending_balance: current.pending_balance,
      reserve_balance: current.reserve_balance,
      updated_at: now.toISOString(),
    });
    return result;
  }
  return {
    ok: true,
    vault: {
      payee_id: current.payee_id,
      payee_name: current.payee_name,
      ...debited.balances,
      updated_at: now.toISOString(),
    },
    transfer: result.transfer,
  };
}
