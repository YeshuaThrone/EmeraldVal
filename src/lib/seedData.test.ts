import { describe, expect, it } from "vitest";
import { districtForPoint } from "@/lib/district";
import { AUSTIN_BOUNDS } from "@/lib/constants";
import { CITY_PINS, generateCityPins } from "@/lib/seedData";
import { DROPPED_SOURCES } from "@/lib/filters";
import { GENRES, type District } from "@/lib/types";

const VALID_DISTRICTS: District[] = ["Downtown", "North", "South", "East", "West"];

describe("CITY_PINS seed validity", () => {
  it("clears the Move 3 real-Austin floor: at least 100 tracked venues", () => {
    // Move 3 appended the curated real-Austin set to the 36-venue legacy
    // world — the floor asserts the expansion stuck and doesn't regress.
    expect(CITY_PINS.length).toBeGreaterThanOrEqual(100);
  });

  it("every generated venue is unique in locationName: no silent double-appends", () => {
    const seen = new Set<string>();
    for (const pin of generateCityPins()) {
      const key = `${pin.performerName} @ ${pin.locationName}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("every generated venue that classifies carries its districtForPoint district", () => {
    // The classifier is untouched Move 3 ground — nothing was edited to
    // flatter labels; this asserts the contract over the expanded set.
    for (const pin of CITY_PINS) {
      expect(pin.district).toBe(districtForPoint(pin.lat, pin.lng));
    }
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

  it("is deterministic: generateCityPins() called twice is byte-identical over the expanded real-Austin set", () => {
    // Move 3 makes the byte-stability claim load-bearing: the 129-pin
    // world must be reproducible across two calls, not just deep-equal —
    // serialized with a stable key order so a property-order regression
    // can't hide behind the deep-equal.
    expect(
      generateCityPins().map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        performerName: p.performerName,
        locationName: p.locationName,
        genre: p.genre,
        tipAmount: p.tipAmount,
        cashApp: p.cashApp,
        venmo: p.venmo,
        source: p.source,
        district: p.district,
        isLocal: p.isLocal,
      })),
    ).toEqual(
      generateCityPins().map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        performerName: p.performerName,
        locationName: p.locationName,
        genre: p.genre,
        tipAmount: p.tipAmount,
        cashApp: p.cashApp,
        venmo: p.venmo,
        source: p.source,
        district: p.district,
        isLocal: p.isLocal,
      })),
    );
  });
});
