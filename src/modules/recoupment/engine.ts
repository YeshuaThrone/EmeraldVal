/**
 * Store-backed unearned-advance recoupment.
 */

import type { Store } from "@/lib/server/store";
import {
  COMPANY_VARIANCE_PAYEE_ID,
  COMPANY_VARIANCE_PAYEE_NAME,
  DEFAULT_RECOUPMENT_BPS,
} from "@/modules/don/constants";
import type { RecoupmentAdvanceRecord } from "@/modules/don/records";
import { creditVault } from "@/modules/vaults/engine";
import { sweepRecoupment } from "./sweep";

export type UpsertAdvanceInput = {
  creator_id: string;
  creator_name: string;
  recoupment_target_cents: number;
  recoupment_bps?: number;
};

export function upsertAdvance(
  store: Store,
  input: UpsertAdvanceInput,
  now: Date = new Date(),
): RecoupmentAdvanceRecord {
  const existing = store.getRecoupmentAdvance(input.creator_id);
  return store.upsertRecoupmentAdvance({
    creator_id: input.creator_id,
    creator_name: input.creator_name,
    recoupment_target_cents: input.recoupment_target_cents,
    recoupment_current_cents: existing?.recoupment_current_cents ?? 0,
    recoupment_bps: input.recoupment_bps ?? existing?.recoupment_bps ?? DEFAULT_RECOUPMENT_BPS,
    updated_at: now.toISOString(),
  });
}

export type RecoupmentApplyResult = {
  applied: boolean;
  recouped_cents: number;
  excess_cents: number;
  recoupment_target_cents: number;
  recoupment_current_cents: number;
  recoupment_remaining_cents: number;
  completed: boolean;
};

export function applyRecoupmentSweep(
  store: Store,
  payeeId: string,
  payeeName: string,
  incomingCents: number,
  now: Date = new Date(),
): RecoupmentApplyResult {
  const advance = store.getRecoupmentAdvance(payeeId);
  if (advance === undefined) {
    return {
      applied: false,
      recouped_cents: 0,
      excess_cents: incomingCents,
      recoupment_target_cents: 0,
      recoupment_current_cents: 0,
      recoupment_remaining_cents: 0,
      completed: true,
    };
  }
  const swept = sweepRecoupment({
    incoming_cents: incomingCents,
    recoupment_target_cents: advance.recoupment_target_cents,
    recoupment_current_cents: advance.recoupment_current_cents,
    recoupment_bps: advance.recoupment_bps,
  });
  if (swept.recouped_cents > 0) {
    store.upsertRecoupmentAdvance({
      ...advance,
      recoupment_current_cents: swept.recoupment_current_cents,
      updated_at: now.toISOString(),
    });
    creditVault(
      store,
      COMPANY_VARIANCE_PAYEE_ID,
      COMPANY_VARIANCE_PAYEE_NAME,
      swept.recouped_cents,
      "available",
      now,
    );
  }
  if (swept.excess_cents > 0) {
    creditVault(store, payeeId, payeeName, swept.excess_cents, "available", now);
  }
  return {
    applied: true,
    recouped_cents: swept.recouped_cents,
    excess_cents: swept.excess_cents,
    recoupment_target_cents: advance.recoupment_target_cents,
    recoupment_current_cents: swept.recoupment_current_cents,
    recoupment_remaining_cents: swept.recoupment_remaining_cents,
    completed: swept.completed,
  };
}

export function readAdvance(store: Store, creatorId: string) {
  const row = store.getRecoupmentAdvance(creatorId);
  if (row === undefined) {
    return {
      creator_id: creatorId,
      recoupment_target_cents: 0,
      recoupment_current_cents: 0,
      recoupment_bps: DEFAULT_RECOUPMENT_BPS,
      recoupment_remaining_cents: 0,
      active: false,
    };
  }
  return {
    ...row,
    recoupment_remaining_cents: Math.max(
      0,
      row.recoupment_target_cents - row.recoupment_current_cents,
    ),
    active: row.recoupment_current_cents < row.recoupment_target_cents,
  };
}
