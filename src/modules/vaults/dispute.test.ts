import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import { creditVault } from "./engine";
import { applyDisputeLock, isIncomingFrozen, isPayoutFrozen, isWorkFrozen } from "./dispute";
import { upsertAdvance } from "@/modules/recoupment/engine";

describe("applyDisputeLock", () => {
  it("returns vault_not_found for an unknown payee", () => {
    const store = new SqliteStore(":memory:");
    const result = applyDisputeLock(store, { payee_id: "ghost", locked: true });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("vault_not_found");
  });

  it("freezes available then pending into reserve and blocks payouts", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 40, "available");
    creditVault(store, "c1", "Yeshua Throne", 60, "pending");
    const locked = applyDisputeLock(store, { payee_id: "c1", locked: true });
    expect(locked.ok).toBe(true);
    if (!locked.ok) {
      return;
    }
    expect(locked.frozen_cents).toBe(100);
    expect(store.getVault("c1")?.reserve_balance).toBe(100);
    expect(isPayoutFrozen(store, "c1")).toBe(true);
    const again = applyDisputeLock(store, { payee_id: "c1", locked: true });
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.frozen_cents).toBe(100);
  });

  it("thaws reserve back onto available and pending", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 40, "available");
    creditVault(store, "c1", "Yeshua Throne", 60, "pending");
    applyDisputeLock(store, { payee_id: "c1", locked: true });
    const unlocked = applyDisputeLock(store, { payee_id: "c1", locked: false });
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) {
      return;
    }
    expect(unlocked.frozen_cents).toBe(0);
    expect(store.getVault("c1")?.available_balance).toBe(40);
    expect(store.getVault("c1")?.pending_balance).toBe(60);
    expect(isPayoutFrozen(store, "c1")).toBe(false);
  });

  it("locks an empty vault without moving funds", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 0, "available");
    const locked = applyDisputeLock(store, { payee_id: "c1", locked: true });
    expect(locked.ok).toBe(true);
    if (!locked.ok) {
      return;
    }
    expect(locked.frozen_cents).toBe(0);
    expect(isPayoutFrozen(store, "c1")).toBe(true);
  });

  it("freezes a specific line-item amount", async () => {
    const store = new SqliteStore(":memory:");
    const split = await calculateUdrSplits(store, {
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
    expect(split.ok).toBe(true);
    if (!split.ok) {
      return;
    }
    const lineItemId = split.value.line_items[0]!.id;
    const locked = applyDisputeLock(store, {
      payee_id: "l1",
      locked: true,
      line_item_id: lineItemId,
    });
    expect(locked.ok).toBe(true);
    if (!locked.ok) {
      return;
    }
    expect(locked.frozen_cents).toBe(3000);
    expect(store.getVault("l1")?.reserve_balance).toBe(3000);
  });

  it("returns line_item_not_found when the payee has no rows", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "available");
    const result = applyDisputeLock(store, {
      payee_id: "c1",
      locked: true,
      line_item_id: "missing",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("line_item_not_found");
  });

  it("rejects a freeze larger than available+pending", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "available");
    const result = applyDisputeLock(store, {
      payee_id: "c1",
      locked: true,
      amount_cents: 50,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("insufficient_funds");
  });

  it("rejects unlock when reserve was drained", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 20, "available");
    applyDisputeLock(store, { payee_id: "c1", locked: true });
    store.upsertVault({
      payee_id: "c1",
      payee_name: "Yeshua Throne",
      available_balance: 0,
      pending_balance: 0,
      reserve_balance: 0,
      updated_at: new Date().toISOString(),
    });
    const unlocked = applyDisputeLock(store, { payee_id: "c1", locked: false });
    expect(unlocked.ok).toBe(false);
    if (unlocked.ok) {
      return;
    }
    expect(unlocked.code).toBe("insufficient_reserve");
  });

  it("freezes pending-only funds into reserve", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 75, "pending");
    const locked = applyDisputeLock(store, {
      payee_id: "c1",
      locked: true,
      amount_cents: 75,
    });
    expect(locked.ok).toBe(true);
    if (!locked.ok) {
      return;
    }
    expect(locked.frozen_cents).toBe(75);
    expect(store.getVault("c1")?.pending_balance).toBe(0);
    const unlocked = applyDisputeLock(store, { payee_id: "c1", locked: false });
    expect(unlocked.ok).toBe(true);
    expect(store.getVault("c1")?.pending_balance).toBe(75);
  });

  it("unlocks a vault that was never locked", () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 5, "available");
    const unlocked = applyDisputeLock(store, { payee_id: "c1", locked: false });
    expect(unlocked.ok).toBe(true);
    expect(isPayoutFrozen(store, "c1")).toBe(false);
  });

  it("locks a catalog work without a vault and holds incoming splits in reserve", async () => {
    const store = new SqliteStore(":memory:");
    const catalog = applyDisputeLock(store, {
      work_id: "trk_01",
      locked: true,
    });
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) {
      return;
    }
    expect(catalog.dispute).toBeNull();
    expect(catalog.catalog_dispute?.locked).toBe(1);
    expect(isWorkFrozen(store, "trk_01")).toBe(true);
    expect(isWorkFrozen(store, "other")).toBe(false);

    const missingVault = applyDisputeLock(store, {
      payee_id: "ghost",
      work_id: "trk_ghost",
      locked: true,
    });
    expect(missingVault.ok).toBe(false);
    if (missingVault.ok) {
      return;
    }
    expect(missingVault.code).toBe("vault_not_found");
    expect(isWorkFrozen(store, "trk_ghost")).toBe(true);

    const split = await calculateUdrSplits(store, {
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
    expect(split.ok).toBe(true);
    expect(store.getVault("c1")?.reserve_balance).toBe(7000);
    expect(store.getVault("c1")?.pending_balance).toBe(0);
    expect(store.getVault("l1")?.reserve_balance).toBe(3000);
    expect(isIncomingFrozen(store, "c1", "trk_01")).toBe(true);

    const unlocked = applyDisputeLock(store, { work_id: "trk_01", locked: false });
    expect(unlocked.ok).toBe(true);
    expect(isWorkFrozen(store, "trk_01")).toBe(false);
  });

  it("locks a payee and a work together and parks recoupment excess in reserve", async () => {
    const store = new SqliteStore(":memory:");
    creditVault(store, "c1", "Yeshua Throne", 10, "available");
    upsertAdvance(store, {
      creator_id: "c1",
      creator_name: "Yeshua Throne",
      recoupment_target_cents: 5000,
    });
    const locked = applyDisputeLock(store, {
      payee_id: "c1",
      work_id: "trk_01",
      locked: true,
    });
    expect(locked.ok).toBe(true);
    if (!locked.ok) {
      return;
    }
    expect(locked.catalog_dispute?.work_id).toBe("trk_01");
    expect(isPayoutFrozen(store, "c1")).toBe(true);
    const split = await calculateUdrSplits(store, {
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
    expect(split.ok).toBe(true);
    expect(store.getVault("c1")?.available_balance).toBe(0);
    expect(store.getVault("c1")?.reserve_balance).toBe(10 + 1680 + 320);
    expect(store.getVault("l1")?.reserve_balance).toBe(3000);
  });
});
