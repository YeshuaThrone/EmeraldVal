import type { Metadata } from "next";
import Link from "next/link";
import ViewToggle from "@/components/ViewToggle";
import DayPhaseOverrideControl from "@/components/DayPhaseOverrideControl";
import { FAN_MAP_ROUTE } from "@/lib/routes";
import { CITY_PINS } from "@/lib/seedData";
import type { Pin } from "@/lib/types";

export const metadata: Metadata = {
  title: "ATXLive — Austin Doesn't Stop",
  description:
    "Austin's live-music system of record: the live map, civic analytics, the Festival Finder, and the Artist & Venue Studios.",
};

export interface WelcomeStats {
  venuesTracked: number;
  liveRightNow: number;
  districtsCovered: number;
}

/**
 * The numbers behind the landing data strip. Pure so the landing can only
 * ever show what the deterministic seed says — no fetching, no APIs.
 *
 * - venues tracked: every pin in the city seed
 * - live right now: pins scheduled with the "live" source
 * - districts covered: distinct districtForPoint classifications in the seed
 */
export function getWelcomeStats(pins: Pin[] = CITY_PINS): WelcomeStats {
  return {
    venuesTracked: pins.length,
    liveRightNow: pins.filter((pin) => pin.source === "live").length,
    districtsCovered:
      new Set(
        pins
          .map((pin) => pin.district)
          .filter((district): district is NonNullable<Pin["district"]> => district !== undefined),
      ).size,
  };
}

const STATS = [
  { label: "Venues tracked", key: "venuesTracked" as const },
  { label: "Live right now", key: "liveRightNow" as const },
  { label: "Districts covered", key: "districtsCovered" as const },
];

/**
 * Flagship landing (Foundry Pass M4, spec art_JaAYDgpB): a static,
 * seed-fed civic-dark hero. Server-rendered only — no API routes, no
 * client fetching, no auth. The fan map at `/` keeps its own behavior.
 */
export default function WelcomePage() {
  const stats = getWelcomeStats();

  return (
    <main className="h-dvh w-full overflow-y-auto bg-atx-night text-atx-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-atx-gold">
            ATXLive
          </p>
          <ViewToggle trailing={<DayPhaseOverrideControl />} />
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Austin Doesn&rsquo;t Stop.
            <br />
            Neither Do We.
          </h1>
          <p className="mt-5 text-sm font-medium text-stone-500 sm:text-base">
            {"Live Map · Civic Analytics · Festival Finder · Artist & Venue Studios"}
          </p>
        </section>

        <section aria-label="Live data from the Austin seed" className="pb-10">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STATS.map(({ label, key }) => (
              <div
                key={key}
                className="rounded-2xl border border-atx-line bg-atx-slab px-5 py-4"
              >
                <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-500">
                  {label}
                </dt>
                <dd className="mt-1 font-display text-3xl font-semibold text-atx-gold">
                  {stats[key]}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex justify-center">
            <Link
              href={FAN_MAP_ROUTE}
              className="rounded-full bg-atx-gold px-8 py-3 font-display text-base font-semibold text-atx-night transition hover:brightness-110"
            >
              Enter the Live Map
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
