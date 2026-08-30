import { describe, expect, it } from "vitest";
import {
  CIVIC_COMPLIANCE_DATA,
  MBGRT_RATE,
  calculateTaxYield,
} from "@/lib/civic";
import {
  ACTIVE_FANS,
  ACTIVE_VENUE_COUNT,
  LOCAL_ARTIST_SHARE_PERCENT,
  MUNICIPAL_DATA,
} from "@/lib/municipal";
import {
  ADMIN_TELEMETRY_DATA,
  LOCAL_ACTS_COUNT,
  LIVE_STREAMS,
  TOTAL_VENUES,
  TOURING_ACTS_COUNT,
  deriveDecimalPercent,
  deriveWholePercent,
} from "@/lib/telemetry";

describe("ADMIN_TELEMETRY_DATA base counts", () => {
  it("holds the contract base counts as literals", () => {
    expect(ADMIN_TELEMETRY_DATA.totalVenues).toBe(36);
    expect(ADMIN_TELEMETRY_DATA.liveStreams).toBe(14);
    expect(ADMIN_TELEMETRY_DATA.localActsCount).toBe(25);
    expect(ADMIN_TELEMETRY_DATA.touringActsCount).toBe(11);
  });

  it("holds the realtime foot traffic and sound density display figures", () => {
    expect(ADMIN_TELEMETRY_DATA.realtimeFootTraffic).toBe("14,280");
    expect(ADMIN_TELEMETRY_DATA.soundDensityIndex).toBe("92%");
  });

  it("balances the roster: local plus touring acts equal total venues", () => {
    expect(LOCAL_ACTS_COUNT + TOURING_ACTS_COUNT).toBe(TOTAL_VENUES);
  });
});

describe("ADMIN_TELEMETRY_DATA derived percentages", () => {
  it("derives liveStreamsPct from the counts, not a literal (14/36 to 39%)", () => {
    expect(Math.round((14 / 36) * 100)).toBe(39);
    expect(ADMIN_TELEMETRY_DATA.liveStreamsPct).toBe(
      deriveWholePercent(LIVE_STREAMS, TOTAL_VENUES),
    );
    expect(ADMIN_TELEMETRY_DATA.liveStreamsPct).toBe("39%");
  });

  it("derives localSharePct from the counts, not a literal (25/36 to 69.4%)", () => {
    expect((25 / 36) * 100).toBeCloseTo(69.444, 2);
    expect(ADMIN_TELEMETRY_DATA.localSharePct).toBe(
      deriveDecimalPercent(LOCAL_ACTS_COUNT, TOTAL_VENUES),
    );
    expect(ADMIN_TELEMETRY_DATA.localSharePct).toBe("69.4%");
  });

  it("keeps the percentage helpers honest at the boundaries", () => {
    expect(deriveWholePercent(0, 36)).toBe("0%");
    expect(deriveWholePercent(36, 36)).toBe("100%");
    expect(deriveDecimalPercent(0, 36)).toBe("0.0%");
    expect(deriveDecimalPercent(36, 36)).toBe("100.0%");
  });
});

describe("ADMIN_TELEMETRY_DATA derived dollars", () => {
  it("derives the MBGRT tax yield through calculateTaxYield ($9,548)", () => {
    expect(ADMIN_TELEMETRY_DATA.mbgrtTaxYield).toBe(
      calculateTaxYield(142500, MBGRT_RATE),
    );
    expect(ADMIN_TELEMETRY_DATA.mbgrtTaxYield).toBe("$9,548");
  });
});

describe("telemetry sync invariants", () => {
  it("syncs nighttimeEconomicImpact to the municipal impact value", () => {
    expect(ADMIN_TELEMETRY_DATA.nighttimeEconomicImpact).toBe(
      MUNICIPAL_DATA.nighttimeEconomyImpactUsd,
    );
    expect(ADMIN_TELEMETRY_DATA.nighttimeEconomicImpact).toBe(142500);
  });

  it("syncs the MBGRT yield to the civic section's calculated yield", () => {
    expect(ADMIN_TELEMETRY_DATA.mbgrtTaxYield).toBe(
      CIVIC_COMPLIANCE_DATA.estMbrtTaxYieldUsd,
    );
  });

  it("keeps totalVenues in step with the municipal active venue count", () => {
    expect(ADMIN_TELEMETRY_DATA.totalVenues).toBe(ACTIVE_VENUE_COUNT);
  });

  it("keeps realtimeFootTraffic in step with the municipal active fans figure", () => {
    expect(
      Number(ADMIN_TELEMETRY_DATA.realtimeFootTraffic.replace(/,/g, "")),
    ).toBe(ACTIVE_FANS);
  });

  it("feeds the municipal local-share card the master 69.4% figure", () => {
    expect(LOCAL_ARTIST_SHARE_PERCENT).toBe(
      Number.parseFloat(ADMIN_TELEMETRY_DATA.localSharePct),
    );
    expect(LOCAL_ARTIST_SHARE_PERCENT).toBe(69.4);
  });
});
