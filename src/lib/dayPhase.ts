/**
 * Day-phase engine for the Skylight Pass (spec art_NqnJMLfh, Move S1).
 *
 * Computes whether ATXLive is in its `day` or `night` skin. The store shape
 * deliberately mirrors minuteClock.ts: a cached snapshot that is stable
 * between updates, advanced BEFORE listeners are notified (set-then-notify),
 * so `getSnapshot` passed to `useSyncExternalStore` never returns a fresh
 * object per call — the exact failure mode that crashed /venue in O1.
 *
 * Clock source is injectable so the suite stays deterministic without real
 * timers; the production source is the shared minute clock.
 *
 * America/Chicago is modeled as a FIXED OFFSET (CST, UTC-6) held year-round,
 * per the spec's locked decision: boundaries are constants, no sunrise
 * tables this pass. During CDT (roughly March–November) real Chicago local
 * time runs one hour ahead of this model, shifting the 07:00/19:00 edges by
 * one hour — an accepted constant-offset approximation. Night is the
 * fallback whenever timing is ambiguous (server render, no storage).
 */

import {
  getMinuteClockNow,
  subscribeToMinuteClock,
} from "./minuteClock";
import { VENUE_ROUTE } from "./routes";

export type DayPhase = "day" | "night";
export type DayPhaseMode = "auto" | "day" | "night";

export interface DayPhaseSnapshot {
  /** Effective phase after the override mode is applied. */
  phase: DayPhase;
  /** Clock-derived phase, unaffected by the override. */
  autoPhase: DayPhase;
  /** Override mode: `auto` follows the clock; `day`/`night` force a phase. */
  mode: DayPhaseMode;
}

/** Injectable clock source — same contract minuteClock exposes to its store. */
export interface DayPhaseClockSource {
  /** Current epoch ms; stable within one minute window. */
  getNow: () => number;
  /** Fires listeners after the tick value advances (set-then-notify). */
  subscribe: (onStoreChange: () => void) => () => void;
}

export const minuteClockSource: DayPhaseClockSource = {
  getNow: getMinuteClockNow,
  subscribe: subscribeToMinuteClock,
};

let clockSource: DayPhaseClockSource = minuteClockSource;

/** Swaps the clock feeding the phase store (tests inject a manual source). */
export function setDayPhaseClockSource(source: DayPhaseClockSource | null): void {
  clockSource = source ?? minuteClockSource;
}

// Fixed-offset America/Chicago model: CST = UTC-6, held constant.
const CT_OFFSET_MINUTES = -360;
const MINUTES_PER_DAY = 24 * 60;
const DAY_START_MINUTES = 7 * 60; // 07:00 CT — day begins (inclusive)
const DAY_END_MINUTES = 19 * 60; // 19:00 CT — day ends (exclusive)

