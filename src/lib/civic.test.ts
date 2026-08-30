import { describe, expect, it } from "vitest";
import {
  CIVIC_COMPLIANCE_DATA,
  GROSS_BEVERAGE_RECEIPTS_USD,
  MBGRT_RATE,
  VENUE_AUDIT_ROWS,
  calculateTaxYield,
  deriveVenueStatus,
  filterVenuesByName,
  type VenueAuditRow,
} from "@/lib/civic";
import { MUNICIPAL_DATA } from "@/lib/municipal";

describe("civic contract figures", () => {
  it("holds active stage utilization at 84.2%", () => {
    expect(CIVIC_COMPLIANCE_DATA.activeStageUtilization).toBe("84.2%");
  });

  it("calculates $142,500 at the 6.7% MBGRT rate to $9,548", () => {
    expect(calculateTaxYield(142500, 0.067)).toBe("$9,548");
  });

  it("formats the yield as en-US USD with no fraction digits", () => {
    expect(calculateTaxYield(1000, 0.067)).toBe("$67");
    expect(calculateTaxYield(0, 0.067)).toBe("$0");
  });

  it("derives the module tax yield through the helper, not a literal", () => {
    expect(CIVIC_COMPLIANCE_DATA.estMbrtTaxYieldUsd).toBe(
      calculateTaxYield(GROSS_BEVERAGE_RECEIPTS_USD, MBGRT_RATE),
    );
    expect(CIVIC_COMPLIANCE_DATA.estMbrtTaxYieldUsd).toBe("$9,548");
  });

  it("pins the MBGRT rate at the official Texas 6.7%", () => {
    expect(MBGRT_RATE).toBe(0.067);
    expect(CIVIC_COMPLIANCE_DATA.mbrtTaxRateLabel).toBe(
      "Texas 6.7% MBGRT venue tax rate",
    );
  });

  it("syncs gross beverage receipts to the municipal nighttime economic impact", () => {
    expect(GROSS_BEVERAGE_RECEIPTS_USD).toBe(
      MUNICIPAL_DATA.nighttimeEconomyImpactUsd,
    );
    expect(GROSS_BEVERAGE_RECEIPTS_USD).toBe(142500);
  });

  it("holds ordinance compliance at 92% with 2 violations", () => {
    expect(CIVIC_COMPLIANCE_DATA.ordinanceComplianceRate).toBe("92%");
    expect(CIVIC_COMPLIANCE_DATA.ordinanceViolationsCount).toBe(2);
  });
});

describe("VENUE_AUDIT_ROWS", () => {
  it("lists exactly the five contract venues with their districts and dB readings", () => {
    expect(VENUE_AUDIT_ROWS).toEqual([
      {
        name: "Empire Control Room",
        district: "D9",
        currentDb: 88,
        limitDb: 85,
      },
      { name: "Far Out Lounge", district: "D2", currentDb: 79, limitDb: 80 },
      { name: "Mohawk", district: "D9", currentDb: 91, limitDb: 85 },
      {
        name: "The Continental Club",
        district: "D9",
        currentDb: 74,
        limitDb: 80,
      },
      {
        name: "C-Boy's Heart & Soul",
        district: "D9",
        currentDb: 72,
        limitDb: 75,
      },
    ]);
  });

  it("matches the contract's two over-limit venues (Empire Control Room, Mohawk)", () => {
    const overLimit = VENUE_AUDIT_ROWS.filter(
      (venue) => venue.currentDb > venue.limitDb,
    ).map((venue) => venue.name);
    expect(overLimit).toEqual(["Empire Control Room", "Mohawk"]);
  });
});

describe("deriveVenueStatus", () => {
  it("classifies every contract venue independently of the stored rows", () => {
    // Expectations computed by hand from the pasted contract figures.
    const expected: Array<[string, "OVER_LIMIT" | "COMPLIANT"]> = [
      ["Empire Control Room", "OVER_LIMIT"], // 88 > 85
      ["Far Out Lounge", "COMPLIANT"], // 79 < 80
      ["Mohawk", "OVER_LIMIT"], // 91 > 85
      ["The Continental Club", "COMPLIANT"], // 74 < 80
      ["C-Boy's Heart & Soul", "COMPLIANT"], // 72 < 75
    ];
    for (const [name, status] of expected) {
      const venue = VENUE_AUDIT_ROWS.find((row) => row.name === name);
      expect(venue).toBeDefined();
      expect(deriveVenueStatus(venue!.currentDb, venue!.limitDb)).toBe(status);
    }
  });

  it("treats a reading exactly at the limit as compliant", () => {
    expect(deriveVenueStatus(85, 85)).toBe("COMPLIANT");
  });

  it("classifies one decibel over the limit as over limit", () => {
    expect(deriveVenueStatus(86, 85)).toBe("OVER_LIMIT");
  });
});

describe("filterVenuesByName", () => {
  const venues: VenueAuditRow[] = [
    { name: "Empire Control Room", district: "D9", currentDb: 88, limitDb: 85 },
    { name: "Far Out Lounge", district: "D2", currentDb: 79, limitDb: 80 },
    { name: "Mohawk", district: "D9", currentDb: 91, limitDb: 85 },
  ];

  it("returns all venues for a null query", () => {
    expect(filterVenuesByName(venues, null)).toEqual(venues);
  });

  it("returns all venues for an empty query", () => {
    expect(filterVenuesByName(venues, "")).toEqual(venues);
  });

  it("returns all venues for a whitespace-only query", () => {
    expect(filterVenuesByName(venues, "   ")).toEqual(venues);
  });

  it("matches a case-insensitive substring", () => {
    expect(filterVenuesByName(venues, "MOHAWK").map((v) => v.name)).toEqual([
      "Mohawk",
    ]);
    expect(filterVenuesByName(venues, "lounge").map((v) => v.name)).toEqual([
      "Far Out Lounge",
    ]);
  });

  it("matches a partial substring in the middle of a name", () => {
    expect(filterVenuesByName(venues, "Control").map((v) => v.name)).toEqual([
      "Empire Control Room",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterVenuesByName(venues, "Antone's")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const snapshot = [...venues];
    filterVenuesByName(venues, "Mohawk");
    expect(venues).toEqual(snapshot);
  });
});
