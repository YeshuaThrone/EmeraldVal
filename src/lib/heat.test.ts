import { describe, expect, it } from "vitest";
import { AUSTIN_BOUNDS } from "@/lib/constants";
import {
  CORRIDOR_META,
  CORRIDORS,
  corridorPointCount,
  generateHeatPoints,
  impliedCrowdSize,
  MIN_PEOPLE_FOR_HEAT,
  type CorridorName,
} from "@/lib/heat";
import { CITY_PINS } from "@/lib/seedData";

const EXPECTED_CORRIDOR_NAMES: CorridorName[] = [
  "6th Street",
  "Red River Cultural District",
  "Rainey Street",
  "South Congress",
  "East 12th Street",
];

describe("CORRIDOR_META", () => {
  it("exposes exactly the five named Austin cultural corridors", () => {
    expect(CORRIDOR_META.map((corridor) => corridor.name).sort()).toEqual(
      [...EXPECTED_CORRIDOR_NAMES].sort(),
    );
  });

  it("gives every corridor a weight in (0, 1]", () => {
    for (const corridor of CORRIDOR_META) {
      expect(corridor.weight).toBeGreaterThan(0);
      expect(corridor.weight).toBeLessThanOrEqual(1);
    }
  });
});

describe("generateHeatPoints", () => {
  it("is deterministic for a fixed seed: repeated calls are identical", () => {
    const first = generateHeatPoints();
    const second = generateHeatPoints();
    expect(second).toEqual(first);
  });

  it("places every point within AUSTIN_BOUNDS", () => {
    const [[minLat, minLng], [maxLat, maxLng]] = AUSTIN_BOUNDS;
    for (const point of generateHeatPoints()) {
      expect(point.lat).toBeGreaterThanOrEqual(minLat);
      expect(point.lat).toBeLessThanOrEqual(maxLat);
      expect(point.lng).toBeGreaterThanOrEqual(minLng);
      expect(point.lng).toBeLessThanOrEqual(maxLng);
    }
  });

  it("covers all five corridors by name", () => {
    const seen = new Set(
      generateHeatPoints()
        .map((point) => point.corridor)
        .filter((name): name is CorridorName => Boolean(name)),
    );
    for (const name of EXPECTED_CORRIDOR_NAMES) {
      expect(seen.has(name)).toBe(true);
    }
  });

  it("keeps every intensity within (0, 1]", () => {
    for (const point of generateHeatPoints()) {
      expect(point.intensity).toBeGreaterThan(0);
      expect(point.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("produces a sensible point count: corridor points + one per live pin, independently computed", () => {
    const expectedCorridorPoints = CORRIDORS.reduce(
      (sum, corridor) => sum + corridorPointCount(corridor.weight),
      0,
    );
    const expectedLivePoints = CITY_PINS.filter((pin) => pin.source === "live").length;

    expect(expectedCorridorPoints).toBeGreaterThan(0);
    expect(expectedLivePoints).toBeGreaterThan(0);
    expect(generateHeatPoints().length).toBe(expectedCorridorPoints + expectedLivePoints);
  });

  it("reflects the currently-visible pins passed in, not always the full CITY_PINS set", () => {
    const noLivePins = CITY_PINS.filter((pin) => pin.source !== "live");
    const points = generateHeatPoints(noLivePins);
    const corridorOnlyPoints = points.filter((point) => point.corridor !== undefined);

    // Every point still comes from a corridor (the baseline is filter-independent);
    // none are blended-in live-pin points, since none were passed.
    expect(corridorOnlyPoints.length).toBe(points.length);
  });

  it("blends in exactly one heat point per live pin when the full seed is passed", () => {
    const livePinCount = CITY_PINS.filter((pin) => pin.source === "live").length;
    const points = generateHeatPoints(CITY_PINS);
    const blendedPoints = points.filter((point) => point.corridor === undefined);
    expect(blendedPoints.length).toBe(livePinCount);
  });
});

describe("crowd floor (MIN_PEOPLE_FOR_HEAT)", () => {
  it("maps heat intensity onto the stylized 0–100 crowd scale", () => {
    expect(impliedCrowdSize(1)).toBe(100);
    expect(impliedCrowdSize(0.05)).toBe(5);
    expect(impliedCrowdSize(0.04)).toBe(4);
  });

  it("keeps every generated point at or above the 5-person crowd floor", () => {
    const points = generateHeatPoints(CITY_PINS);
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(impliedCrowdSize(point.intensity)).toBeGreaterThanOrEqual(MIN_PEOPLE_FOR_HEAT);
    }
  });

  it("drops a sub-floor point while keeping one exactly at the floor", () => {
    const quiet = { lat: 30.27, lng: -97.74, intensity: 0.04 }; // 4 people
    const atFloor = { lat: 30.27, lng: -97.74, intensity: 0.05 }; // 5 people
    const filtered = [quiet, atFloor].filter(
      (point) => impliedCrowdSize(point.intensity) >= MIN_PEOPLE_FOR_HEAT,
    );
    expect(filtered).toEqual([atFloor]);
  });
});
