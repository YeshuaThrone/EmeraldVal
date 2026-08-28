"use client";

import { Filter, Search, X } from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import {
  DROPPED_SOURCES,
  EMPTY_FILTER,
  toggleSources,
  type PinFilter,
} from "@/lib/filters";
import { GENRES, type Genre } from "@/lib/types";

type FilterBarProps = {
  filter: PinFilter;
  onChange: (next: PinFilter) => void;
  visibleCount: number;
  totalCount: number;
  onClose?: () => void;
};

const GENRE_CHIPS: Array<{ value: Genre | ""; label: string }> = [
  ...GENRES.map((genre) => ({ value: genre, label: genre })),
  { value: "", label: "Unspecified" },
];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

const chipClass = (pressed: boolean, activeBorder: string, activeBg: string, activeText: string) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    pressed
      ? `${activeBorder} ${activeBg} ${activeText}`
      : "border-atx-line bg-atx-paper text-stone-500 hover:border-atx-blue/40 hover:text-atx-ink"
  }`;

export default function FilterBar({
  filter,
  onChange,
  visibleCount,
  totalCount,
  onClose,
}: FilterBarProps) {
  const liveActive = filter.sources.includes("live");
  const droppedActive = DROPPED_SOURCES.every((source) =>
    filter.sources.includes(source),
  );
  const artistActive = filter.sources.includes("artist");
  const activeCount =
    filter.genres.length +
    (liveActive ? 1 : 0) +
    (droppedActive ? 1 : 0) +
    (artistActive ? 1 : 0) +
    (filter.query.trim() !== "" ? 1 : 0);

  return (
    <section
      id="filter-panel"
      aria-label="Filter venues"
      className="pointer-events-auto flex max-h-[60vh] w-full flex-col gap-3 overflow-y-auto rounded-2xl border border-atx-line bg-atx-paper/95 p-4 text-sm shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-stone-500">
          <Filter className="h-4 w-4 text-atx-blue" />
          <span className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">
            Filter venues
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">
            {visibleCount} / {totalCount} venues
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filter panel"
              className="rounded-full p-1 text-stone-400 transition hover:bg-atx-line/60 hover:text-atx-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
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
                "border-atx-blue",
                "bg-atx-blue/15",
                "text-atx-blue-deep",
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
            "border-atx-red",
            "bg-atx-red/15",
            "text-atx-red-deep",
          )}`}
        >
          <span className="h-2 w-2 rounded-full bg-atx-red shadow-[0_0_8px_#9B1B30]" />
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
            "border-atx-blue",
            "bg-atx-blue/15",
            "text-atx-blue-deep",
          )}`}
        >
          <span className="h-2 w-2 rounded-full bg-atx-blue shadow-[0_0_8px_#00A8E8]" />
          Dropped
        </button>
        <button
          type="button"
          aria-pressed={artistActive}
          onClick={() =>
            onChange({
              ...filter,
              sources: toggleSources(filter.sources, ["artist"]),
            })
          }
          className={`inline-flex items-center gap-1.5 ${chipClass(
            artistActive,
            "border-atx-electric",
            "bg-atx-electric/15",
            "text-atx-electric-deep",
          )}`}
        >
          <span className="h-2 w-2 rounded-full bg-atx-electric shadow-[0_0_8px_#0055FF]" />
          Artist
        </button>
      </div>

      <label className="relative block">
        <span className="sr-only">Search performer or venue name</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-atx-blue" />
        <input
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
          placeholder="Search performer or venue…"
          className={`${FIELD_CLASS} pl-10`}
        />
      </label>

      <div className="flex items-center justify-between gap-3 text-xs text-stone-500">
        <span>
          {activeCount > 0
            ? `${activeCount} active filter${activeCount === 1 ? "" : "s"}`
            : "No filters active"}
        </span>
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTER)}
          disabled={activeCount === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-atx-line bg-atx-paper px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-atx-red/50 hover:text-atx-red disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>
    </section>
  );
}
