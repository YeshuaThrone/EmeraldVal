import Link from "next/link";
import { MapPin, X } from "lucide-react";
import ViewToggle from "@/components/ViewToggle";
import { FAN_MAP_ROUTE } from "@/lib/routes";
import { FESTIVAL_EVENTS, formatLiveCountdown, isLive } from "@/lib/festivalEvents";
import ArtistSubmittedShows from "@/components/ArtistSubmittedShows";
export const metadata = {
  title: "ATXLive — Festival Finder",
  description:
    "Tonight's Austin festival lineups: stages, artists, and exact set times.",
};

/**
 * The live countdown badge is derived from the request time, so the route is
 * rendered per request instead of frozen into the build output.
 */
export const dynamic = "force-dynamic";

/**
 * Festival Finder. The route *is* the modal: a dimmed backdrop with a single
 * centered card listing tonight's events, their stages, and set times. The X
 * in the card's top right is the only way out and returns to the fan map.
 */
export default function FestivalPage() {
  const now = new Date();

  return (
    <div className="min-h-dvh w-full bg-atx-ink/70 px-4 py-6 backdrop-blur-sm md:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <section
          aria-label="Festival Finder"
          className="relative max-h-[88dvh] overflow-y-auto rounded-3xl border border-atx-line bg-atx-paper p-5 shadow-[0_24px_80px_rgba(28,25,23,0.45)] md:p-7"
        >
          <Link
            href={FAN_MAP_ROUTE}
            aria-label="Close Festival Finder and return to the fan map"
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-atx-line bg-atx-paper text-stone-500 transition hover:border-atx-red/50 hover:text-atx-red"
          >
            <X className="h-4 w-4" />
          </Link>

          <div className="pr-12">
            <p className="text-xs font-semibold tracking-[0.2em] text-atx-blue-deep uppercase">
              Festival Finder
            </p>
            <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-atx-ink md:text-3xl">
              Tonight in Austin
            </h1>
          </div>

          <div className="mt-4">
            <ViewToggle variant="festival" />
          </div>

          <div className="mt-6 flex flex-col gap-7">
            {FESTIVAL_EVENTS.map((event) => (
              <article key={event.id} className="flex flex-col gap-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-atx-ink">
                      {event.name}
                    </h2>
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.locationTag}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isLive(event.liveWindow, now)
                        ? "bg-atx-red/15 text-atx-red-deep"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {formatLiveCountdown(event.liveWindow, now)}
                  </span>
                </header>

                {event.stages.map((stage) => (
                  <div key={stage.name} className="flex flex-col gap-1">
                    <h3 className="text-xs font-bold tracking-[0.18em] text-atx-ink uppercase">
                      {stage.name}
                    </h3>
                    <ul className="flex flex-col divide-y divide-atx-line border-t border-atx-line">
                      {stage.sets.map((set) => (
                        <li
                          key={`${stage.name}-${set.artist}`}
                          className="flex items-center justify-between gap-4 py-2"
                        >
                          <span className="text-sm font-medium text-atx-ink">
                            {set.artist}
                          </span>
                          <span className="text-right text-sm tabular-nums text-stone-500">
                            {set.setTime}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            ))}
          </div>

          {/* PR 25 — additive artist-submitted feed below the curated lineup. */}
          <ArtistSubmittedShows />
        </section>
      </div>
    </div>
  );
}
