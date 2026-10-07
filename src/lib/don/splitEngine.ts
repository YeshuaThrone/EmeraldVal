/**
 * Pure UDR split math — royalty line items × party basis points, in
 * integer cents. Floor each party, then sweep leftover dust into the
 * company variance account (Primary Company Variance Sweep).
 */

import type { AllocatedLineItem, SplitPartyInput } from "./types";
import {
  allocateLineItemsWithDust,
  allocateWithCompanyDustSweep,
  percentToBps,
  sumBps,
  type DustAllocateResult,
  type SplitBalanceError,
} from "@/modules/don/dust";

export { percentToBps, sumBps };
export type { SplitBalanceError };
export { BPS_DENOMINATOR } from "@/modules/don/constants";

export type AllocateSuccess = Extract<DustAllocateResult, { ok: true }>;
export type AllocateResult = DustAllocateResult;

/**
 * Allocate `amountCents` across parties with a company dust sweep.
 */
export function allocateCents(
  amountCents: number,
  splits: readonly SplitPartyInput[],
): AllocateResult {
  return allocateWithCompanyDustSweep(amountCents, splits);
}

export function allocateLineItems(
  items: ReadonlyArray<{
    work_id: string;
    work_title: string;
    amount_cents: number;
    splits: SplitPartyInput[];
  }>,
):
  | {
      ok: true;
      items: AllocatedLineItem[];
      grossCents: number;
      varianceAccountCents: number;
    }
  | SplitBalanceError {
  return allocateLineItemsWithDust(items);
}
