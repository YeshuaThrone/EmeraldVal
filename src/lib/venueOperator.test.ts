import { describe, expect, it } from "vitest";
import {
  ATXLiveEngine,
  DEFAULT_CURFEW_RULES,
  blueprintFromProfile,
} from "@/lib/masterSdk";
import { DefaultVenueBlueprint } from "@/lib/venueStudioBlueprint";
import { districtForPoint } from "@/lib/district";
import { deriveVenueStatus } from "@/lib/civic";
import {
  CURFEW_FAMILY_BY_MAP_DISTRICT,
  CURFEW_FAMILY_IDS,
  OPERATOR_MAP_DISTRICT,
  OPERATOR_SEED_PIN,
  OPERATOR_SOUND_BUCKETS,
  applyCurfewEdit,
  curfewFamilyForPoint,
  formatCurfewCountdown,
  secondsToCurfewBoundary,
  venueSoundHistory,
  venueSoundNow,
} from "@/lib/venueOperator";

/** Local-clock date helpers — the engine reads getHours, so tests do too. */
const at = (h: number, m: number, s = 0) => new Date(2026, 9, 7, h, m, s);

const engine = new ATXLiveEngine(blueprintFromProfile(DefaultVenueBlueprint));

describe("seed-district → curfew-family mapping", () => {
  it("maps every map-seed district to a real engine family", () => {
    for (const family of Object.values(CURFEW_FAMILY_BY_MAP_DISTRICT)) {
      expect(DEFAULT_CURFEW_RULES[family]).toBeDefined();
    }
  });

  it("bridges the map classifier's families onto the engine's eight", () => {
    // Mohawk (912 Red River St) classifies Downtown under the coarse seed
    // classifier; its family is the engine's DOWNTOWN rule.
    expect(curfewFamilyForPoint(30.26879, -97.73634)).toBe("DOWNTOWN");
    // Off-map coordinates inherit districtForPoint's honest undefined.
    expect(curfewFamilyForPoint(0, 0)).toBeUndefined();
  });

  it("exposes all eight engine families for the selector", () => {
    expect(CURFEW_FAMILY_IDS).toHaveLength(8);
    expect(CURFEW_FAMILY_IDS).toContain("RED_RIVER");
    expect(CURFEW_FAMILY_IDS).toContain("RAINEY");
  });

  it("finds the operator venue on the seed and classifies it", () => {
    expect(OPERATOR_SEED_PIN).toBeDefined();
    expect(OPERATOR_MAP_DISTRICT).toBe(
      districtForPoint(OPERATOR_SEED_PIN!.lat, OPERATOR_SEED_PIN!.lng),
    );
    expect(OPERATOR_MAP_DISTRICT).toBe("Downtown");
  });
});

describe("client-state-only curfew edit", () => {
  it("returns a new rule and never mutates the engine seed", () => {
    const seedBefore = { ...DEFAULT_CURFEW_RULES.DOWNTOWN };
    const edited = applyCurfewEdit(DEFAULT_CURFEW_RULES.DOWNTOWN, {
      startHour24: 10,
      curfewCapDb: 72,
    });
    expect(edited).not.toBe(DEFAULT_CURFEW_RULES.DOWNTOWN);
    expect(edited.startHour24).toBe(10);
    expect(edited.curfewCapDb).toBe(72);
    // Unedited fields carry over; the seed record is byte-identical.
    expect(edited.endHour24).toBe(seedBefore.endHour24);
    expect(edited.standardCapDb).toBe(seedBefore.standardCapDb);
    expect(edited.district).toBe(DEFAULT_CURFEW_RULES.DOWNTOWN.district);
    expect(DEFAULT_CURFEW_RULES.DOWNTOWN).toEqual(seedBefore);
  });

  it("ignores out-of-range edits instead of inventing clamped values", () => {
    const edited = applyCurfewEdit(DEFAULT_CURFEW_RULES.DOWNTOWN, {
      startHour24: 25,
      endHour24: -1,
      standardCapDb: 10,
      curfewCapDb: Number.NaN,
    });
    expect(edited).toEqual(DEFAULT_CURFEW_RULES.DOWNTOWN);
  });
});

describe("curfew-edit re-derivation through the master engine", () => {
  it("flips state only inside the edited window — seed rule disagrees", () => {
    const edited = applyCurfewEdit(DEFAULT_CURFEW_RULES.DOWNTOWN, {
      startHour24: 10,
      endHour24: 14,
      curfewCapDb: 72,
    });
    const noon = at(12, 0);
    // Seed rule: 12:00 is standard hours at 85 dB.
    expect(
      engine.evaluateCurfewStatus(noon, DEFAULT_CURFEW_RULES.DOWNTOWN),
    ).toEqual({ isCurfewActive: false, effectiveCapDb: 85 });
    // Edited session rule: 12:00 is inside the curfew window at 72 dB.
    expect(engine.evaluateCurfewStatus(noon, edited)).toEqual({
      isCurfewActive: true,
      effectiveCapDb: 72,
    });
  });

  it("keeps the seed's midnight-spanning behavior on the edited caps", () => {
    const edited = applyCurfewEdit(DEFAULT_CURFEW_RULES.RED_RIVER, {
      curfewCapDb: 70,
    });
    const afterMidnight = at(0, 30);
    expect(
      engine.evaluateCurfewStatus(afterMidnight, DEFAULT_CURFEW_RULES.RED_RIVER),
    ).toEqual({ isCurfewActive: true, effectiveCapDb: 75 });
    expect(engine.evaluateCurfewStatus(afterMidnight, edited)).toEqual({
      isCurfewActive: true,
      effectiveCapDb: 70,
    });
  });
});

