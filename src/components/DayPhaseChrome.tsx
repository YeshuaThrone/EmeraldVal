"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  applyDayPhaseDocumentClass,
  dayPhaseSurfaceExempt,
} from "@/lib/dayPhase";
import { useDayPhase } from "@/lib/dayPhaseHook";

/**
 * Keeps the <html> phase class in sync with the day-phase store after
 * hydration: clock crossings, override clicks, and venue cross-navigation
 * all land here. The pre-hydration script (dayPhase.ts) owns first paint;
 * this effect owns everything after it, using the same pure class contract.
 * Renders nothing — it exists only for its effect.
 */
export default function DayPhaseChrome() {
  const { phase } = useDayPhase();
  const pathname = usePathname();
  const surfaceExempt = dayPhaseSurfaceExempt(pathname ?? "");

  useEffect(() => {
    applyDayPhaseDocumentClass(phase, surfaceExempt);
  }, [phase, surfaceExempt]);

  return null;
}
