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
      className={`fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl rounded-t-3xl border border-[#00529C]/20 border-b-0 bg-white px-5 pt-3 pb-6 shadow-[0_-16px_48px_rgba(0,82,156,0.12)] transition-transform duration-300 ${
        open ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      aria-hidden={!open}
    >
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#FFE317]" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#00529C] uppercase">
            <CalendarDays className="h-3.5 w-3.5" />
            Festival Finder
          </p>
          <h2 className="font-display mt-1 text-xl font-semibold text-[#003366]">
            Active Austin lineups
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#00529C]/25 p-2 text-[#00529C] transition hover:bg-[#F8FAFC]"
          aria-label="Close festival finder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1">
        {festivals.length === 0 ? (
          <p className="rounded-2xl border border-[#00529C]/20 bg-[#F8FAFC] px-4 py-6 text-sm text-[#00529C]">
            No festivals match this filter right now.
          </p>
        ) : (
          festivals.map((festival) => (
            <button
              key={festival.id}
              type="button"
              onClick={() => onSelect(festival.id)}
              className="rounded-2xl border border-[#00529C]/20 bg-[#F8FAFC] p-4 text-left transition hover:border-[#E0144C]/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#003366]">
                    {festival.performerName}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#00529C]">
                    <MapPin className="h-3.5 w-3.5 text-[#E0144C]" />
                    {festival.locationName}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#FFE317] bg-[#FFE317]/40 px-2.5 py-1 text-[11px] font-semibold text-[#003366]">
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
                      className="rounded-xl border border-[#00529C]/15 bg-white px-3 py-2"
                    >
                      <p className="text-[11px] font-semibold tracking-wide text-[#00529C] uppercase">
                        {stage.name}
                      </p>
                      <ul className="mt-1.5 grid gap-1">
                        {sets.map((set) => (
                          <li
                            key={`${stage.name}-${set.artist}-${set.startTime}`}
                            className="flex items-center justify-between gap-2 text-sm text-[#003366]"
                          >
                            <span>{set.artist}</span>
                            <span className="text-xs text-slate-500">
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
