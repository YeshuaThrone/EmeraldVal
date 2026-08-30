import {
  BarChart3,
  Building2,
  Guitar,
  MapPinned,
  Music4,
  Radio,
  ShieldAlert,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react";
import { DISTRICTS, summarizeAnalytics } from "@/lib/analytics";
import {
  COUNCIL_DISTRICT_SHOW_DENSITY,
  DISTRICT_SOUND_DENSITY_INDEX,
  LOCAL_ARTIST_SHARE_PERCENT,
  MUNICIPAL_DATA,
  NIGHTTIME_ECONOMY_IMPACT_USD,
  OUTDOOR_STAGES,
  classifyDecibel,
  type ComplianceStatus,
} from "@/lib/municipal";
import { CITY_PINS } from "@/lib/seedData";
import CivicComplianceSection from "@/components/CivicComplianceSection";
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

/**
 * A single civic data card: icon chip + headline value + caption, in the
 * same white/dark-red/electric-blue admin palette as the headline
 * StatCards above. Used for the three flat contract figures (foot
 * traffic, local share, nighttime impact) that don't carry a progress bar.
 */
function CivicStatCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-atx-line bg-white p-5 shadow-[0_0_0_1px_rgba(28,25,23,0.05)]">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B0000]/15 text-[#8B0000]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">
          {label}
        </span>
      </div>
      <span className="font-display text-3xl font-bold text-atx-blue-deep md:text-4xl">
        {value}
      </span>
      <span className="text-xs text-stone-500">{caption}</span>
    </div>
  );
}

/**
 * Card 4 — District Sound & Density Index. Renders each district's index
 * as an animated bar row (reusing AnimatedBar) with the percent label, all
 * inside the same civic-card shell as the other three cards.
 */
function SoundDensityIndexCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-atx-line bg-white p-5 shadow-[0_0_0_1px_rgba(28,25,23,0.05)] sm:col-span-2 lg:col-span-1">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0055FF]/15 text-[#0055FF]">
          <Volume2 className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">
          District sound &amp; density index
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {DISTRICT_SOUND_DENSITY_INDEX.map((entry) => (
          <div key={entry.district} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-stone-600">
              {entry.district}
            </span>
            <AnimatedBar
              percent={entry.indexPercent}
              fillClassName="bg-gradient-to-r from-[#8B0000] to-[#0055FF]"
              className="flex-1"
            />
            <span className="w-20 shrink-0 text-right text-sm font-semibold text-atx-ink">
              {entry.indexPercent}% index
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One horizontal row in the council-district distribution chart. */
function CouncilDistrictRow({
  number,
  name,
  showDensity,
}: {
  number: number;
  name: string;
  showDensity: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-stone-600">
        District {number} &middot; {name}
      </span>
      <AnimatedBar
        percent={showDensity}
        fillClassName={ADMIN_GRADIENT_FILL}
        className="flex-1"
      />
      <span className="w-8 shrink-0 text-right text-sm font-semibold text-atx-ink">
        {showDensity}
      </span>
    </div>
  );
}

/** Status chip tone per compliance state — matches the admin dark-red/blue palette. */
const COMPLIANCE_CHIP_CLASSES: Record<ComplianceStatus, string> = {
  Compliant: "bg-atx-blue/15 text-atx-blue-deep",
  Warning: "bg-amber-100 text-amber-700",
  "Over Limit": "bg-[#8B0000]/15 text-[#8B0000]",
};

function ComplianceChip({ status }: { status: ComplianceStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${COMPLIANCE_CHIP_CLASSES[status]}`}
    >
      {status}
    </span>
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

  const stageCompliance = OUTDOOR_STAGES.map((stage) => ({
    ...stage,
    status: classifyDecibel(stage.currentDb, stage.zoningLimitDb),
  }));
  const complianceSummary = stageCompliance.reduce(
    (acc, stage) => {
      acc[stage.status] += 1;
      return acc;
    },
    { Compliant: 0, Warning: 0, "Over Limit": 0 } as Record<
      ComplianceStatus,
      number
    >,
  );

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

        <section
          aria-label="Municipal analytics"
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#8B0000]" />
            <h2 className="text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
              Municipal analytics
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CivicStatCard
              icon={TrendingUp}
              label="Citywide real-time foot traffic"
              value={MUNICIPAL_DATA.activeFans.toLocaleString()}
              caption={`Active fans tracked across ${MUNICIPAL_DATA.activeVenueCount} active live venues`}
            />
            <CivicStatCard
              icon={Music4}
              label="Local artist economic share"
              value={`${LOCAL_ARTIST_SHARE_PERCENT}%`}
              caption="Local Austin indie talent vs. national touring acts"
            />
            <CivicStatCard
              icon={Building2}
              label="Est. nighttime economy impact"
              value={`$${NIGHTTIME_ECONOMY_IMPACT_USD.toLocaleString()}`}
              caption="Projected venue/hospitality spend tonight"
            />
            <SoundDensityIndexCard />
          </div>
        </section>

        <section
          aria-label="Council district distribution"
          className="rounded-2xl border border-atx-line bg-white p-5"
        >
          <h2 className="mb-4 text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
            Council district distribution
          </h2>
          <div className="flex flex-col gap-3">
            {COUNCIL_DISTRICT_SHOW_DENSITY.map((entry) => (
              <CouncilDistrictRow
                key={entry.number}
                number={entry.number}
                name={entry.name}
                showDensity={entry.showDensity}
              />
            ))}
          </div>
        </section>

        <section
          aria-label="Live audio compliance and zoning"
          className="rounded-2xl border border-atx-line bg-atx-paper p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#8B0000]" />
            <h2 className="text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
              Live audio compliance &amp; zoning
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {stageCompliance.map((stage) => (
              <div
                key={stage.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-atx-line bg-white p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-atx-ink">
                    {stage.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {stage.district} &middot; {stage.currentDb} dB (zoning
                    limit {stage.zoningLimitDb} dB)
                  </p>
                </div>
                <ComplianceChip status={stage.status} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold text-stone-500">
            {complianceSummary.Compliant} compliant &middot;{" "}
            {complianceSummary.Warning} warning &middot;{" "}
            {complianceSummary["Over Limit"]} over limit
          </p>
        </section>
        <CivicComplianceSection />
      </main>
    </div>
  );
}
