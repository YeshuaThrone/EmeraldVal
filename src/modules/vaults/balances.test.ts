import { describe, expect, it } from "vitest";
import {
  creditBalances,
  debitAvailable,
  emptyVaultBalances,
  releasePending,
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
