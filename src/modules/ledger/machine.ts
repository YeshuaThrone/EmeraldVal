/**
 * GL / split / payout hold state machine. Journals are append-only
 * (`posted` is terminal). Split runs and payout holds have one-way
 * transitions used by the reversal engine.
 */

export const GL_JOURNAL_STATES = ["posted"] as const;
export type GlJournalState = (typeof GL_JOURNAL_STATES)[number];

export const SPLIT_RUN_STATES = ["posted", "reversed"] as const;
export type SplitRunState = (typeof SPLIT_RUN_STATES)[number];

export const PAYOUT_HOLD_STATES = ["in_flight", "settled", "reversed"] as const;
export type PayoutHoldState = (typeof PAYOUT_HOLD_STATES)[number];

export function canTransitionJournal(
  from: GlJournalState,
  to: GlJournalState,
): boolean {
  return from === "posted" && to === "posted";
}

export function canTransitionSplit(
  from: SplitRunState,
  to: SplitRunState,
): boolean {
  return from === "posted" && to === "reversed";
}

export function canTransitionHold(
  from: PayoutHoldState,
  to: PayoutHoldState,
): boolean {
  if (from === "in_flight") {
    return to === "settled" || to === "reversed";
  }
  if (from === "settled") {
    return to === "reversed";
  }
  return false;
}
