import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { GL_GENESIS_HASH } from "@/modules/don/constants";
import type { GlJournalRecord } from "@/modules/don/records";
import { hashJournal, verifyHashChain } from "./chain";
import { postJournal } from "./engine";
import { fboDebit, vaultCredit, type GlLeg } from "./journal";

function posted(
  overrides: Partial<GlJournalRecord> & Pick<GlJournalRecord, "id" | "sequence" | "prev_hash" | "entry_hash">,
): GlJournalRecord {
  return {
    kind: "royalty_ingest",
    ref_type: "split_run",
    ref_id: "run-1",
    created_at: "2026-09-10T00:00:00.000Z",
    state: "posted",
    ...overrides,
  };
}

describe("verifyHashChain", () => {
  it("accepts an empty log", () => {
    expect(verifyHashChain([], new Map())).toEqual({
      valid: true,
      journal_count: 0,
      genesis: GL_GENESIS_HASH,
      broken_at: null,
    });
  });

  it("verifies a posted hash chain", () => {
    const store = new SqliteStore(":memory:");
    const first = postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-1",
      legs: [fboDebit(10), vaultCredit("c1", "pending", 10)],
    });
    const second = postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-2",
      legs: [fboDebit(4), vaultCredit("c1", "pending", 4)],
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(second.journal.prev_hash).toBe(first.journal.entry_hash);
    expect(second.journal.sequence).toBe(2);
    const legs = new Map<string, GlLeg[]>();
    legs.set(first.journal.id, first.legs);
    legs.set(second.journal.id, second.legs);
    expect(verifyHashChain(store.listGlJournals(), legs).valid).toBe(true);
  });

  it("breaks on a missing digest, bad prev hash, payload mismatch, or non-posted state", () => {
    const legs = new Map<string, GlLeg[]>();
    expect(
      verifyHashChain(
        [
          posted({
            id: "j1",
            sequence: 1,
            prev_hash: GL_GENESIS_HASH,
            entry_hash: "",
          }),
        ],
        legs,
      ).broken_at,
    ).toBe(1);

    const payload = {
      sequence: 1,
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-1",
      created_at: "2026-09-10T00:00:00.000Z",
      prev_hash: GL_GENESIS_HASH,
      legs: [fboDebit(1), vaultCredit("c1", "pending", 1)],
    };
    const digest = hashJournal(payload);
    expect(
      verifyHashChain(
        [
          posted({
            id: "j1",
            sequence: 1,
            prev_hash: "not-genesis",
            entry_hash: digest,
          }),
        ],
        legs,
      ).valid,
    ).toBe(false);

    legs.set("j1", payload.legs);
    expect(
      verifyHashChain(
        [
          posted({
            id: "j1",
            sequence: 1,
            prev_hash: GL_GENESIS_HASH,
            entry_hash: "deadbeef",
          }),
        ],
        legs,
      ).valid,
    ).toBe(false);

    expect(
      verifyHashChain(
        [
          posted({
            id: "j1",
            sequence: 1,
            prev_hash: GL_GENESIS_HASH,
            entry_hash: digest,
            state: "voided" as "posted",
          }),
        ],
        legs,
      ).valid,
    ).toBe(false);

    const emptyLegsDigest = hashJournal({
      sequence: 1,
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-1",
      created_at: "2026-09-10T00:00:00.000Z",
      prev_hash: GL_GENESIS_HASH,
      legs: [],
    });
    expect(
      verifyHashChain(
        [
          posted({
            id: "missing-legs",
            sequence: 1,
            prev_hash: GL_GENESIS_HASH,
            entry_hash: emptyLegsDigest,
          }),
        ],
        new Map(),
      ).valid,
    ).toBe(true);
  });
});
