/**
 * Persist a balanced, hash-chained journal. Append-only: once posted a
 * journal is never updated.
 */

import type { Store } from "@/lib/server/store";
import { GL_GENESIS_HASH } from "@/modules/don/constants";
import type { GlJournalRecord } from "@/modules/don/records";
import { hashJournal } from "./chain";
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
  const previous = store.getLatestGlJournal();
  const sequence = (previous?.sequence ?? 0) + 1;
  const prevHash =
    previous !== undefined && previous.entry_hash !== ""
      ? previous.entry_hash
      : GL_GENESIS_HASH;
  const entryHash = hashJournal({
    sequence,
    kind: draft.kind,
    ref_type: draft.ref_type,
    ref_id: draft.ref_id,
    created_at: createdAt,
    prev_hash: prevHash,
    legs: validated.legs,
  });
  const journal = store.insertGlJournal({
    kind: draft.kind,
    ref_type: draft.ref_type,
    ref_id: draft.ref_id,
    created_at: createdAt,
    sequence,
    prev_hash: prevHash,
    entry_hash: entryHash,
    state: "posted",
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
