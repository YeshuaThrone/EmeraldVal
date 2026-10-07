import { describe, expect, it } from "vitest";
import {
  allocateCents,
  allocateLineItems,
  percentToBps,
  sumBps,
} from "@/lib/don/splitEngine";
import type { SplitPartyInput } from "@/lib/don/types";

const CREATOR: SplitPartyInput = {
  payee_id: "c1",
  payee_name: "Yeshua Throne",
  role: "creator",
  share_bps: 7000,
};

const LABEL: SplitPartyInput = {
  payee_id: "l1",
  payee_name: "Throne Records",
  role: "label",
  share_bps: 3000,
};

describe("percentToBps", () => {
  it("converts whole percents", () => {
    expect(percentToBps(70)).toBe(7000);
    expect(percentToBps(100)).toBe(10_000);
  });

  it("rounds fractional percents to the nearest basis point", () => {
    expect(percentToBps(33.33)).toBe(3333);
    expect(percentToBps(33.34)).toBe(3334);
  });
});

describe("allocateCents", () => {
  it("splits 10000 cents 70/30 with no remainder", () => {
    const result = allocateCents(10_000, [CREATOR, LABEL]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.splits.map((s) => s.amount_cents)).toEqual([7000, 3000]);
    expect(result.company_dust_cents).toBe(0);
    expect(
      result.splits.reduce((sum, s) => sum + s.amount_cents, 0) +
        result.company_dust_cents,
    ).toBe(10_000);
  });

  it("sweeps leftover pennies into company dust instead of the last party", () => {
    const thirds: SplitPartyInput[] = [
      { ...CREATOR, payee_id: "a", share_bps: 3333 },
      { ...CREATOR, payee_id: "b", share_bps: 3333 },
      { ...CREATOR, payee_id: "c", share_bps: 3334 },
    ];
    const result = allocateCents(100, thirds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.splits.map((s) => s.amount_cents)).toEqual([33, 33, 33]);
    expect(result.company_dust_cents).toBe(1);
    expect(
      result.splits.reduce((sum, s) => sum + s.amount_cents, 0) +
        result.company_dust_cents,
    ).toBe(100);
  });

  it("rejects shares that do not sum to 10000 bps", () => {
    const result = allocateCents(1000, [
      { ...CREATOR, share_bps: 5000 },
      { ...LABEL, share_bps: 4000 },
    ]);
    expect(result).toEqual({
      ok: false,
      code: "splits_do_not_balance",
      message: "Party shares must sum to 10000 bps (100%), got 9000.",
    });
  });
});

describe("allocateLineItems", () => {
  it("sums gross cents across works", () => {
    const result = allocateLineItems([
      {
        work_id: "w1",
        work_title: "Midnight On 6th",
        amount_cents: 10_000,
        splits: [CREATOR, LABEL],
      },
      {
        work_id: "w2",
        work_title: "Rainey Nights",
        amount_cents: 2500,
        splits: [CREATOR, LABEL],
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.grossCents).toBe(12_500);
    expect(result.items).toHaveLength(2);
  });

  it("exposes sumBps for validators", () => {
    expect(sumBps([CREATOR, LABEL])).toBe(10_000);
  });
});
