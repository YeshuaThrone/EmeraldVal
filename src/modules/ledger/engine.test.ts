import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { postJournal } from "./engine";
import { fboDebit, vaultCredit } from "./journal";

describe("postJournal", () => {
  it("persists a balanced journal", () => {
    const store = new SqliteStore(":memory:");
    const posted = postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-1",
      legs: [fboDebit(10), vaultCredit("c1", "pending", 10)],
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) {
      return;
    }
    expect(store.listGlEntriesByJournal(posted.journal.id)).toHaveLength(2);
    expect(store.listGlJournals()).toHaveLength(1);
    expect(posted.journal.sequence).toBe(1);
    expect(posted.journal.entry_hash.length).toBe(64);
    expect(posted.journal.state).toBe("posted");
  });

  it("chains the previous digest and treats an empty prior hash as genesis", () => {
    const store = new SqliteStore(":memory:");
    store.insertGlJournal({
      kind: "royalty_ingest",
      ref_type: "x",
      ref_id: "0",
      created_at: new Date().toISOString(),
    });
    const posted = postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "split_run",
      ref_id: "run-1",
      legs: [fboDebit(2), vaultCredit("c1", "pending", 2)],
    });
    expect(posted.ok).toBe(true);
    if (!posted.ok) {
      return;
    }
    expect(posted.journal.sequence).toBe(1);
    expect(posted.journal.prev_hash).toBe("don-engine/gl/genesis");
  });

  it("rejects empty and unbalanced drafts", () => {
    const store = new SqliteStore(":memory:");
    expect(
      postJournal(store, {
        kind: "royalty_ingest",
        ref_type: "x",
        ref_id: "1",
        legs: [fboDebit(0)],
      }).ok,
    ).toBe(false);
    const unbalanced = postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "x",
      ref_id: "1",
      legs: [fboDebit(3), vaultCredit("c1", "pending", 1)],
    });
    expect(unbalanced.ok).toBe(false);
    if (unbalanced.ok) {
      return;
    }
    expect(unbalanced.code).toBe("unbalanced_journal");
    const empty = postJournal(store, {
      kind: "royalty_ingest",
      ref_type: "x",
      ref_id: "1",
      legs: [fboDebit(0)],
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) {
      return;
    }
    expect(empty.code).toBe("empty_journal");
  });
});