describe("seconds-to-curfew-boundary", () => {
  it("counts down to curfew start during standard hours", () => {
    // 10:00 → 23:00 start of the DOWNTOWN 23–6 window.
    expect(
      secondsToCurfewBoundary(at(10, 0), DEFAULT_CURFEW_RULES.DOWNTOWN),
    ).toBe(13 * 3600);
    expect(
      secondsToCurfewBoundary(at(22, 30), DEFAULT_CURFEW_RULES.DOWNTOWN),
    ).toBe(30 * 60);
  });

  it("counts down to curfew end inside the window, across midnight", () => {
    // 00:30 → 06:00 end.
    expect(
      secondsToCurfewBoundary(at(0, 30), DEFAULT_CURFEW_RULES.DOWNTOWN),
    ).toBe(5.5 * 3600);
    // 23:30 → tomorrow's 06:00 end.
    expect(
      secondsToCurfewBoundary(at(23, 30), DEFAULT_CURFEW_RULES.DOWNTOWN),
    ).toBe(6.5 * 3600);
  });

  it("tracks daytime windows the same way", () => {
    const daytime = applyCurfewEdit(DEFAULT_CURFEW_RULES.DOWNTOWN, {
      startHour24: 10,
      endHour24: 14,
    });
    expect(secondsToCurfewBoundary(at(12, 0), daytime)).toBe(2 * 3600);
    expect(secondsToCurfewBoundary(at(16, 0), daytime)).toBe(18 * 3600);
  });

  it("agrees with the engine about which side of the boundary we are on", () => {
    for (const hour of [0, 6, 10, 13, 22, 23]) {
      for (const minute of [0, 29, 59]) {
        const now = at(hour, minute);
        const { isCurfewActive } = engine.evaluateCurfewStatus(
          now,
          DEFAULT_CURFEW_RULES.DOWNTOWN,
        );
        const seconds = secondsToCurfewBoundary(
          now,
          DEFAULT_CURFEW_RULES.DOWNTOWN,
        );
        expect(seconds).toBeGreaterThan(0);
        expect(seconds).toBeLessThanOrEqual(24 * 3600);
        // The countdown lands exactly on the hour the state flips at.
        const targetHour = isCurfewActive
          ? DEFAULT_CURFEW_RULES.DOWNTOWN.endHour24
          : DEFAULT_CURFEW_RULES.DOWNTOWN.startHour24;
        const landed = new Date(now.getTime() + seconds * 1000);
        expect(landed.getHours()).toBe(targetHour);
      }
    }
  });
});

describe("countdown formatting", () => {
  it("renders minute precision, hours only when they carry weight", () => {
    expect(formatCurfewCountdown(13 * 3600)).toBe("13h 0m");
    expect(formatCurfewCountdown(6.5 * 3600)).toBe("6h 30m");
    expect(formatCurfewCountdown(30 * 60)).toBe("30m");
  });
});

describe("sound level — admin contract reads", () => {
  it("reads Empire Control Room off the same rows /admin renders", () => {
    expect(venueSoundNow()).toEqual({
      currentDb: 88,
      limitDb: 85,
      status: "OVER_LIMIT",
    });
    expect(deriveVenueStatus(88, 85)).toBe("OVER_LIMIT");
  });

  it("returns null for venues with no admin row rather than guessing", () => {
    // Broken Spoke is on the map seed but has no row in the admin audit
    // contract (its rows: Empire, Far Out, Mohawk, Continental, C-Boy's).
    expect(venueSoundNow("Broken Spoke")).toBeNull();
  });
});

describe("deterministic last-hour trace", () => {
  it("is byte-identical across calls and anchored at the admin reading", () => {
    const first = venueSoundHistory();
    const second = venueSoundHistory();
    expect(first).toEqual(second);
    expect(first).toHaveLength(OPERATOR_SOUND_BUCKETS);
    expect(first[OPERATOR_SOUND_BUCKETS - 1]).toBe(88);
  });

  it("wanders at most ±4 dB around the admin anchor", () => {
    for (const db of venueSoundHistory()) {
      expect(db).toBeGreaterThanOrEqual(84);
      expect(db).toBeLessThanOrEqual(92);
    }
  });

  it("differs by venue but is stable per venue name", () => {
    const mohawk = venueSoundHistory("Mohawk");
    const continental = venueSoundHistory("The Continental Club");
    expect(mohawk).not.toEqual(continental);
    expect(venueSoundHistory("Mohawk")).toEqual(mohawk);
    // Each trace anchors at that venue's own admin-contract reading.
    expect(mohawk[OPERATOR_SOUND_BUCKETS - 1]).toBe(91);
    expect(continental[OPERATOR_SOUND_BUCKETS - 1]).toBe(74);
  });

  it("collapses to an honest empty trace with no row and no anchor", () => {
    expect(venueSoundHistory("Broken Spoke")).toEqual([]);
  });
});
