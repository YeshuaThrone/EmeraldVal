/**
 * Persist a balanced journal. Rejects empty or unbalanced drafts so the
 * double-entry invariant cannot be written incorrectly.
 */

import type { Store } from "@/lib/server/store";
import type { GlJournalRecord } from "@/modules/don/records";
import {
  validateJournal,
  type GlLeg,
  type JournalDraft,
} from "./journal";

export type PostJournalSuccess = {
  ok: true;
  journal: GlJournalRecord;
  legs: GlLeg[];
};

export type PostJournalFailure = {
  ok: false;
  code: "unbalanced_journal" | "empty_journal";
  message: string;
};

export function postJournal(
  store: Store,
  draft: JournalDraft,
  now: Date = new Date(),
): PostJournalSuccess | PostJournalFailure {
  const validated = validateJournal(draft.legs);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      message:
        validated.code === "empty_journal"
          ? "Journal has no non-zero legs."
          : "sum(debit_cents) must equal sum(credit_cents).",
    };
  }
  const createdAt = now.toISOString();
  const journal = store.insertGlJournal({
    kind: draft.kind,
    ref_type: draft.ref_type,
    ref_id: draft.ref_id,
    created_at: createdAt,
  });
  for (const leg of validated.legs) {
    store.insertGlEntry({
      journal_id: journal.id,
      account: leg.account,
      debit_cents: leg.debit_cents,
      credit_cents: leg.credit_cents,
      created_at: createdAt,
    });
  }
  return { ok: true, journal, legs: validated.legs };
}
