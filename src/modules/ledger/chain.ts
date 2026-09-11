/**
 * Append-only GL hash chain. Journals are never updated; each posted
 * entry hashes its payload plus the previous digest.
 */

import { createHash } from "node:crypto";
import { GL_GENESIS_HASH } from "@/modules/don/constants";
import type { GlJournalRecord } from "@/modules/don/records";
import type { GlLeg } from "./journal";

export { GL_GENESIS_HASH };

export type ChainPayload = {
  sequence: number;
  kind: string;
  ref_type: string;
  ref_id: string;
  created_at: string;
  prev_hash: string;
  legs: GlLeg[];
};

export function hashJournal(payload: ChainPayload): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        sequence: payload.sequence,
        kind: payload.kind,
        ref_type: payload.ref_type,
        ref_id: payload.ref_id,
        created_at: payload.created_at,
        prev_hash: payload.prev_hash,
        legs: payload.legs,
      }),
    )
    .digest("hex");
}

export type ChainVerification = {
  valid: boolean;
  journal_count: number;
  genesis: string;
  broken_at: number | null;
};

export function verifyHashChain(
  journals: ReadonlyArray<GlJournalRecord>,
  legsByJournal: ReadonlyMap<string, GlLeg[]>,
): ChainVerification {
  if (journals.length === 0) {
    return {
      valid: true,
      journal_count: 0,
      genesis: GL_GENESIS_HASH,
      broken_at: null,
    };
  }
  let previous = GL_GENESIS_HASH;
  for (const journal of journals) {
    if (journal.entry_hash === "" || journal.state !== "posted") {
      return {
        valid: false,
        journal_count: journals.length,
        genesis: GL_GENESIS_HASH,
        broken_at: journal.sequence,
      };
    }
    if (journal.prev_hash !== previous) {
      return {
        valid: false,
        journal_count: journals.length,
        genesis: GL_GENESIS_HASH,
        broken_at: journal.sequence,
      };
    }
    const expected = hashJournal({
      sequence: journal.sequence,
      kind: journal.kind,
      ref_type: journal.ref_type,
      ref_id: journal.ref_id,
      created_at: journal.created_at,
      prev_hash: journal.prev_hash,
      legs: legsByJournal.get(journal.id) ?? [],
    });
    if (expected !== journal.entry_hash) {
      return {
        valid: false,
        journal_count: journals.length,
        genesis: GL_GENESIS_HASH,
        broken_at: journal.sequence,
      };
    }
    previous = journal.entry_hash;
  }
  return {
    valid: true,
    journal_count: journals.length,
    genesis: GL_GENESIS_HASH,
    broken_at: null,
  };
}
