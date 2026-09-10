/**
 * Unearned-advance recoupment — pure sweep math.
 *
 * Incoming split nets are swept at `recoupment_bps` (default 100%) toward
 * the remaining advance (`target - current`) before any excess is released.
 */

import { BPS_DENOMINATOR, DEFAULT_RECOUPMENT_BPS } from "@/modules/don/constants";

export type RecoupmentSweepInput = {
  incoming_cents: number;
  recoupment_target_cents: number;
  recoupment_current_cents: number;
  recoupment_bps?: number;
};

export type RecoupmentSweep = {
  recouped_cents: number;
  excess_cents: number;
  recoupment_current_cents: number;
  recoupment_remaining_cents: number;
  completed: boolean;
};

export function remainingAdvance(
  targetCents: number,
  currentCents: number,
): number {
  return Math.max(0, targetCents - currentCents);
}

export function sweepRecoupment(input: RecoupmentSweepInput): RecoupmentSweep {
  const bps = input.recoupment_bps ?? DEFAULT_RECOUPMENT_BPS;
  const remaining = remainingAdvance(
    input.recoupment_target_cents,
    input.recoupment_current_cents,
  );
  if (input.incoming_cents < 1 || remaining < 1 || bps < 1) {
    return {
      recouped_cents: 0,
      excess_cents: Math.max(0, input.incoming_cents),
      recoupment_current_cents: input.recoupment_current_cents,
      recoupment_remaining_cents: remaining,
      completed: remaining === 0,
    };
  }
  const sweepable = Math.floor((input.incoming_cents * bps) / BPS_DENOMINATOR);
  const recouped = Math.min(sweepable, remaining, input.incoming_cents);
  const current = input.recoupment_current_cents + recouped;
  const leftover = remaining - recouped;
  return {
    recouped_cents: recouped,
    excess_cents: input.incoming_cents - recouped,
    recoupment_current_cents: current,
    recoupment_remaining_cents: leftover,
    completed: leftover === 0,
  };
}
