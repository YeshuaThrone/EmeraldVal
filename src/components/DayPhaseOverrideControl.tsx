"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { type DayPhaseMode } from "@/lib/dayPhase";
import { useDayPhase } from "@/lib/dayPhaseHook";

const OPTIONS: readonly {
  value: DayPhaseMode;
  icon: typeof Sun;
  label: string;
}[] = [
  { value: "auto", icon: SunMoon, label: "Follow the clock (auto)" },
  { value: "day", icon: Sun, label: "Always day" },
  { value: "night", icon: Moon, label: "Always night" },
];

const optionClass = (active: boolean) =>
  `flex h-7 w-7 items-center justify-center rounded-full border transition ${active
    ? "border-atx-red bg-atx-red/15 text-atx-red-deep"
    : "border-transparent text-stone-500 hover:border-atx-line hover:text-atx-ink"
  }`;

/**
 * Skylight S2 sun/moon override: auto follows the clock; day/night pin the
 * phase (persisted via the S1 store). Token colors only, so the control
 * reads clean in both skins — the same utility classes the ViewToggle links
 * are graded with. Rendered as ViewToggle's `trailing` slot on the four
 * themable surfaces; Venue Studio omits it (forced-light, both phases).
 */
export default function DayPhaseOverrideControl() {
  const { mode, setMode } = useDayPhase();

  return (
    <div
      role="group"
      aria-label="Day phase override"
      className="pointer-events-auto flex items-center gap-1 rounded-full border border-atx-line bg-atx-paper/80 p-1 backdrop-blur-md"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={mode === value}
          title={label}
          onClick={() => setMode(value)}
          className={optionClass(mode === value)}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
