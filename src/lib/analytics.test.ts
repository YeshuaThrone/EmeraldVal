import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  genreDistribution,
  liveNowCount,
  localVsTouringSplit,
  summarizeAnalytics,
  totalVenues,
  unspecifiedGenreCount,
  venuesByDistrict,
} from "@/lib/analytics";
import { CITY_PINS } from "@/lib/seedData";
import { GENRES } from "@/lib/types";

// Independently computed expectations via reduce over CITY_PINS, so the
// analytics module is verified against the seed rather than against itself.

describe("totalVenues", () => {
  it("matches CITY_PINS.length", () => {
    expect(totalVenues(CITY_PINS)).toBe(CITY_PINS.length);
  });
});

describe("liveNowCount", () => {
  it("matches an independent count of source === 'live'", () => {
    const expected = CITY_PINS.reduce(
      (count, pin) => (pin.source === "live" ? count + 1 : count),
      0,
    );
    expect(liveNowCount(CITY_PINS)).toBe(expected);
    expect(liveNowCount(CITY_PINS)).toBeGreaterThan(0);
  });
});

describe("venuesByDistrict", () => {
  it("matches an independent per-district tally and has all five keys", () => {
    const expected = CITY_PINS.reduce<Record<string, number>>((acc, pin) => {
      if (pin.district) {
        acc[pin.district] = (acc[pin.district] ?? 0) + 1;
      }
      return acc;
    }, {});

    const result = venuesByDistrict(CITY_PINS);

    for (const district of DISTRICTS) {
      expect(result[district]).toBe(expected[district] ?? 0);
    }
    expect(Object.keys(result).sort()).toEqual([...DISTRICTS].sort());

    const totalDistricted = Object.values(result).reduce((a, b) => a + b, 0);
    expect(totalDistricted).toBe(
      CITY_PINS.filter((pin) => pin.district !== undefined).length,
    );
  });

  it("zero-fills a district with no venues", () => {
    const result = venuesByDistrict([]);
    for (const district of DISTRICTS) {
      expect(result[district]).toBe(0);
    }
  });
});

describe("genreDistribution", () => {
  it("matches an independent per-genre tally and has all five keys", () => {
    const expected = CITY_PINS.reduce<Record<string, number>>((acc, pin) => {
      if (pin.genre !== "") {
        acc[pin.genre] = (acc[pin.genre] ?? 0) + 1;
      }
      return acc;
    }, {});

    const result = genreDistribution(CITY_PINS);

    for (const genre of GENRES) {
      expect(result[genre]).toBe(expected[genre] ?? 0);
    }
    expect(Object.keys(result).sort()).toEqual([...GENRES].sort());
  });
});

describe("unspecifiedGenreCount", () => {
  it("matches an independent count of genre === ''", () => {
    const expected = CITY_PINS.filter((pin) => pin.genre === "").length;
    expect(unspecifiedGenreCount(CITY_PINS)).toBe(expected);
  });
});

describe("localVsTouringSplit", () => {
  it("matches an independent tri-state tally over isLocal", () => {
    const expected = CITY_PINS.reduce(
      (acc, pin) => {
        if (pin.isLocal === true) acc.local += 1;
        else if (pin.isLocal === false) acc.touring += 1;
        else acc.unspecified += 1;
        return acc;
      },
      { local: 0, touring: 0, unspecified: 0 },
    );

    expect(localVsTouringSplit(CITY_PINS)).toEqual(expected);
    expect(
      expected.local + expected.touring + expected.unspecified,
    ).toBe(CITY_PINS.length);
  });
});

describe("summarizeAnalytics", () => {
  it("bundles every metric consistently for CITY_PINS", () => {
    const summary = summarizeAnalytics(CITY_PINS);

    expect(summary.totalVenues).toBe(totalVenues(CITY_PINS));
    expect(summary.liveNowCount).toBe(liveNowCount(CITY_PINS));
    expect(summary.venuesByDistrict).toEqual(venuesByDistrict(CITY_PINS));
    expect(summary.genreDistribution).toEqual(genreDistribution(CITY_PINS));
    expect(summary.unspecifiedGenreCount).toBe(
      unspecifiedGenreCount(CITY_PINS),
    );
    expect(summary.localVsTouring).toEqual(localVsTouringSplit(CITY_PINS));
  });

  it("returns all-zero metrics for an empty pin set", () => {
    const summary = summarizeAnalytics([]);
    expect(summary.totalVenues).toBe(0);
    expect(summary.liveNowCount).toBe(0);
    expect(summary.unspecifiedGenreCount).toBe(0);
    expect(summary.localVsTouring).toEqual({
      local: 0,
      touring: 0,
      unspecified: 0,
    });
  });
});
