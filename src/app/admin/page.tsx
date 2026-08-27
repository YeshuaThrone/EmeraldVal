import { BarChart3, Guitar, MapPinned, Radio, Users } from "lucide-react";
import { DISTRICTS, summarizeAnalytics } from "@/lib/analytics";
import { CITY_PINS } from "@/lib/seedData";
import ViewToggle from "@/components/ViewToggle";
import AnimatedBar from "./AnimatedBar";

export const metadata = {
  title: "ATXLive — Civic / Admin Analytics Dashboard",
  description:
    "City-wide venue analytics for ATXLive: totals, live status, district breakdown, genre mix, and local vs. touring share.",
};

// Admin-local high-contrast palette. Scoped to this page only — the shared
// --color-atx-* theme tokens (used by the fan map and festival hub) are
// untouched.
const ADMIN_GRADIENT_FILL = "bg-gradient-to-r from-[#0055FF] to-[#00D2FF]";

/** Horizontal bar row shared by the district and genre breakdowns. */
function BarRow({
  label,
  count,
  maxCount,
  fillClassName,
}: {
  label: string;
  count: number;
  maxCount: number;
  fillClassName: string;
}) {
  const percent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-stone-600">{label}</span>
      <AnimatedBar
        percent={percent}
        fillClassName={fillClassName}
        className="flex-1"
      />
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
  percent,
  caption,
  tone,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  percent: number;
  caption: string;
  tone: "primary" | "secondary";
}) {
  // Dark-red admin palette: #8B0000 primary, #B22222 secondary accent.
  const toneClasses =
    tone === "primary"
      ? { chip: "bg-[#8B0000]/15 text-[#8B0000]", value: "text-[#8B0000]" }
      : { chip: "bg-[#B22222]/15 text-[#B22222]", value: "text-[#B22222]" };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-atx-line bg-white p-5 shadow-[0_0_0_1px_rgba(28,25,23,0.05)]">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClasses.chip}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">
          {label}
        </span>
      </div>
      <span
        className={`font-display text-4xl font-bold md:text-5xl ${toneClasses.value}`}
      >
        {value}
      </span>
      <AnimatedBar percent={percent} fillClassName={ADMIN_GRADIENT_FILL} />
      <span className="text-xs text-stone-500">{caption}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const summary = summarizeAnalytics(CITY_PINS);
  const localSharePercent =
    summary.totalVenues > 0
      ? Math.round((summary.localVsTouring.local / summary.totalVenues) * 100)
      : 0;
  const liveSharePercent =
    summary.totalVenues > 0
      ? Math.round((summary.liveNowCount / summary.totalVenues) * 100)
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
    <div className="h-auto min-h-screen max-h-screen w-full overflow-y-auto bg-atx-paper text-atx-ink">
      <header className="border-b border-atx-line bg-atx-paper/95 p-4 backdrop-blur-md md:p-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ViewToggle variant="admin" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8B0000] shadow-[0_0_24px_rgba(139,0,0,0.45)]">
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
            percent={100}
            caption="100% of tracked Austin venues"
            tone="primary"
          />
          <StatCard
            icon={Radio}
            label="Live streams"
            value={summary.liveNowCount.toString()}
            percent={liveSharePercent}
            caption={`${liveSharePercent}% of venues broadcasting now`}
            tone="secondary"
          />
          <StatCard
            icon={Users}
            label="Local share"
            value={`${localSharePercent}%`}
            percent={localSharePercent}
            caption="Share of venues tagged as local acts"
            tone="primary"
          />
        </section>

        <section
          aria-label="Venues by district"
          className="rounded-2xl border border-atx-line bg-white p-5"
        >
          <h2 className="mb-4 text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
            District distribution
          </h2>
          <div className="flex flex-col gap-3">
            {districtCounts.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                count={row.count}
                maxCount={maxDistrictCount}
                fillClassName={ADMIN_GRADIENT_FILL}
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
                fillClassName="bg-atx-red"
              />
            ))}
            {summary.unspecifiedGenreCount > 0 ? (
              <BarRow
                label="Unspecified"
                count={summary.unspecifiedGenreCount}
                maxCount={maxGenreCount}
                fillClassName="bg-stone-400"
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
            <div className="rounded-xl border border-atx-line bg-[#8B0000]/10 p-4 text-center">
              <p className="text-2xl font-semibold text-[#8B0000]">{local}</p>
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
