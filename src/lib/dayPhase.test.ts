import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ctLocalMinutesFor,
  dayPhaseFor,
  getDayPhaseServerSnapshot,
  getDayPhaseSnapshot,
  hydrateDayPhaseModeFromStorage,
  readDayPhaseMode,
  resetDayPhaseForTests,
  resolvePhase,
  setDayPhaseClockSource,
  setDayPhaseMode,
  subscribeToDayPhase,
  syncDayPhase,
  writeDayPhaseMode,
  type DayPhaseClockSource,
} from "./dayPhase";

/**
 * Contract tests for the Skylight day-phase engine. The clock is injected
 * (never Date.now()), so every boundary is deterministic regardless of when
 * the suite runs — the same discipline minuteClock.test.ts uses with fake
 * timers, exercised here through the injectable source seam.
 */

/** Controllable clock source: set `now` manually, then tick() notifies. */
function fakeClock(startEpochMs: number): {
  source: DayPhaseClockSource;
  tick: (to: number) => void;
  setNow: (to: number) => void;
} {
  let now = startEpochMs;
  const listeners = new Set<() => void>();
  return {
    source: {
      getNow: () => now,
      subscribe: (onStoreChange) => {
        listeners.add(onStoreChange);
        return () => {
          listeners.delete(onStoreChange);
        };
      },
    },
    setNow: (to) => {
      now = to;
    },
    tick: (to) => {
      now = to;
      for (const listener of listeners) listener();
    },
  };
}

/** Minimal in-memory storage — structural, so no DOM environment needed. */
function memoryStorage(): {
  storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
  read: () => string | null;
} {
  const map = new Map<string, string>();
  return {
    storage: {
      getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
      setItem: (key, value) => void map.set(key, String(value)),
    },
    read: () => (map.has("atxlive.day-phase-mode") ? (map.get("atxlive.day-phase-mode") as string) : null),
  };
}

// Fixed-offset model: CT = UTC-6. Test instants are stated in UTC with their
// CT wall-clock equivalents; January dates sit in the CST season the constant
// models exactly.
const CT = {
  "06:59": Date.UTC(2026, 0, 15, 12, 59),
  "07:00": Date.UTC(2026, 0, 15, 13, 0),
  noon: Date.UTC(2026, 0, 15, 18, 0),
  "18:59": Date.UTC(2026, 0, 16, 0, 59),
  "19:00": Date.UTC(2026, 0, 16, 1, 0),
  midnight: Date.UTC(2026, 0, 16, 6, 0),
} as const;

describe("dayPhaseFor — America/Chicago boundaries (fixed-offset)", () => {
  it("06:59 CT is night, 07:00 CT is day", () => {
    expect(dayPhaseFor(CT["06:59"])).toBe("night");
    expect(dayPhaseFor(CT["07:00"])).toBe("day");
  });

  it("18:59 CT is day, 19:00 CT is night", () => {
    expect(dayPhaseFor(CT["18:59"])).toBe("day");
    expect(dayPhaseFor(CT["19:00"])).toBe("night");
  });

  it("mid-day is day and midnight is night", () => {
    expect(dayPhaseFor(CT.noon)).toBe("day");
    expect(dayPhaseFor(CT.midnight)).toBe("night");
  });

  it("ctLocalMinutesFor maps 13:00 UTC to 07:00 CT (420 minutes)", () => {
    expect(ctLocalMinutesFor(CT["07:00"])).toBe(420);
    expect(ctLocalMinutesFor(CT["06:59"])).toBe(419);
    expect(ctLocalMinutesFor(CT["19:00"])).toBe(1140);
  });

  it("is stable within a minute window (same instant, same phase)", () => {
    expect(dayPhaseFor(CT["07:00"])).toBe(dayPhaseFor(CT["07:00"]));
  });
});

describe("resolvePhase — override precedence", () => {
  it("day and night overrides beat the clock", () => {
    expect(resolvePhase("night", "day")).toBe("day");
    expect(resolvePhase("day", "night")).toBe("night");
  });

  it("auto defers to the clock", () => {
    expect(resolvePhase("day", "auto")).toBe("day");
    expect(resolvePhase("night", "auto")).toBe("night");
  });
});

describe("override persistence — localStorage round-trip", () => {
  it("write then read round-trips every mode", () => {
    const ms = memoryStorage();
    for (const value of ["day", "night", "auto"] as const) {
      writeDayPhaseMode(value, ms.storage);
      expect(ms.read()).toBe(value);
      expect(readDayPhaseMode(ms.storage)).toBe(value);
    }
  });

  it("corrupt or missing stored values fall back to auto", () => {
    const bogus = { getItem: () => "purple" };
    expect(readDayPhaseMode(bogus)).toBe("auto");
    const missing = { getItem: () => null };
    expect(readDayPhaseMode(missing)).toBe("auto");
  });
});

