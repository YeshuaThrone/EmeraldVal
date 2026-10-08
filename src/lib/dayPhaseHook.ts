"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getDayPhaseServerSnapshot,
  getDayPhaseSnapshot,
  hydrateDayPhaseModeFromStorage,
  setDayPhaseMode,
  subscribeToDayPhase,
  syncDayPhase,
  type DayPhaseMode,
  type DayPhaseSnapshot,
} from "./dayPhase";

/**
 * Hook: effective day phase plus the override controls. S2 wires `setMode`
 * to the ViewToggle sun/moon control; hydration of a persisted override
 * happens after mount so SSR and first client render agree.
 *
 * Lives apart from `dayPhase.ts` (client-only): the engine module is
 * imported by the root layout — a Server Component — for the pre-hydration
 * script, so it must stay free of react imports (Turbopack rejects hook
 * imports across a Server Component graph). Client components import the
 * hook from here and everything else from the engine.
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
