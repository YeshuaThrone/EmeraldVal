import { describe, expect, it } from "vitest";
import { CITY_PINS, generateCityPins } from "@/lib/seedData";
import { filterVenues, isStreamReady } from "@/lib/streamReady";

/**
 * Operator Pass O3 (spec art_zVtFFMSp, Move O3) — the seed flag contract.
 *
 * Founder-locked canon (2026-10-09): the seed is the 36-venue f6ec82b
 * world, and the 5-flagship pilot list (Mohawk, Stubb's Bar-B-Q, Antone's,
 * ACL Live at the Moody Theater, Continental Club) rode the rejected
 * expanded-venue seed out with it. The pass-through flag, the readiness
 * helpers, and the operator console filter all remain — the canon seed
 * simply flags nothing, so the flag mechanics are exercised below with
 * synthetic pins instead of seeded ones.
 */

describe("stream-ready seed flag contract", () => {
  it("carries no seeded streamReady flags on the 36-venue canon seed", () => {
    expect(CITY_PINS.filter(isStreamReady)).toEqual([]);
    for (const pin of CITY_PINS) {
      expect(Object.hasOwn(pin, "streamReady")).toBe(false);
    }
  });

  it("is a pass-through flag: keyed only where a venue template flags it", () => {
    const base = CITY_PINS[0];
    const flagged = { ...base, id: "synthetic-ready", streamReady: true };
    expect(Object.hasOwn(flagged, "streamReady")).toBe(true);
    expect(isStreamReady(flagged)).toBe(true);
    expect(Object.hasOwn(base, "streamReady")).toBe(false);
    expect(isStreamReady(base)).toBe(false);
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
    const ready = { ...CITY_PINS[0], id: "synthetic-ready", streamReady: true };
    const plain = { ...CITY_PINS[1], id: "synthetic-plain" };
    const result = filterVenues([ready, plain], { streamReadyOnly: true });
    expect(result.map((pin) => pin.id)).toEqual(["synthetic-ready"]);
    for (const pin of result) {
      expect(isStreamReady(pin)).toBe(true);
    }
  });

  it("with an empty filter returns the whole input, as a new array", () => {
    const result = filterVenues(CITY_PINS, { streamReadyOnly: false });
    expect(result).not.toBe(CITY_PINS);
    expect(result.length).toBe(CITY_PINS.length);
  });

  it("composes readiness with a district filter", () => {
    const readyDowntown = {
      ...CITY_PINS[0],
      id: "synthetic-ready-dt",
      streamReady: true,
    };
    const readyEast = {
      ...CITY_PINS.find((pin) => pin.district === "East")!,
      id: "synthetic-ready-east",
      streamReady: true,
    };
    const result = filterVenues([readyDowntown, readyEast], {
      streamReadyOnly: true,
      district: "Downtown",
    });
    // Every readiness-filtered pin is accounted for: nothing lost, only narrowed.
    expect(result.map((pin) => pin.id)).toEqual(["synthetic-ready-dt"]);
    for (const pin of result) {
      expect(isStreamReady(pin)).toBe(true);
      expect(pin.district).toBe("Downtown");
    }
  });
});
