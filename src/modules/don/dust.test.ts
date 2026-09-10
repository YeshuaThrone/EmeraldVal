import { describe, expect, it } from "vitest";
import type { SplitPartyInput } from "@/lib/don/types";
import {
  allocateLineItemsWithDust,
  allocateWithCompanyDustSweep,
  percentToBps,
  sumAllocatedCents,
  sumBps,
  zeroBalanceHolds,
} from "./dust";
import { COMPANY_VARIANCE_PAYEE_ID } from "./constants";

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

describe("percentToBps / sumBps", () => {
  it("converts percents and sums bps", () => {
    expect(percentToBps(70)).toBe(7000);
    expect(percentToBps(33.33)).toBe(3333);
    expect(sumBps([CREATOR, LABEL])).toBe(10_000);
  });
});

describe("allocateWithCompanyDustSweep", () => {
  it("keeps an exact 70/30 split dust-free", () => {
    const result = allocateWithCompanyDustSweep(10_000, [CREATOR, LABEL]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.splits.map((s) => s.amount_cents)).toEqual([7000, 3000]);
    expect(result.company_dust_cents).toBe(0);
    expect(
      zeroBalanceHolds(10_000, result.splits, result.company_dust_cents),
    ).toBe(true);
  });

  it("sweeps the leftover cent on a $1.00 three-way split to the company", () => {
    const thirds: SplitPartyInput[] = [
      { ...CREATOR, payee_id: "a", share_bps: 3333 },
      { ...CREATOR, payee_id: "b", share_bps: 3333 },
      { ...CREATOR, payee_id: "c", share_bps: 3334 },
    ];
    const result = allocateWithCompanyDustSweep(100, thirds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.splits.map((s) => s.amount_cents)).toEqual([33, 33, 33]);
    expect(result.company_dust_cents).toBe(1);
    expect(sumAllocatedCents(result.splits) + result.company_dust_cents).toBe(
      100,
    );
    expect(COMPANY_VARIANCE_PAYEE_ID).toBe("platform");
  });

  it("sweeps dust on $10.00 divided three ways (non-terminating thirds)", () => {
    const thirds: SplitPartyInput[] = [
      { ...CREATOR, payee_id: "a", share_bps: 3333 },
      { ...CREATOR, payee_id: "b", share_bps: 3333 },
      { ...CREATOR, payee_id: "c", share_bps: 3334 },
    ];
    const result = allocateWithCompanyDustSweep(1000, thirds);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.splits.map((s) => s.amount_cents)).toEqual([333, 333, 333]);
    expect(result.company_dust_cents).toBe(1);
    expect(
      zeroBalanceHolds(1000, result.splits, result.company_dust_cents),
    ).toBe(true);
  });

  it("rejects shares that do not sum to 10000 bps", () => {
    const result = allocateWithCompanyDustSweep(1000, [
      { ...CREATOR, share_bps: 5000 },
      { ...LABEL, share_bps: 4000 },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("splits_do_not_balance");
  });
});

describe("allocateLineItemsWithDust", () => {
  it("aggregates variance across works", () => {
    const thirds: SplitPartyInput[] = [
      { ...CREATOR, payee_id: "a", share_bps: 3333 },
      { ...CREATOR, payee_id: "b", share_bps: 3333 },
      { ...CREATOR, payee_id: "c", share_bps: 3334 },
    ];
    const result = allocateLineItemsWithDust([
      {
        work_id: "w1",
        work_title: "Midnight On 6th",
        amount_cents: 10_000,
        splits: [CREATOR, LABEL],
      },
      {
        work_id: "w2",
        work_title: "Rainey Nights",
        amount_cents: 100,
        splits: thirds,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.grossCents).toBe(10_100);
    expect(result.varianceAccountCents).toBe(1);
    expect(
      zeroBalanceHolds(
        result.grossCents,
        result.items.flatMap((item) => item.splits),
        result.varianceAccountCents,
      ),
    ).toBe(true);
  });

  it("propagates a balance error from a nested line", () => {
    const result = allocateLineItemsWithDust([
      {
        work_id: "w1",
        work_title: "Bad",
        amount_cents: 100,
        splits: [{ ...CREATOR, share_bps: 1000 }],
      },
    ]);
    expect(result.ok).toBe(false);
  });
});
