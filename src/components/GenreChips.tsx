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
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "border-[#E0144C] bg-[#E0144C] text-white"
                : "border-[#00529C] bg-white text-[#00529C] hover:bg-[#00529C] hover:text-white"
            }`}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
