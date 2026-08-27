"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Music, Send } from "lucide-react";
import { FAN_MAP_ROUTE } from "@/lib/routes";
import { CITY_PINS } from "@/lib/seedData";
import {
  festivalLineups,
  filterLineupsByGenre,
  type LineupGenreFilter,
} from "@/lib/festival";
import { GENRES } from "@/lib/types";

/** Computed once at module load — CITY_PINS is a fixed-seed constant. */
const ALL_LINEUPS = festivalLineups(CITY_PINS);

const GENRE_FILTERS: LineupGenreFilter[] = ["All", ...GENRES, "Unspecified"];

const chipClass = (pressed: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
    pressed
      ? "border-atx-blue bg-atx-blue/15 text-atx-blue-deep"
      : "border-atx-line bg-atx-paper text-stone-500 hover:border-atx-blue/40 hover:text-atx-ink"
  }`;

/**
 * "Active Austin lineups" — live venue cards built from the festival.ts
 * grouping over CITY_PINS, with a client-side genre filter row. The
 * grouping itself is computed once at module load; only the filter
 * selection is stateful here.
 */
export default function FestivalHub() {
  const [genreFilter, setGenreFilter] = useState<LineupGenreFilter>("All");

  const lineups = useMemo(
    () => filterLineupsByGenre(ALL_LINEUPS, genreFilter),
    [genreFilter],
  );

  return (
    <section aria-label="Festival Hub" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-atx-ink">
          Active Austin lineups
        </h2>
        <span className="text-xs text-stone-500">
          {lineups.length} / {ALL_LINEUPS.length} venues
        </span>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter lineups by genre"
      >
        {GENRE_FILTERS.map((genre) => {
          const pressed = genreFilter === genre;
          return (
            <button
              key={genre}
              type="button"
              aria-pressed={pressed}
              onClick={() => setGenreFilter(genre)}
              className={chipClass(pressed)}
            >
              {genre}
            </button>
          );
        })}
      </div>

      {lineups.length === 0 ? (
        <p className="rounded-2xl border border-atx-line bg-atx-paper px-4 py-6 text-sm text-stone-500">
          No live lineups match this genre right now — try a different genre
          or check back later.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lineups.map((lineup) => (
            <article
              key={lineup.venue}
              className="flex flex-col gap-3 rounded-2xl border border-atx-line bg-atx-paper p-4 shadow-[0_0_0_1px_rgba(28,25,23,0.05)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-semibold text-atx-ink">
                    {lineup.venue}
                  </h3>
                  {lineup.district ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
                      <MapPin className="h-3.5 w-3.5 text-atx-blue" />
                      {lineup.district}
                    </p>
                  ) : null}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-atx-red/40 bg-atx-red/10 px-2.5 py-1 text-[11px] font-semibold text-atx-red-deep">
                  <span className="h-2 w-2 rounded-full bg-atx-red shadow-[0_0_8px_#9B1B30]" />
                  Live now
                </span>
              </div>

              {lineup.genres.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {lineup.genres.map((genre) => (
                    <span
                      key={genre}
                      className="inline-flex items-center gap-1 rounded-full border border-atx-blue/40 bg-atx-blue/10 px-2.5 py-1 text-[11px] font-semibold text-atx-blue-deep"
                    >
                      <Music className="h-3 w-3" />
                      {genre}
                    </span>
                  ))}
                </div>
              ) : null}

              <Link
                href={FAN_MAP_ROUTE}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-atx-red px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(155,27,48,0.35)] transition hover:bg-atx-red-deep"
              >
                <Send className="h-4 w-4" />
                Send Tip
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
