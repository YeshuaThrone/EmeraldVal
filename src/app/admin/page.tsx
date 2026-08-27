import { BarChart3, Guitar, MapPinned, Radio, Users } from "lucide-react";
import { DISTRICTS, summarizeAnalytics } from "@/lib/analytics";
import { CITY_PINS } from "@/lib/seedData";
import ViewToggle from "@/components/ViewToggle";

export const metadata = {
  title: "ATX Live — Civic / Admin Analytics Dashboard",
  description:
    "City-wide venue analytics for ATX Live: totals, live status, district breakdown, genre mix, and local vs. touring share.",
};

/** Horizontal bar row shared by the district and genre breakdowns. */
function BarRow({
  label,
  count,
  maxCount,
  barClassName,
}: {
  label: string;
  count: number;
  maxCount: number;
  barClassName: string;
}) {
  const widthPercent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-stone-600">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-atx-line">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-semibold text-atx-ink">
        {count}
      </span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  accent: "red" | "blue";
}) {
  const iconWrapClass =
    accent === "red"
      ? "bg-atx-red/15 text-atx-red-deep"
      : "bg-atx-blue/15 text-atx-blue-deep";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-atx-line bg-atx-paper p-5 shadow-[0_0_0_1px_rgba(28,25,23,0.05)]">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${iconWrapClass}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">
          {label}
        </span>
      </div>
      <span className="font-display text-3xl font-semibold text-atx-ink">
        {value}
      </span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const summary = summarizeAnalytics(CITY_PINS);
  const localSharePercent =
    summary.totalVenues > 0
      ? Math.round((summary.localVsTouring.local / summary.totalVenues) * 100)
      : 0;

  const districtCounts = DISTRICTS.map((district) => ({
    label: district,
    count: summary.venuesByDistrict[district],
  }));
  const maxDistrictCount = Math.max(1, ...districtCounts.map((d) => d.count));

  const genreCounts = Object.entries(summary.genreDistribution).map(
    ([genre, count]) => ({ label: genre, count }),
  );
  const maxGenreCount = Math.max(1, ...genreCounts.map((g) => g.count));

  const { local, touring, unspecified } = summary.localVsTouring;

  return (
    <div className="min-h-dvh w-full bg-atx-paper text-atx-ink">
      <header className="border-b border-atx-line bg-atx-paper/95 p-4 backdrop-blur-md md:p-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ViewToggle variant="admin" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-atx-blue shadow-[0_0_24px_rgba(0,168,232,0.45)]">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-atx-ink md:text-2xl">
                Civic / Admin Analytics Dashboard
              </h1>
              <p className="text-xs text-stone-500 md:text-sm">
                City-wide venue metrics across all Austin districts
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
        <section
          aria-label="Headline metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <StatCard
            icon={MapPinned}
            label="Total venues"
            value={summary.totalVenues.toString()}
            accent="blue"
          />
          <StatCard
            icon={Radio}
            label="Live now"
            value={summary.liveNowCount.toString()}
            accent="red"
          />
          <StatCard
            icon={Users}
            label="Local share"
            value={`${localSharePercent}%`}
            accent="blue"
          />
        </section>

        <section
          aria-label="Venues by district"
          className="rounded-2xl border border-atx-line bg-atx-paper p-5"
        >
          <h2 className="mb-4 text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
            Venues by district
          </h2>
          <div className="flex flex-col gap-3">
            {districtCounts.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                count={row.count}
                maxCount={maxDistrictCount}
                barClassName="bg-atx-blue"
              />
            ))}
          </div>
        </section>

        <section
          aria-label="Genre distribution"
          className="rounded-2xl border border-atx-line bg-atx-paper p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Guitar className="h-4 w-4 text-atx-red" />
            <h2 className="text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
              Genre distribution
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {genreCounts.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                count={row.count}
                maxCount={maxGenreCount}
                barClassName="bg-atx-red"
              />
            ))}
            {summary.unspecifiedGenreCount > 0 ? (
              <BarRow
                label="Unspecified"
                count={summary.unspecifiedGenreCount}
                maxCount={maxGenreCount}
                barClassName="bg-stone-400"
              />
            ) : null}
          </div>
        </section>

        <section
          aria-label="Local vs. touring split"
          className="rounded-2xl border border-atx-line bg-atx-paper p-5"
        >
          <h2 className="mb-4 text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
            Local vs. touring
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-atx-line bg-atx-red/10 p-4 text-center">
              <p className="text-2xl font-semibold text-atx-red-deep">
                {local}
              </p>
              <p className="text-xs text-stone-500">Local acts</p>
            </div>
            <div className="rounded-xl border border-atx-line bg-atx-blue/10 p-4 text-center">
              <p className="text-2xl font-semibold text-atx-blue-deep">
                {touring}
              </p>
              <p className="text-xs text-stone-500">Touring acts</p>
            </div>
            <div className="rounded-xl border border-atx-line bg-stone-100 p-4 text-center">
              <p className="text-2xl font-semibold text-stone-600">
                {unspecified}
              </p>
              <p className="text-xs text-stone-500">Unspecified</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
