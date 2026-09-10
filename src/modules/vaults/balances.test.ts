import { describe, expect, it } from "vitest";
import {
  creditBalances,
  debitAvailable,
  debitPending,
  emptyVaultBalances,
  freezeIntoReserve,
  holdPayout,
  releasePending,
  reversePayoutHold,
  unfreezeFromReserve,
} from "./balances";

describe("creditBalances", () => {
  it("credits pending, available, and reserve independently", () => {
    const start = emptyVaultBalances();
    const pending = creditBalances(start, 7000, "pending");
    expect(pending.pending_balance).toBe(7000);
    const available = creditBalances(pending, 100, "available");
    expect(available.available_balance).toBe(100);
    const reserve = creditBalances(available, 50, "reserve");
    expect(reserve.reserve_balance).toBe(50);
  });

  it("no-ops a zero credit", () => {
    const start = emptyVaultBalances();
    expect(creditBalances(start, 0, "pending")).toEqual(start);
  });
});

describe("releasePending", () => {
  it("moves the full pending balance into available by default", () => {
    const result = releasePending({
      available_balance: 10,
      pending_balance: 90,
      reserve_balance: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.released_cents).toBe(90);
    expect(result.balances.available_balance).toBe(100);
    expect(result.balances.pending_balance).toBe(0);
  });

  it("rejects an over-release", () => {
    const result = releasePending(emptyVaultBalances(), 1);
    expect(result).toEqual({ ok: false, code: "insufficient_pending" });
  });

  it("rejects a negative release", () => {
    const result = releasePending(
      { available_balance: 0, pending_balance: 10, reserve_balance: 0 },
      -1,
    );
    expect(result.ok).toBe(false);
  });
});

describe("debitAvailable", () => {
  it("debits a payout from available", () => {
    const result = debitAvailable(
      { available_balance: 500, pending_balance: 0, reserve_balance: 0 },
      200,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.balances.available_balance).toBe(300);
  });

  it("rejects insufficient available or a zero debit", () => {
    expect(
      debitAvailable(emptyVaultBalances(), 1).ok,
    ).toBe(false);
    expect(
      debitAvailable(
        { available_balance: 10, pending_balance: 0, reserve_balance: 0 },
        0,
      ).ok,
    ).toBe(false);
  });
});

describe("hold / reverse / freeze", () => {
  const base = {
    available_balance: 80,
    pending_balance: 40,
    reserve_balance: 5,
  };

  it("holds a payout in pending and reverses it", () => {
    const held = holdPayout(base, 50);
    expect(held.ok).toBe(true);
    if (!held.ok) {
      return;
    }
    expect(held.balances.available_balance).toBe(30);
    expect(held.balances.pending_balance).toBe(90);
    const reversed = reversePayoutHold(held.balances, 50);
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) {
      return;
    }
    expect(reversed.balances.available_balance).toBe(80);
    expect(reversed.balances.pending_balance).toBe(40);
  });

  it("rejects holds and reverses that exceed balances", () => {
    expect(holdPayout(base, 81).ok).toBe(false);
    expect(debitPending(base, 41).ok).toBe(false);
    expect(reversePayoutHold(base, 41).ok).toBe(false);
  });

  it("freezes available then pending into reserve and thaws them", () => {
    const frozen = freezeIntoReserve(base, 100);
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) {
      return;
    }
    expect(frozen.frozen_from_available).toBe(80);
    expect(frozen.frozen_from_pending).toBe(20);
    expect(frozen.balances.reserve_balance).toBe(105);
    const thawed = unfreezeFromReserve(
      frozen.balances,
      frozen.frozen_from_available,
      frozen.frozen_from_pending,
    );
    expect(thawed.ok).toBe(true);
    if (!thawed.ok) {
      return;
    }
    expect(thawed.balances).toEqual(base);
  });

  it("rejects an over-freeze and an over-thaw", () => {
    expect(freezeIntoReserve(base, 0)).toEqual({
      ok: false,
      code: "insufficient_funds",
    });
    expect(freezeIntoReserve(base, 121).ok).toBe(false);
    expect(unfreezeFromReserve(base, 10, 0).ok).toBe(false);
  });
});