/** Minutes since CT midnight under the fixed CST offset model. */
export function ctLocalMinutesFor(epochMs: number): number {
  const shiftedMinutes = Math.floor((epochMs + CT_OFFSET_MINUTES * 60_000) / 60_000);
  return ((shiftedMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Pure phase computation: day is [07:00, 19:00) CT, night otherwise. */
export function dayPhaseFor(epochMs: number): DayPhase {
  const minutes = ctLocalMinutesFor(epochMs);
  return minutes >= DAY_START_MINUTES && minutes < DAY_END_MINUTES
    ? "day"
    : "night";
}

/** Override precedence: an explicit day/night choice beats the clock. */
export function resolvePhase(autoPhase: DayPhase, mode: DayPhaseMode): DayPhase {
  return mode === "auto" ? autoPhase : mode;
}

// ---------------------------------------------------------------------------
// Override persistence (localStorage). Storage is injectable for tests; every
// access degrades to `auto`/no-op when storage is unavailable (SSR, private
// mode) — the documented fallback, not a silent failure.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "atxlive.day-phase-mode";

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDayPhaseMode(
  storage?: Pick<Storage, "getItem"> | null,
): DayPhaseMode {
  const store = storage ?? defaultStorage();
  if (!store) return "auto";
  try {
    const raw = store.getItem(STORAGE_KEY);
    return raw === "day" || raw === "night" || raw === "auto" ? raw : "auto";
  } catch {
    return "auto";
  }
}

export function writeDayPhaseMode(
  mode: DayPhaseMode,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable: the override stays session-only, which is the
    // spec'd degradation (auto mode keeps driving the phase).
  }
}

// ---------------------------------------------------------------------------
// Phase store — cached snapshot, set-then-notify, lazy client seed.
// ---------------------------------------------------------------------------

const NIGHT_FALLBACK_SNAPSHOT: DayPhaseSnapshot = {
  phase: "night",
  autoPhase: "night",
  mode: "auto",
};

let mode: DayPhaseMode = "auto";
let snapshot: DayPhaseSnapshot = NIGHT_FALLBACK_SNAPSHOT;
let seeded = false;
const listeners = new Set<() => void>();

function computeSnapshot(): DayPhaseSnapshot {
  const autoPhase = dayPhaseFor(clockSource.getNow());
  return { phase: resolvePhase(autoPhase, mode), autoPhase, mode };
}

/** Rebuilds the cached snapshot and notifies listeners only on real change. */
function refreshAndNotify(): void {
  const next = computeSnapshot();
  if (
    next.phase === snapshot.phase &&
    next.autoPhase === snapshot.autoPhase &&
    next.mode === snapshot.mode
  ) {
    return;
  }
  // Advance the cache BEFORE notifying — minuteClock's set-then-notify shape.
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Stable client snapshot: identical object within a phase/mode window. */
export function getDayPhaseSnapshot(): DayPhaseSnapshot {
  // First client read seeds the cache from the clock (same lazy seed as
  // minuteClock); afterwards only refreshAndNotify mutates it.
  if (!seeded) {
    seeded = true;
    snapshot = computeSnapshot();
  }
  return snapshot;
}

/** Server snapshot: the clock is client-only, so the server renders night. */
export function getDayPhaseServerSnapshot(): DayPhaseSnapshot {
  return NIGHT_FALLBACK_SNAPSHOT;
}

/**
 * Registers a listener; never notifies on subscribe — notifications fire only
 * from clock ticks, `syncDayPhase`, and mode changes (minuteClock parity).
 */
export function subscribeToDayPhase(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const unsubscribeClock = clockSource.subscribe(() => refreshAndNotify());
  return () => {
    listeners.delete(onStoreChange);
    unsubscribeClock();
  };
}

/**
 * Recomputes the phase against the current clock and notifies on change.
 * The clock does not tick while nobody listens, so a fresh mount holds a
 * possibly stale phase until this runs (the hook calls it on mount).
 */
export function syncDayPhase(): void {
  refreshAndNotify();
}

/** Sets the override, persists it, and notifies subscribers on change. */
export function setDayPhaseMode(next: DayPhaseMode): void {
  writeDayPhaseMode(next);
  if (next !== mode) {
    mode = next;
    refreshAndNotify();
  }
}

/** Pulls a persisted override into the store once per mount (client). */
export function hydrateDayPhaseModeFromStorage(
  storage?: Pick<Storage, "getItem"> | null,
): void {
  const stored = readDayPhaseMode(storage);
  if (stored !== mode) {
    mode = stored;
    refreshAndNotify();
  }
}

/** Test seam: restores auto mode, the minute clock, and the fallback snapshot. */
export function resetDayPhaseForTests(): void {
  clockSource = minuteClockSource;
  mode = "auto";
  seeded = false;
  snapshot = NIGHT_FALLBACK_SNAPSHOT;
  // Hygiene: a failed test that threw before its unsubscribe must not leak
  // its listener into the next test's notification counts.
  listeners.clear();
}

// ---------------------------------------------------------------------------
// S2 chrome flip (spec art_NqnJMLfh, Move S2). The <html> element carries the
// phase class: night = `civic-mode` (the Foundry dark grading), day =
// `skylight-day` (a light marker the day-skin CSS re-grades from), and the
// Venue Studio route carries neither (forced-light contract, both phases).
// ---------------------------------------------------------------------------

/** Day-phase marker class set on <html> when the app renders its light skin. */
export const DAY_PHASE_DAY_CLASS = "skylight-day";

/** Night class on <html>: the Foundry civic-dark grading, unchanged. */
export const DAY_PHASE_NIGHT_CLASS = "civic-mode";

/**
 * Surfaces exempt from the phase flip. Venue Studio is light in both phases
 * by founder contract, so its route never receives a phase class.
 */
export function dayPhaseSurfaceExempt(pathname: string): boolean {
  return pathname === VENUE_ROUTE || pathname.startsWith(`${VENUE_ROUTE}/`);
}

/** Pure class contract for an <html> element: empty string means "neither". */
export function dayPhaseHtmlClassFor(
  phase: DayPhase,
  surfaceExempt: boolean,
): string {
  if (surfaceExempt) return "";
  return phase === "day" ? DAY_PHASE_DAY_CLASS : DAY_PHASE_NIGHT_CLASS;
}

/**
 * Imperative <html> class sync — the write side of `dayPhaseHtmlClassFor`.
 * Idempotent; called from the DayPhaseChrome effect after hydration (the
 * pre-hydration script owns first paint). No-ops outside the browser.
 */
export function applyDayPhaseDocumentClass(
  phase: DayPhase,
  surfaceExempt: boolean,
): void {
  if (typeof document === "undefined") return;
  const next = dayPhaseHtmlClassFor(phase, surfaceExempt);
  document.documentElement.classList.toggle(
    DAY_PHASE_DAY_CLASS,
    next === DAY_PHASE_DAY_CLASS,
  );
  document.documentElement.classList.toggle(
    DAY_PHASE_NIGHT_CLASS,
    next === DAY_PHASE_NIGHT_CLASS,
  );
}

/**
 * Pre-hydration bootstrap, inlined as the first <body> child in the root
 * layout. It re-derives the phase from the SAME constants the store uses
 * (interpolated here, so the two cannot drift), reads the persisted
 * override, and sets the <html> class before first paint — no flash.
 *
 * Single source of truth: `dayPhaseChrome.test.ts` executes this string
 * under stubbed globals and asserts it lands on the same class as
 * `dayPhaseFor` + `readDayPhaseMode` + `dayPhaseHtmlClassFor` across
 * boundary times, overrides, and the venue exemption.
 */
export const DAY_PHASE_PRE_HYDRATION_SCRIPT = `(function () {
  try {
    var STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};
    var CT_OFFSET_MINUTES = ${JSON.stringify(CT_OFFSET_MINUTES)};
    var MINUTES_PER_DAY = ${JSON.stringify(MINUTES_PER_DAY)};
    var DAY_START_MINUTES = ${JSON.stringify(DAY_START_MINUTES)};
    var DAY_END_MINUTES = ${JSON.stringify(DAY_END_MINUTES)};
    var VENUE_ROUTE = ${JSON.stringify(VENUE_ROUTE)};
    var DAY_CLASS = ${JSON.stringify(DAY_PHASE_DAY_CLASS)};
    var NIGHT_CLASS = ${JSON.stringify(DAY_PHASE_NIGHT_CLASS)};
    var mode = "auto";
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "day" || raw === "night" || raw === "auto") mode = raw;
    } catch (e) {}
    var phase = mode;
    if (mode === "auto") {
      var shifted = Math.floor((Date.now() + CT_OFFSET_MINUTES * 60000) / 60000);
      var minutes = ((shifted % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      phase = minutes >= DAY_START_MINUTES && minutes < DAY_END_MINUTES ? "day" : "night";
    }
    var root = document.documentElement;
    var path = window.location.pathname;
    var exempt = path === VENUE_ROUTE || path.indexOf(VENUE_ROUTE + "/") === 0;
    if (exempt) {
      root.classList.remove(DAY_CLASS);
      root.classList.remove(NIGHT_CLASS);
    } else if (phase === "day") {
      root.classList.add(DAY_CLASS);
      root.classList.remove(NIGHT_CLASS);
    } else {
      root.classList.add(NIGHT_CLASS);
      root.classList.remove(DAY_CLASS);
    }
  } catch (e) {}
})();`;
