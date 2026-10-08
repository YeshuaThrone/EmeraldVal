import { afterEach, describe, expect, it } from "vitest";
import {
  DAY_PHASE_DAY_CLASS,
  DAY_PHASE_NIGHT_CLASS,
  DAY_PHASE_PRE_HYDRATION_SCRIPT,
  applyDayPhaseDocumentClass,
  ctLocalMinutesFor,
  dayPhaseFor,
  dayPhaseHtmlClassFor,
  dayPhaseSurfaceExempt,
  readDayPhaseMode,
  resolvePhase,
} from "./dayPhase";

/**
 * S2 chrome-flip contracts (spec art_NqnJMLfh, Move S2): the <html> class
 * computation, the venue exemption, the imperative sync, and — the load-
 * bearing one — the pre-hydration bootstrap script. The script is inlined
 * before first paint and CANNOT import the store, so it re-derives the
 * phase from interpolated constants. These tests execute the script string
 * under stubbed globals and assert it lands on the same class the pure
 * functions produce — if the engine constants and the script ever drift,
 * this file fails.
 */

/** Minimal document/window/localStorage stubs the script string needs. */
interface ScriptHarness {
  classes: Set<string>;
  storageMap: Map<string, string>;
  pathname: string;
  run: () => void;
  setNow: (epochMs: number) => void;
}

function scriptHarness(): ScriptHarness {
  const classes = new Set<string>();
  const storageMap = new Map<string, string>();
  let now = 0;
  const state = { pathname: "/" };

  const documentStub = {
    documentElement: {
      className: "",
      classList: {
        add: (...names: string[]) => names.forEach((n) => classes.add(n)),
        remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
        toggle: (name: string, force?: boolean) => {
          const next = force === undefined ? !classes.has(name) : force;
          if (next) classes.add(name);
          else classes.delete(name);
          return next;
        },
        contains: (name: string) => classes.has(name),
      },
    },
  };
  const windowStub = {
    localStorage: {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => void storageMap.set(key, value),
    },
    location: {
      get pathname() {
        return state.pathname;
      },
    },
  };

  const harness: ScriptHarness = {
    classes,
    storageMap,
    get pathname() {
      return state.pathname;
    },
    set pathname(value: string) {
      state.pathname = value;
    },
    run() {
      // The script is a self-contained IIFE: free variables resolve against
      // the stubs installed below, exactly like a browser tab.
      const previousDocument = (globalThis as { document?: unknown }).document;
      const previousWindow = (globalThis as { window?: unknown }).window;
      const previousNow = Date.now;
      (globalThis as { document?: unknown }).document = documentStub;
      (globalThis as { window?: unknown }).window = windowStub;
      Date.now = () => now;
      try {
        new Function(DAY_PHASE_PRE_HYDRATION_SCRIPT)();
      } finally {
        (globalThis as { document?: unknown }).document = previousDocument;
        (globalThis as { window?: unknown }).window = previousWindow;
        Date.now = previousNow;
      }
    },
    setNow(epochMs: number) {
      now = epochMs;
    },
  };

  return harness;
}

/** Epochs at exact CT wall times under the fixed UTC-6 model. */
const BASE = Date.UTC(2026, 9, 8, 12, 0, 0);
const ctMidnightEpoch = BASE - ctLocalMinutesFor(BASE) * 60_000;
const atCtMinute = (minutes: number) => ctMidnightEpoch + minutes * 60_000;

