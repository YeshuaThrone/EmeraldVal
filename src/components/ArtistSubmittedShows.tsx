"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  Music4,
  Ticket,
} from "lucide-react";
import {
  FESTIVAL_FEED_KICKER,
  FESTIVAL_SHOW_STATUS_LABEL,
  fetchFestivalShows,
  formatFestivalRowTitle,
  formatFestivalSetTime,
  type FestivalShowEntry,
  type FestivalTicketing,
  type FetchFestivalShowsResult,
} from "@/lib/festivalShows";
import { ARTIST_ROUTE } from "@/lib/routes";

/**
 * The Festival Finder's "Artist-Submitted Shows" section (PR 25).
 *
 * Additive below the deterministic lineup and visually distinguished from
 * it (electric-blue accent, matching the artist pins on the fan map). Fed
 * from GET /api/shows — the same source of truth the map hydrates from —
 * so one published show appears on both surfaces.
 *
 * Off-happy-path states: loading (quiet placeholder), empty (publish
 * pointer), and fetch failure (retry affordance — never a crash; the
 * deterministic lineup above is unaffected either way).
 */

type SectionState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; entries: FestivalShowEntry[] };

/** Ticket affordance per row — mirrors the fan map's PerformerDrawer. */
function TicketAffordance({ ticketing }: { ticketing: FestivalTicketing }) {
  if (ticketing.kind === "external") {
    return (
      <a
        href={ticketing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-atx-electric px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-atx-electric-deep"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Get Tickets — External Site
      </a>
    );
  }
  if (ticketing.kind === "native") {
    // Native ticketing is data, not checkout — the price line plus the
    // checkout-pending note, consistent with the fan map's drawer (PRs
    // #20/#24 treatment). Never a Buy button without a payment backend.
    return (
      <div className="inline-flex flex-col">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-atx-ink">
          <Ticket className="h-3.5 w-3.5 text-atx-electric" />
          Direct ATXLive Ticketing · ${ticketing.price.toFixed(2)}
        </span>
        <span className="mt-0.5 text-[11px] text-stone-400">
          Checkout coming with the ATXLive backend.
        </span>
      </div>
    );
  }
  return <span className="text-xs text-stone-400">No ticket link provided.</span>;
}

export default function ArtistSubmittedShows() {
  const [state, setState] = useState<SectionState>({ phase: "loading" });

  const applyResult = useCallback((result: FetchFestivalShowsResult) => {
    setState(
      result.ok
        ? { phase: "loaded", entries: result.entries }
        : { phase: "error", message: result.error },
    );
  }, []);

  // Retry path — a user event, not an effect, so applying the result
  // synchronously here is fine.
  const runLoad = useCallback(
    async () => applyResult(await fetchFestivalShows()),
    [applyResult],
  );

  useEffect(() => {
    // setState runs inside the promise callback (async data load), not in
    // the effect body — the cancelled flag guards against unmount races.
    let cancelled = false;
    fetchFestivalShows().then((result) => {
      if (!cancelled) {
        applyResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  return (
    <section
      aria-label="Artist-Submitted Shows"
      className="rounded-3xl border border-atx-electric/30 bg-atx-paper p-5 md:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-atx-electric-deep uppercase">
            Artist-Submitted Shows
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] text-atx-electric uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-atx-electric"
            />
            {FESTIVAL_FEED_KICKER}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Published live from the Artist Studio — the same feed the fan map
            pins.
          </p>
        </div>
        <Link
          href={ARTIST_ROUTE}
          className="inline-flex items-center gap-1.5 rounded-full border border-atx-electric/40 px-3 py-1.5 text-xs font-semibold text-atx-electric-deep transition hover:bg-atx-electric/10"
        >
          Publish your show →
        </Link>
      </header>

      {state.phase === "loading" ? (
        <p className="mt-5 text-sm text-stone-400" role="status">
          Loading artist-submitted shows…
        </p>
      ) : state.phase === "error" ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-atx-line bg-stone-50 p-4">
          <p className="text-sm text-stone-500">
            Couldn&apos;t load artist-submitted shows — {state.message}
          </p>
          <button
            type="button"
            onClick={() => {
              setState({ phase: "loading" });
              void runLoad();
            }}
            className="rounded-full border border-atx-line px-3 py-1.5 text-xs font-semibold text-atx-ink transition hover:border-atx-electric/50 hover:text-atx-electric-deep"
          >
            Retry
          </button>
        </div>
      ) : state.entries.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-atx-line p-4 text-sm text-stone-500">
          No artist-submitted shows yet — publish from the{" "}
          <Link
            href={ARTIST_ROUTE}
            className="font-semibold text-atx-electric-deep underline underline-offset-2"
          >
            Artist Studio
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-5 flex flex-col divide-y divide-atx-line border-t border-atx-line">
          {state.entries.map((entry) => {
            const setTimeLabel = formatFestivalSetTime(entry.setTime);
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between md:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-atx-ink">
                      {formatFestivalRowTitle(entry.artistName, entry.venue)}
                    </span>
                    {/* Derived status: publication is the confirmation —
                        styled with the audio widget's compliant chip
                        treatment, not the paste's zinc/green palette. */}
                    <span className="rounded-full bg-atx-blue/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-atx-blue-deep uppercase">
                      {FESTIVAL_SHOW_STATUS_LABEL}
                    </span>
                    <span className="rounded-full bg-atx-electric/10 px-2 py-0.5 text-[11px] font-semibold text-atx-electric-deep">
                      {entry.councilDistrict}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    {setTimeLabel !== null ? (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <CalendarDays className="h-3 w-3" />
                        {setTimeLabel}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0">
                  <TicketAffordance ticketing={entry.ticketing} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-stone-400">
        <Music4 className="h-3 w-3" />
        Artist-submitted feed · distinct from the curated festival lineup above.
      </p>
    </section>
  );
}
