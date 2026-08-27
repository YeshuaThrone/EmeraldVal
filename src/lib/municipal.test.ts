import { describe, expect, it } from "vitest";
import { CITY_PINS } from "@/lib/seedData";
import {
  ACTIVE_FANS,
  ACTIVE_VENUE_COUNT,
  COUNCIL_DISTRICT_SHOW_DENSITY,
  DISTRICT_SOUND_DENSITY_INDEX,
  LOCAL_ARTIST_SHARE_PERCENT,
  MUNICIPAL_DATA,
  NIGHTTIME_ECONOMY_IMPACT_USD,
  OUTDOOR_STAGES,
  classifyDecibel,
} from "@/lib/municipal";

describe("municipal contract figures", () => {
  it("holds the citywide real-time foot traffic figure at 14,280 active fans", () => {
    expect(ACTIVE_FANS).toBe(14280);
  });

  it("derives the active venue count from CITY_PINS, currently 36", () => {
    expect(ACTIVE_VENUE_COUNT).toBe(CITY_PINS.length);
    expect(ACTIVE_VENUE_COUNT).toBe(36);
  });

  it("holds the local artist economic share at 78.4%", () => {
    expect(LOCAL_ARTIST_SHARE_PERCENT).toBe(78.4);
  });

  it("holds the estimated nighttime economy impact at $142,500", () => {
    expect(NIGHTTIME_ECONOMY_IMPACT_USD).toBe(142500);
  });
});

describe("DISTRICT_SOUND_DENSITY_INDEX", () => {
  it("lists exactly the four contract districts with their index values", () => {
    expect(DISTRICT_SOUND_DENSITY_INDEX).toEqual([
      { district: "Downtown", indexPercent: 92 },
      { district: "East Austin", indexPercent: 64 },
      { district: "South Congress", indexPercent: 81 },
      { district: "North Loop", indexPercent: 45 },
    ]);
  });

  it("keeps every index value within a valid 0-100 percent range", () => {
    for (const entry of DISTRICT_SOUND_DENSITY_INDEX) {
      expect(entry.indexPercent).toBeGreaterThanOrEqual(0);
      expect(entry.indexPercent).toBeLessThanOrEqual(100);
    }
  });
});

describe("COUNCIL_DISTRICT_SHOW_DENSITY", () => {
  it("lists exactly council districts 1 (East), 3 (Southeast), 9 (Downtown/UT), 5 (South)", () => {
    expect(COUNCIL_DISTRICT_SHOW_DENSITY.map((d) => d.number)).toEqual([
      1, 3, 9, 5,
    ]);
    expect(COUNCIL_DISTRICT_SHOW_DENSITY.map((d) => d.name)).toEqual([
      "East",
      "Southeast",
      "Downtown/UT",
      "South",
    ]);
  });

  it("keeps every show density value within a valid 0-100 range", () => {
    for (const entry of COUNCIL_DISTRICT_SHOW_DENSITY) {
      expect(entry.showDensity).toBeGreaterThanOrEqual(0);
      expect(entry.showDensity).toBeLessThanOrEqual(100);
    }
  });

  it("has no duplicate district numbers", () => {
    const numbers = COUNCIL_DISTRICT_SHOW_DENSITY.map((d) => d.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("OUTDOOR_STAGES", () => {
  it("includes at least one stage in each compliance state (Compliant, Warning, Over Limit)", () => {
    const statuses = new Set(
      OUTDOOR_STAGES.map((stage) =>
        classifyDecibel(stage.currentDb, stage.zoningLimitDb),
      ),
    );
    expect(statuses).toEqual(
      new Set(["Compliant", "Warning", "Over Limit"]),
    );
  });

  it("gives every stage a name, district, current dB, and zoning limit", () => {
    for (const stage of OUTDOOR_STAGES) {
      expect(stage.name.length).toBeGreaterThan(0);
      expect(stage.district.length).toBeGreaterThan(0);
      expect(typeof stage.currentDb).toBe("number");
      expect(typeof stage.zoningLimitDb).toBe("number");
    }
  });
});

describe("classifyDecibel", () => {
  it("classifies a reading below the warning band as Compliant", () => {
    // 3dB is the warning margin; anything more than 3dB under the limit
    // is comfortably Compliant.
    expect(classifyDecibel(70, 85)).toBe("Compliant");
  });

  it("classifies a reading exactly at the warning margin as Warning", () => {
    expect(classifyDecibel(82, 85)).toBe("Warning");
  });

  it("classifies a reading between the warning margin and the limit as Warning", () => {
    expect(classifyDecibel(84, 85)).toBe("Warning");
  });

  it("classifies a reading exactly at the zoning limit as Warning, not Over Limit", () => {
    expect(classifyDecibel(85, 85)).toBe("Warning");
  });

  it("classifies a reading one dB over the limit as Over Limit", () => {
    expect(classifyDecibel(86, 85)).toBe("Over Limit");
  });

  it("classifies a reading far over the limit as Over Limit", () => {
    expect(classifyDecibel(100, 85)).toBe("Over Limit");
  });

  it("matches independently computed expectations for every seeded stage", () => {
    const expected: Record<string, "Compliant" | "Warning" | "Over Limit"> = {
      "Waterloo Park Main Stage": "Over Limit", // 88 > 85
      "Rainey Street Amphitheater": "Warning", // 83 is within 3dB of 85
      "South Congress Plaza": "Compliant", // 74 is more than 3dB under 80
      "Red River Block Stage": "Over Limit", // 91 > 85
      "North Loop Green": "Compliant", // 62 is more than 3dB under 75
    };

    for (const stage of OUTDOOR_STAGES) {
      expect(classifyDecibel(stage.currentDb, stage.zoningLimitDb)).toBe(
        expected[stage.name],
      );
    }
  });
});

describe("MUNICIPAL_DATA", () => {
  it("aggregates every contract figure under a single import surface", () => {
    expect(MUNICIPAL_DATA).toEqual({
      activeFans: ACTIVE_FANS,
      activeVenueCount: ACTIVE_VENUE_COUNT,
      localArtistSharePercent: LOCAL_ARTIST_SHARE_PERCENT,
      nighttimeEconomyImpactUsd: NIGHTTIME_ECONOMY_IMPACT_USD,
      districtSoundDensityIndex: DISTRICT_SOUND_DENSITY_INDEX,
      councilDistrictShowDensity: COUNCIL_DISTRICT_SHOW_DENSITY,
      outdoorStages: OUTDOOR_STAGES,
    });
  });
});
