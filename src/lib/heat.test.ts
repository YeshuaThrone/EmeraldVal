import { describe, expect, it } from "vitest";
import { AUSTIN_BOUNDS } from "@/lib/constants";
import {
  CORRIDOR_META,
  CORRIDORS,
  corridorPointCount,
  generateHeatPoints,
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