describe("S2 html class contract", () => {
  it("maps day → skylight-day and night → civic-mode", () => {
    expect(dayPhaseHtmlClassFor("day", false)).toBe(DAY_PHASE_DAY_CLASS);
    expect(dayPhaseHtmlClassFor("night", false)).toBe(DAY_PHASE_NIGHT_CLASS);
  });

  it("exempt surfaces carry neither class", () => {
    expect(dayPhaseHtmlClassFor("day", true)).toBe("");
    expect(dayPhaseHtmlClassFor("night", true)).toBe("");
  });

  it("exempts only the Venue Studio route subtree", () => {
    expect(dayPhaseSurfaceExempt("/venue")).toBe(true);
    expect(dayPhaseSurfaceExempt("/venue/")).toBe(true);
    expect(dayPhaseSurfaceExempt("/venue/nested")).toBe(true);
    expect(dayPhaseSurfaceExempt("/venuehouse")).toBe(false);
    expect(dayPhaseSurfaceExempt("/")).toBe(false);
    expect(dayPhaseSurfaceExempt("/admin")).toBe(false);
  });

  describe("applyDayPhaseDocumentClass", () => {
    const h = scriptHarness();

    afterEach(() => {
      h.classes.clear();
    });

    it("sets exactly the phase class", () => {
      (globalThis as { document?: unknown }).document = {
        documentElement: {
          className: "",
          classList: {
            add: (n: string) => h.classes.add(n),
            remove: (n: string) => h.classes.delete(n),
            toggle: (n: string, force?: boolean) => {
              if (force === false || (force === undefined && h.classes.has(n)))
                h.classes.delete(n);
              else h.classes.add(n);
              return h.classes.has(n);
            },
            contains: (n: string) => h.classes.has(n),
          },
        },
      };
      applyDayPhaseDocumentClass("day", false);
      expect([...h.classes]).toEqual(["skylight-day"]);
      applyDayPhaseDocumentClass("night", false);
      expect([...h.classes]).toEqual(["civic-mode"]);
      applyDayPhaseDocumentClass("night", true);
      expect([...h.classes]).toEqual([]);
    });
  });
});

describe("pre-hydration script (source-of-truth contract)", () => {
  it("is generated from the engine constants it depends on", () => {
    // If these literals ever stop flowing from the engine, drift is possible.
    expect(DAY_PHASE_PRE_HYDRATION_SCRIPT).toContain('"atxlive.day-phase-mode"');
    expect(DAY_PHASE_PRE_HYDRATION_SCRIPT).toContain('"civic-mode"');
    expect(DAY_PHASE_PRE_HYDRATION_SCRIPT).toContain('"skylight-day"');
    expect(DAY_PHASE_PRE_HYDRATION_SCRIPT).toContain('"/venue"');
  });

  it.each([
    [6 * 60 + 59, "night"], // 06:59 CT
    [7 * 60, "day"], // 07:00 CT
    [18 * 60 + 59, "day"], // 18:59 CT
    [19 * 60, "night"], // 19:00 CT
  ])("auto mode at %i CT minutes lands on the engine phase", (minutes, expected) => {
    const harness = scriptHarness();
    harness.setNow(atCtMinute(minutes));
    expect(dayPhaseFor(atCtMinute(minutes))).toBe(expected); // engine sanity
    harness.run();
    expect([...harness.classes]).toEqual([
      expected === "day" ? DAY_PHASE_DAY_CLASS : DAY_PHASE_NIGHT_CLASS,
    ]);
  });

  it("matches the pure contract across modes, storage states, and routes", () => {
    const harness = scriptHarness();
    const storage = {
      getItem: (key: string) => harness.storageMap.get(key) ?? null,
    };
    const clockTimes = [
      atCtMinute(7 * 60 - 1),
      atCtMinute(7 * 60),
      atCtMinute(12 * 60),
      atCtMinute(19 * 60 - 1),
      atCtMinute(19 * 60),
      atCtMinute(23 * 60 + 59),
      atCtMinute(0),
    ];
    const storedValues = [null, "auto", "day", "night", "garbage"];

    for (const pathname of ["/", "/admin", "/venue", "/venue/"]) {
      harness.pathname = pathname;
      for (const stored of storedValues) {
        harness.storageMap.clear();
        if (stored !== null) harness.storageMap.set("atxlive.day-phase-mode", stored);
        for (const now of clockTimes) {
          harness.setNow(now);
          harness.run();
          const expected = dayPhaseHtmlClassFor(
            resolvePhase(dayPhaseFor(now), readDayPhaseMode(storage)),
            dayPhaseSurfaceExempt(pathname),
          );
          const actual = expected
            ? [...harness.classes].sort().join(" ")
            : "";
          expect(actual).toBe(expected);
        }
      }
    }
  });

  it("survives missing storage and absent window without throwing", () => {
    // The script guards storage in try/catch; a broken environment must
    // degrade to auto/night, never throw during first paint.
    const previousWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = undefined;
    try {
      expect(() => new Function(DAY_PHASE_PRE_HYDRATION_SCRIPT)()).not.toThrow();
    } finally {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  });
});
