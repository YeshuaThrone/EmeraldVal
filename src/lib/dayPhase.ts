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

import { useEffect, useSyncExternalStore } from "react";
import {
  getMinuteClockNow,
  subscribeToMinuteClock,
} from "./minuteClock";

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

/**
 * Hook: effective day phase plus the override controls. S2 wires `setMode`
 * to the ViewToggle sun/moon control; hydration of a persisted override
 * happens after mount so SSR and first client render agree.
 */
export function useDayPhase(): DayPhaseSnapshot & {
  setMode: (mode: DayPhaseMode) => void;
} {
  useEffect(() => {
    // Re-sync against the clock, then pull the persisted override — both may
    // notify; order matters so a persisted mode lands on a fresh phase read.
    syncDayPhase();
    hydrateDayPhaseModeFromStorage();
  }, []);
  const current = useSyncExternalStore(
    subscribeToDayPhase,
    getDayPhaseSnapshot,
    getDayPhaseServerSnapshot,
  );
  return { ...current, setMode: setDayPhaseMode };
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
