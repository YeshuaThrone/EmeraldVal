"use client";

import { CalendarDays, Earth } from "lucide-react";
import type { MapViewMode } from "@/lib/types";

type ViewToggleProps = {
  mode: MapViewMode;
  onModeChange: (mode: MapViewMode) => void;
};

export default function ViewToggle({ mode, onModeChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-[#0B0F17]/85 p-1 backdrop-blur-md">
      <button
        type="button"
        onClick={() => onModeChange("map")}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
          mode === "map"
            ? "bg-[#8B5CF6] text-white shadow-[0_0_16px_rgba(139,92,246,0.45)]"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <Earth className="h-3.5 w-3.5" />
        3D Map View
      </button>
      <button
        type="button"
        onClick={() => onModeChange("festivals")}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
          mode === "festivals"
            ? "bg-[#FFD700] text-[#0B0F17] shadow-[0_0_16px_rgba(255,215,0,0.4)]"
            : "text-zinc-400 hover:text-white"
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Festival Finder
      </button>
    </div>
  );
}
