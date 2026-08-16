"use client";

import { CalendarDays, Earth } from "lucide-react";
import type { MapViewMode } from "@/lib/types";

type ViewToggleProps = {
  mode: MapViewMode;
  onModeChange: (mode: MapViewMode) => void;
};

export default function ViewToggle({ mode, onModeChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-2xl border border-[#00529C]/30 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onModeChange("map")}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
          mode === "map"
            ? "bg-[#E0144C] text-white"
            : "border border-transparent text-[#00529C] hover:bg-[#F8FAFC]"
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
            ? "bg-[#E0144C] text-white"
            : "border border-transparent text-[#00529C] hover:bg-[#F8FAFC]"
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Festival Finder
      </button>
    </div>
  );
}
