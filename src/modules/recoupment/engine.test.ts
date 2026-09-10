import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import {
  applyRecoupmentSweep,
  readAdvance,
  upsertAdvance,
} from "./engine";

describe("upsertAdvance / readAdvance", () => {
  it("creates an advance and preserves current on later target edits", () => {
    const store = new SqliteStore(":memory:");
    const created = upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 1000,
    });
    expect(created.recoupment_bps).toBe(10_000);
    expect(readAdvance(store, "c1").active).toBe(true);
    applyRecoupmentSweep(store, "c1", "Yeshua Throne", 250);
    const updated = upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 2000,
    });
    expect(updated.recoupment_current_cents).toBe(250);
    expect(updated.recoupment_target_cents).toBe(2000);
  });

  it("returns an inactive snapshot when no advance exists", () => {
    const store = new SqliteStore(":memory:");
    const snapshot = readAdvance(store, "missing");
    expect(snapshot.active).toBe(false);
    expect(snapshot.recoupment_target_cents).toBe(0);
  });
});

describe("applyRecoupmentSweep", () => {
  it("passes through when the payee has no advance", () => {
    const store = new SqliteStore(":memory:");
    const result = applyRecoupmentSweep(store, "c1", "Yeshua Throne", 500);
    expect(result.applied).toBe(false);
    expect(result.excess_cents).toBe(500);
    expect(store.getVault("c1")).toBeUndefined();
  });

  it("sweeps incoming splits into the company vault and releases excess", async () => {
    const store = new SqliteStore(":memory:");
    upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 5000,
      recoupment_bps: 10_000,
    });
    const result = await calculateUdrSplits(store, {
      source: "spotify",
      period: "2026-08",
      currency: "USD",
      settle: false,
      rail: "rtp",
      line_items: [
        {
          work_id: "trk_01",
          work_title: "Midnight On 6th",
          amount_cents: 10_000,
          splits: [
            {
              payee_id: "c1",
              payee_name: "Yeshua Throne",
              role: "creator",
              share_bps: 7000,
            },
            {
              payee_id: "l1",
              payee_name: "Throne Records",
              role: "label",
              share_bps: 3000,
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.recoupment[0]?.recouped_cents).toBe(5000);
    expect(result.value.recoupment[0]?.excess_cents).toBe(320);
    expect(store.getVault("platform")?.available_balance).toBe(5000);
    expect(store.getVault("c1")?.available_balance).toBe(320);
    expect(store.getVault("l1")?.pending_balance).toBe(3000);
  });

  it("skips BaaS settlement for recouped parties when settle is true", async () => {
    const store = new SqliteStore(":memory:");
    store.upsertCreatorTaxProfile({
      creator_id: "c1",
      tin_verified: 1,
      w9_on_file: 1,
      updated_at: new Date().toISOString(),
    });
    upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 1000,
    });
    const result = await calculateUdrSplits(store, {
      source: "spotify",
      period: "2026-08",
      currency: "USD",
      settle: true,
      rail: "rtp",
      line_items: [
        {
          work_id: "trk_01",
          work_title: "Midnight",
          amount_cents: 10_000,
          splits: [
            {
              payee_id: "c1",
              payee_name: "Yeshua Throne",
              role: "creator",
              share_bps: 7000,
            },
            {
              payee_id: "l1",
              payee_name: "Throne Records",
              role: "label",
              share_bps: 3000,
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.settlement?.transfers).toHaveLength(1);
    expect(store.getVault("c1")?.available_balance).toBe(6000);
    expect(store.getVault("platform")?.available_balance).toBe(1000);
  });

  it("no-ops a zero incoming sweep against an existing advance", () => {
    const store = new SqliteStore(":memory:");
    upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 100,
    });
    const result = applyRecoupmentSweep(store, "c1", "Yeshua Throne", 0);
    expect(result.applied).toBe(true);
    expect(result.recouped_cents).toBe(0);
  });
});
