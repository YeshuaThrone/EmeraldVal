"use client";

import { Filter, Search, X } from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import { EMPTY_FILTER, type PinFilter } from "@/lib/filters";
import { GENRES, type Genre, type PinSource } from "@/lib/types";

type FilterBarProps = {
  filter: PinFilter;
  onChange: (next: PinFilter) => void;
  visibleCount: number;
  totalCount: number;
};

const GENRE_CHIPS: Array<{ value: Genre | ""; label: string }> = [
  ...GENRES.map((genre) => ({ value: genre, label: genre })),
  { value: "", label: "Unspecified" },
];

/** "Dropped" is a single toggle in the UI but spans two underlying sources. */
const DROPPED_SOURCES: PinSource[] = ["search", "map"];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function toggleSources(current: PinSource[], sources: PinSource[]): PinSource[] {
  const allActive = sources.every((source) => current.includes(source));
  if (allActive) {
    return current.filter((source) => !sources.includes(source));
  }
  return [...new Set([...current, ...sources])];
}

const chipClass = (pressed: boolean, activeBorder: string, activeBg: string, activeText: string) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    pressed
      ? `${activeBorder} ${activeBg} ${activeText}`
      : "border-white/10 bg-[#121826] text-zinc-300 hover:border-[#8B5CF6]/40 hover:text-white"
  }`;

export default function FilterBar({
  filter,
  onChange,
  visibleCount,
  totalCount,
}: FilterBarProps) {
  const liveActive = filter.sources.includes("live");
  const droppedActive = DROPPED_SOURCES.every((source) =>
    filter.sources.includes(source),
  );
  const activeCount =
    filter.genres.length +
    (liveActive ? 1 : 0) +
    (droppedActive ? 1 : 0) +
    (filter.query.trim() !== "" ? 1 : 0);

  return (
    <section
      aria-label="Filter venues"
      className="pointer-events-auto flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-[#0B0F17]/90 p-4 text-sm shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-300">
          <Filter className="h-4 w-4 text-[#8B5CF6]" />
          <span className="text-xs font-semibold tracking-[0.15em] text-zinc-300 uppercase">
            Filter venues
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          {visibleCount} / {totalCount} venues
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Genre">
        {GENRE_CHIPS.map((chip) => {
          const pressed = filter.genres.includes(chip.value);
          return (
            <button
              key={chip.value === "" ? "unspecified" : chip.value}
              type="button"
              aria-pressed={pressed}
              onClick={() =>
                onChange({
                  ...filter,
                  genres: toggleValue(filter.genres, chip.value),
                })
              }
              className={chipClass(
                pressed,
                "border-[#8B5CF6]",
                "bg-[#8B5CF6]/20",
                "text-[#c4b5fd]",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        <button
          type="button"
          aria-pressed={liveActive}
          onClick={() =>
            onChange({
              ...filter,
              sources: toggleSources(filter.sources, ["live"]),
            })
          }
          className={`inline-flex items-center gap-1.5 ${chipClass(
            liveActive,
            "border-[#8B5CF6]",
            "bg-[#8B5CF6]/20",
            "text-[#c4b5fd]",
          )}`}
        >
          <span className="h-2 w-2 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]" />
          Live
        </button>
        <button
          type="button"
          aria-pressed={droppedActive}
          onClick={() =>
            onChange({
              ...filter,
              sources: toggleSources(filter.sources, DROPPED_SOURCES),
            })
          }
          className={`inline-flex items-center gap-1.5 ${chipClass(
            droppedActive,
            "border-[#F59E0B]",
            "bg-[#F59E0B]/20",
            "text-[#fde3a7]",
          )}`}
        >
          <span className="h-2 w-2 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B]" />
          Dropped
        </button>
      </div>

      <label className="relative block">
        <span className="sr-only">Search performer or venue name</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B5CF6]" />
        <input
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
          placeholder="Search performer or venue…"
          className={`${FIELD_CLASS} pl-10`}
        />
      </label>

      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span>
          {activeCount > 0
            ? `${activeCount} active filter${activeCount === 1 ? "" : "s"}`
            : "No filters active"}
        </span>
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTER)}
          disabled={activeCount === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#121826]/90 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-[#F59E0B]/50 hover:text-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>
    </section>
  );
}