describe("day-phase store — minuteClock discipline with injected clock", () => {
  beforeEach(() => {
    resetDayPhaseForTests();
  });

  afterEach(() => {
    resetDayPhaseForTests();
    vi.restoreAllMocks();
  });

  it("snapshot identity is stable within a minute window and changes only on a real phase change", () => {
    const clock = fakeClock(CT["07:00"]);
    setDayPhaseClockSource(clock.source);
    const unsub = subscribeToDayPhase(() => {});

    const first = getDayPhaseSnapshot();
    expect(first.phase).toBe("day");
    // React's render check re-reads getSnapshot many times per commit; the
    // same object must come back every time within the window.
    expect(getDayPhaseSnapshot()).toBe(first);
    expect(getDayPhaseSnapshot()).toBe(first);

    let notifications = 0;
    const unsubSecond = subscribeToDayPhase(() => {
      notifications += 1;
    });

    // 07:00 -> 07:01: the tick advances, the phase does not, so no notify
    // and the cached snapshot object survives.
    clock.tick(CT["07:00"] + 60_000);
    expect(getDayPhaseSnapshot()).toBe(first);
    expect(notifications).toBe(0);

    // Next day 19:00 CT: night — exactly one new snapshot, one notification.
    clock.tick(Date.UTC(2026, 0, 16, 1, 0));
    const second = getDayPhaseSnapshot();
    expect(second).not.toBe(first);
    expect(second.phase).toBe("night");
    expect(notifications).toBe(1);

    unsub();
    unsubSecond();
  });

  it("auto mode tracks the clock across the 06:59 -> 07:00 boundary", () => {
    const clock = fakeClock(CT["06:59"]);
    setDayPhaseClockSource(clock.source);
    const unsub = subscribeToDayPhase(() => {});

    expect(getDayPhaseSnapshot().phase).toBe("night");
    clock.tick(CT["07:00"]);
    expect(getDayPhaseSnapshot().phase).toBe("day");

    unsub();
  });

  it("day/night overrides beat the clock; auto returns to clock phase", () => {
    const clock = fakeClock(CT["19:00"]); // night
    setDayPhaseClockSource(clock.source);
    const unsub = subscribeToDayPhase(() => {});
    const onNotify = vi.fn();
    const unsubNotify = subscribeToDayPhase(onNotify);

    expect(getDayPhaseSnapshot().phase).toBe("night");

    setDayPhaseMode("day");
    expect(getDayPhaseSnapshot().phase).toBe("day");
    // The clock flips to day underneath the override — phase holds at day.
    clock.tick(Date.UTC(2026, 0, 16, 13, 0)); // 07:00 CT next cycle
    expect(getDayPhaseSnapshot().phase).toBe("day");

    setDayPhaseMode("night");
    expect(getDayPhaseSnapshot().phase).toBe("night");

    setDayPhaseMode("auto");
    expect(getDayPhaseSnapshot().phase).toBe("day"); // clock now says day
    expect(getDayPhaseSnapshot().mode).toBe("auto");
    expect(getDayPhaseSnapshot().autoPhase).toBe("day");

    expect(onNotify).toHaveBeenCalled();

    unsub();
    unsubNotify();
  });

  it("setDayPhaseMode to the current mode does not notify", () => {
    const clock = fakeClock(CT["07:00"]);
    setDayPhaseClockSource(clock.source);
    const onNotify = vi.fn();
    const unsub = subscribeToDayPhase(onNotify);

    setDayPhaseMode("auto"); // already auto
    expect(onNotify).not.toHaveBeenCalled();

    unsub();
  });

  it("hydrateDayPhaseModeFromStorage applies a persisted override and notifies", () => {
    const clock = fakeClock(CT["19:00"]); // night
    setDayPhaseClockSource(clock.source);
    const ms = memoryStorage();
    writeDayPhaseMode("day", ms.storage);

    const onNotify = vi.fn();
    const unsub = subscribeToDayPhase(onNotify);
    expect(getDayPhaseSnapshot().mode).toBe("auto");

    hydrateDayPhaseModeFromStorage(ms.storage);
    expect(getDayPhaseSnapshot().mode).toBe("day");
    expect(getDayPhaseSnapshot().phase).toBe("day");
    expect(onNotify).toHaveBeenCalledTimes(1);

    unsub();
  });

  it("hydrate is a no-op when storage holds auto", () => {
    const clock = fakeClock(CT["07:00"]);
    setDayPhaseClockSource(clock.source);
    const ms = memoryStorage();
    writeDayPhaseMode("auto", ms.storage);

    const onNotify = vi.fn();
    const unsub = subscribeToDayPhase(onNotify);
    const before = getDayPhaseSnapshot();

    hydrateDayPhaseModeFromStorage(ms.storage);
    expect(getDayPhaseSnapshot()).toBe(before);
    expect(onNotify).not.toHaveBeenCalled();

    unsub();
  });

  it("unsubscribing stops listener notifications", () => {
    const clock = fakeClock(CT["07:00"]);
    setDayPhaseClockSource(clock.source);
    const onNotify = vi.fn();
    const unsub = subscribeToDayPhase(onNotify);
    unsub();

    clock.tick(CT["19:00"]);
    expect(onNotify).not.toHaveBeenCalled();
  });

  it("syncDayPhase re-syncs against the current clock after an unobserved gap", () => {
    const clock = fakeClock(CT["07:00"]);
    setDayPhaseClockSource(clock.source);
    const unsubFirst = subscribeToDayPhase(() => {});
    const seeded = getDayPhaseSnapshot(); // first read seeds the day phase
    expect(seeded.phase).toBe("day");
    unsubFirst();

    // Time passes while nobody listens, crossing into night. The clock does
    // not tick for absent listeners, so the store needs an explicit re-sync
    // — exactly what the hook's mount effect runs.
    clock.setNow(CT["19:00"]);
    const onNotify = vi.fn();
    const unsubSecond = subscribeToDayPhase(onNotify);
    expect(onNotify).not.toHaveBeenCalled(); // subscribing never notifies

    syncDayPhase();
    expect(getDayPhaseSnapshot().phase).toBe("night");
    expect(onNotify).toHaveBeenCalledTimes(1);

    unsubSecond();
  });

  it("server snapshot is the night fallback with auto mode, identity-stable", () => {
    expect(getDayPhaseServerSnapshot()).toBe(getDayPhaseServerSnapshot());
    expect(getDayPhaseServerSnapshot()).toEqual({
      phase: "night",
      autoPhase: "night",
      mode: "auto",
    });
  });
});
