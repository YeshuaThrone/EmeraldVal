import { describe, expect, it } from "vitest";
import { AUSTIN_BOUNDS } from "@/lib/constants";
import { CITY_PINS, generateCityPins } from "@/lib/seedData";
import { DROPPED_SOURCES } from "@/lib/filters";
import { GENRES, type District } from "@/lib/types";

const VALID_DISTRICTS: District[] = ["Downtown", "North", "South", "East", "West"];

describe("CITY_PINS seed validity", () => {
  it("has at least 30 venues", () => {
    expect(CITY_PINS.length).toBeGreaterThanOrEqual(30);
  });

  it("places every pin inside AUSTIN_BOUNDS", () => {
    const [[minLat, minLng], [maxLat, maxLng]] = AUSTIN_BOUNDS;
    for (const pin of CITY_PINS) {
      expect(pin.lat).toBeGreaterThanOrEqual(minLat);
      expect(pin.lat).toBeLessThanOrEqual(maxLat);
      expect(pin.lng).toBeGreaterThanOrEqual(minLng);
      expect(pin.lng).toBeLessThanOrEqual(maxLng);
    }
  });

  it("assigns only valid District values", () => {
    for (const pin of CITY_PINS) {
      expect(pin.district).toBeDefined();
      expect(VALID_DISTRICTS).toContain(pin.district);
    }
  });

  it("represents all five districts", () => {
    const seen = new Set(CITY_PINS.map((pin) => pin.district));
    for (const district of VALID_DISTRICTS) {
      expect(seen.has(district)).toBe(true);
    }
  });

  it("represents every genre in GENRES", () => {
    const seen = new Set(CITY_PINS.map((pin) => pin.genre));
    for (const genre of GENRES) {
      expect(seen.has(genre)).toBe(true);
    }
  });

  it("has both a live and a dropped presence in the source mix", () => {
    const liveCount = CITY_PINS.filter((pin) => pin.source === "live").length;
    const droppedCount = CITY_PINS.filter((pin) =>
      DROPPED_SOURCES.includes(pin.source),
    ).length;
    expect(liveCount).toBeGreaterThan(0);
    expect(droppedCount).toBeGreaterThan(0);
    expect(liveCount + droppedCount).toBe(CITY_PINS.length);
  });

  it("is deterministic: generateCityPins() called twice produces identical output", () => {
    const first = generateCityPins();
    const second = generateCityPins();
    expect(second).toEqual(first);
  });
});
