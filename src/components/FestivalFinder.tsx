"use client";

import { CalendarDays, Clock, MapPin, X } from "lucide-react";
import { formatLiveCountdown } from "@/lib/countdown";
import type { GenreFilter, Pin } from "@/lib/types";

type FestivalFinderProps = {
  open: boolean;
  festivals: Pin[];
  now: number;
  genreFilter: GenreFilter;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export default function FestivalFinder({
  open,
  festivals,
  now,
  genreFilter,
  onClose,
  onSelect,
}: FestivalFinderProps) {
  return (
    <section
      className={`fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl rounded-t-3xl border border-[#FFD700]/30 border-b-0 bg-[#0B0F17] px-5 pt-3 pb-6 shadow-[0_-24px_80px_rgba(255,215,0,0.12)] transition-transform duration-300 ${
        open ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#FFD700]/50" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#FFD700] uppercase">
            <CalendarDays className="h-3.5 w-3.5" />
            Festival Finder
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold text-white">
            Active Austin lineups
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 p-2 text-zinc-400 transition hover:text-white"
          aria-label="Close festival finder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1">
        {festivals.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-[#121826] px-4 py-6 text-sm text-zinc-400">
            No festivals match this filter right now.
          </p>
        ) : (
          festivals.map((festival) => (
            <button
              key={festival.id}
              type="button"
              onClick={() => onSelect(festival.id)}
              className="rounded-2xl border border-white/10 bg-[#121826] p-4 text-left transition hover:border-[#FFD700]/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">
                    {festival.performerName}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-400">
                    <MapPin className="h-3.5 w-3.5 text-[#FFD700]" />
                    {festival.locationName}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/10 px-2.5 py-1 text-[11px] font-semibold text-[#FFD700]">
                  <Clock className="h-3 w-3" />
                  {formatLiveCountdown(festival.liveUntil, now)}
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {(festival.stages ?? []).map((stage) => {
                  const sets =
                    genreFilter === "All" || genreFilter === "Festivals"
                      ? stage.sets
                      : stage.sets.filter((set) => set.genre === genreFilter);
                  if (sets.length === 0) {
                    return null;
                  }
                  return (
                    <div
                      key={stage.name}
                      className="rounded-xl border border-white/10 bg-[#0B0F17]/70 px-3 py-2"
                    >
                      <p className="text-[11px] font-semibold tracking-wide text-[#FFD700] uppercase">
                        {stage.name}
                      </p>
                      <ul className="mt-1.5 grid gap-1">
                        {sets.map((set) => (
                          <li
                            key={`${stage.name}-${set.artist}-${set.startTime}`}
                            className="flex items-center justify-between gap-2 text-sm text-zinc-200"
                          >
                            <span>{set.artist}</span>
                            <span className="text-xs text-zinc-500">
                              {set.startTime} – {set.endTime}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
