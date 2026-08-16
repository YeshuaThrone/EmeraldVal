"use client";

import { GENRE_FILTERS, type GenreFilter } from "@/lib/types";

type GenreChipsProps = {
  value: GenreFilter;
  onChange: (value: GenreFilter) => void;
};

export default function GenreChips({ value, onChange }: GenreChipsProps) {
  return (
    <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
      {GENRE_FILTERS.map((filter) => {
        const active = value === filter;
        const festival = filter === "Festivals";
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active && festival
                ? "border-[#FFD700] bg-[#FFD700] text-[#0B0F17] shadow-[0_0_16px_rgba(255,215,0,0.35)]"
                : active
                  ? "border-[#22FF88] bg-[#22FF88] text-[#0B0F17] shadow-[0_0_16px_rgba(34,255,136,0.35)]"
                  : "border-white/10 bg-[#121826]/90 text-zinc-300 hover:border-white/25 hover:text-white"
            }`}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
