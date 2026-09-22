import { describe, expect, it } from "vitest";
import {
  AdRevenueLedger,
  type AdImpression,
} from "./adRevenueLedger";

function impression(overrides: Partial<AdImpression> = {}): AdImpression {
  return {
    impressionId: "imp-1",
    channelId: "channel-austin-live",
    assetId: "asset-preroll",
    creatorId: "creator-42",
    cpmRateUSD: 20,
    impressionCount: 1000,
    timestamp: new Date("2026-09-14T21:00:00Z"),
    ...overrides,
  };
}

describe("AdRevenueLedger.processSplit", () => {
  it("splits CPM revenue 50/50 between platform and creator", () => {
    const result = AdRevenueLedger.processSplit(impression());

    expect(result).toEqual({
      creatorId: "creator-42",
      assetId: "asset-preroll",
      grossRevenue: 20,
      platformShare: 10,
      creatorShare: 10,
    });
  });

  it("scales gross revenue by impression count (CPM / 1000)", () => {
    const result = AdRevenueLedger.processSplit(
      impression({ cpmRateUSD: 15, impressionCount: 250 }),
    );

    // (15 / 1000) * 250 = 3.75
    expect(result.grossRevenue).toBe(3.75);
    expect(result.platformShare).toBe(1.875);
    expect(result.creatorShare).toBe(1.875);
  });

  it("rounds shares to four decimal places", () => {
    const result = AdRevenueLedger.processSplit(
      impression({ cpmRateUSD: 12.345, impressionCount: 3 }),
    );

    // (12.345 / 1000) * 3 = 0.037035
    expect(result.grossRevenue).toBe(0.037);
    expect(result.platformShare).toBe(0.0185);
    expect(result.creatorShare).toBe(0.0185);
  });

  it("returns zero revenue for zero impressions", () => {
    const result = AdRevenueLedger.processSplit(
      impression({ impressionCount: 0 }),
    );

    expect(result.grossRevenue).toBe(0);
    expect(result.platformShare).toBe(0);
    expect(result.creatorShare).toBe(0);
  });
});
