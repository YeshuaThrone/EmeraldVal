import { describe, expect, it } from "vitest";
import {
  CIVIC_COMPLIANCE_DATA,
  VENUE_AUDIT_ROWS,
  deriveVenueStatus,
  filterVenuesByName,
  type VenueAuditRow,
} from "@/lib/civic";

describe("civic contract figures", () => {
  it("holds active stage utilization at 84.2%", () => {
    expect(CIVIC_COMPLIANCE_DATA.activeStageUtilization).toBe("84.2%");
  });

  it("holds the estimated MBGRT tax yield at $18,450 at the 8.25% daily beverage tax", () => {
    expect(CIVIC_COMPLIANCE_DATA.estMbrtTaxYieldUsd).toBe("$18,450");
    expect(CIVIC_COMPLIANCE_DATA.mbrtTaxRateLabel).toBe(
      "8.25% daily beverage tax",
    );
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
