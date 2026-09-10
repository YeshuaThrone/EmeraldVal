/**
 * Pure UDR split math — royalty line items × party basis points, in
 * integer cents. Remainder pennies land on the last party so the allocated
 * total always equals the line-item amount (no silent drift).
 */

import type { AllocatedLineItem, AllocatedSplit, SplitPartyInput } from "./types";

export const BPS_DENOMINATOR = 10_000;

export type SplitBalanceError = {
  ok: false;
  code: "splits_do_not_balance";
  message: string;
};

export type AllocateSuccess = { ok: true; splits: AllocatedSplit[] };

export type AllocateResult = AllocateSuccess | SplitBalanceError;

/**
 * Convert a 0–100 percent share to basis points. `70` → 7000,
 * `33.34` → 3334. Validation is the caller's job.
 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function sumBps(splits: ReadonlyArray<{ share_bps: number }>): number {
  return splits.reduce((total, split) => total + split.share_bps, 0);
}

/**
 * Allocate `amountCents` across parties. Floors every share but the last;
 * the last party receives the leftover cents so the sum is exact.
 */
export function allocateCents(
  amountCents: number,
  splits: readonly SplitPartyInput[],
): AllocateResult {
  const totalBps = sumBps(splits);
  if (totalBps !== BPS_DENOMINATOR) {
    return {
      ok: false,
      code: "splits_do_not_balance",
      message: `Party shares must sum to 10000 bps (100%), got ${totalBps}.`,
    };
  }

  const allocated: AllocatedSplit[] = [];
  let remaining = amountCents;
  for (let index = 0; index < splits.length; index += 1) {
    const party = splits[index];
    const isLast = index === splits.length - 1;
    const amount = isLast
      ? remaining
      : Math.floor((amountCents * party.share_bps) / BPS_DENOMINATOR);
    remaining -= amount;
    allocated.push({ ...party, amount_cents: amount });
  }
  return { ok: true, splits: allocated };
}

export function allocateLineItems(
  items: ReadonlyArray<{
    work_id: string;
    work_title: string;
    amount_cents: number;
    splits: SplitPartyInput[];
  }>,
): { ok: true; items: AllocatedLineItem[]; grossCents: number } | SplitBalanceError {
  const allocated: AllocatedLineItem[] = [];
  let grossCents = 0;
  for (const item of items) {
    const result = allocateCents(item.amount_cents, item.splits);
    if (!result.ok) {
      return result;
    }
    allocated.push({
      work_id: item.work_id,
      work_title: item.work_title,
      amount_cents: item.amount_cents,
      splits: result.splits,
    });
    grossCents += item.amount_cents;
  }
  return { ok: true, items: allocated, grossCents };
}
