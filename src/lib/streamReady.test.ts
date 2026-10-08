import { describe, expect, it } from "vitest";
import { CITY_PINS, generateCityPins } from "@/lib/seedData";
import { filterVenues, isStreamReady } from "@/lib/streamReady";

/**
 * Operator Pass O3 (spec art_zVtFFMSp, Move O3) — the seed flag contract.
 *
 * The 5 flagship pilot candidates are the streaming spec's entry list
 * (research doc art_T9l8fSrk, cited from the spec brief). The contract
 * holds: the flag is readable off the seed without mutating anything,
 * carries a key only on flagged entries, and adds no PRNG input, so the
 * byte-stable seed sequence is untouched.
 */
const FLAGGED_VENUES = [
  "Mohawk",
  "Stubb's Bar-B-Q",
  "Antone's Nightclub",
  "ACL Live at the Moody Theater",
  "Continental Club",
];

describe("stream-ready seed flag contract", () => {
  it("flags exactly the 5 flagship pilot venues on CITY_PINS", () => {
    const flagged = CITY_PINS.filter(isStreamReady);
    expect(flagged.map((pin) => pin.performerName).sort()).toEqual(
      [...FLAGGED_VENUES].sort(),
    );
  });

  it("leaves the flag off every other pin — no key at all, not just falsy", () => {
    for (const pin of CITY_PINS) {
      if (!FLAGGED_VENUES.includes(pin.performerName)) {
        expect(Object.hasOwn(pin, "streamReady")).toBe(false);
        expect(isStreamReady(pin)).toBe(false);
      }
    }
  });

  it("is deterministic: two generateCityPins() calls project identical flags", () => {
    const project = (pins: ReturnType<typeof generateCityPins>) =>
      pins.map((pin) => ({ performerName: pin.performerName, streamReady: isStreamReady(pin) }));
    expect(project(generateCityPins())).toEqual(project(generateCityPins()));
  });

  it("is readable without mutation: reads and filters never touch the seed", () => {
    const before = JSON.stringify(CITY_PINS);
    filterVenues(CITY_PINS, { streamReadyOnly: true });
    filterVenues(CITY_PINS, { streamReadyOnly: false, district: "East" });
    for (const pin of CITY_PINS) {
      isStreamReady(pin);
    }
    expect(JSON.stringify(CITY_PINS)).toBe(before);
  });
});

describe("filterVenues — operator console filter logic", () => {
  it("with streamReadyOnly returns only camera-ready venues", () => {
    const result = filterVenues(CITY_PINS, { streamReadyOnly: true });
    expect(result.length).toBeGreaterThan(0);
    for (const pin of result) {
      expect(isStreamReady(pin)).toBe(true);
    }
  });

  it("with an empty filter returns the whole seed, as a new array", () => {
    const result = filterVenues(CITY_PINS, { streamReadyOnly: false });
    expect(result).not.toBe(CITY_PINS);
    expect(result.length).toBe(CITY_PINS.length);
  });

  it("composes readiness with a district filter", () => {
    const result = filterVenues(CITY_PINS, {
      streamReadyOnly: true,
      district: "Downtown",
    });
    for (const pin of result) {
      expect(isStreamReady(pin)).toBe(true);
      expect(pin.district).toBe("Downtown");
    }
    // Every readiness-filtered pin is accounted for: nothing lost, only narrowed.
    const allReady = filterVenues(CITY_PINS, { streamReadyOnly: true });
    expect(allReady.length).toBeGreaterThanOrEqual(result.length);
  });
});
