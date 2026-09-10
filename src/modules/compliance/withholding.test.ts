import { describe, expect, it } from "vitest";
import {
  FORM_1099_THRESHOLD_CENTS,
} from "@/modules/don/constants";
import {
  backupWithholdingCents,
  computeWithholding,
  isTinVerified,
} from "./withholding";

describe("isTinVerified", () => {
  it("requires both TIN and W-9", () => {
    expect(isTinVerified({ tin_verified: true, w9_on_file: true })).toBe(true);
    expect(isTinVerified({ tin_verified: true, w9_on_file: false })).toBe(false);
    expect(isTinVerified({ tin_verified: false, w9_on_file: true })).toBe(false);
  });
});

describe("backupWithholdingCents", () => {
  it("takes 24% floored to integer cents", () => {
    expect(backupWithholdingCents(10_000)).toBe(2400);
    expect(backupWithholdingCents(101)).toBe(24);
    expect(backupWithholdingCents(1)).toBe(0);
  });
});

describe("computeWithholding", () => {
  it("skips withholding when TIN/W-9 is on file", () => {
    const result = computeWithholding(10_000, 0, 0, {
      tin_verified: true,
      w9_on_file: true,
    });
    expect(result.withheld_cents).toBe(0);
    expect(result.net_cents).toBe(10_000);
    expect(result.backup_withholding_applied).toBe(false);
    expect(result.requires_1099).toBe(false);
  });

  it("escrows 24% when unverified", () => {
    const result = computeWithholding(7000, 0, 0, {
      tin_verified: false,
      w9_on_file: false,
    });
    expect(result.withheld_cents).toBe(1680);
    expect(result.net_cents).toBe(5320);
    expect(result.ytd_gross_cents).toBe(7000);
  });

  it("flags 1099-MISC when YTD crosses $600", () => {
    const before = computeWithholding(59_900, 0, 0, {
      tin_verified: true,
      w9_on_file: true,
    });
    expect(before.requires_1099).toBe(false);
    expect(before.crossed_1099_threshold).toBe(false);

    const crossed = computeWithholding(200, 59_900, 0, {
      tin_verified: true,
      w9_on_file: true,
    });
    expect(crossed.ytd_gross_cents).toBe(60_100);
    expect(crossed.requires_1099).toBe(true);
    expect(crossed.crossed_1099_threshold).toBe(true);
    expect(FORM_1099_THRESHOLD_CENTS).toBe(60_000);

    const alreadyOver = computeWithholding(100, 60_000, 0, {
      tin_verified: true,
      w9_on_file: true,
    });
    expect(alreadyOver.crossed_1099_threshold).toBe(false);
    expect(alreadyOver.requires_1099).toBe(true);
  });
});
