"use client";

import { useState } from "react";
import { BadgeDollarSign, Gauge, Scale, Search, ShieldAlert } from "lucide-react";
import {
  CIVIC_COMPLIANCE_DATA,
  deriveVenueStatus,
  filterVenuesByName,
  type VenueAuditStatus,
} from "@/lib/civic";

/**
 * Civic Compliance & Economic Telemetry section for /admin. All figures are
 * deterministic display contracts (see src/lib/civic.ts) — labeled as such,
 * never as real-time feeds. Themed with the app's white/dark-red/electric-blue
 * tokens; status colors match the audio-compliance widget's language.
 */

/** Status pill tone per audit state — matches the admin compliance chips. */
const VENUE_STATUS_PILL_CLASSES: Record<VenueAuditStatus, string> = {
  OVER_LIMIT: "bg-[#8B0000]/15 text-[#8B0000]",
  COMPLIANT: "bg-atx-blue/15 text-atx-blue-deep",
};

function VenueStatusPill({ status }: { status: VenueAuditStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${VENUE_STATUS_PILL_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}

interface MetricCardProps {
  icon: typeof Gauge;
  label: string;
  value: string;
  caption: string;
  /** "violation" tints the value dark red, matching the over-limit chip. */
  tone?: "default" | "violation";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "default",
}: MetricCardProps) {
  const valueClasses =
    tone === "violation"
      ? "font-display text-3xl font-bold text-[#8B0000] md:text-4xl"
      : "font-display text-3xl font-bold text-atx-blue-deep md:text-4xl";
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
      <span className={valueClasses}>{value}</span>
      <span className="text-xs text-stone-500">{caption}</span>
    </div>
  );
}

export default function CivicComplianceSection({
  userRole = "SUPER_ADMIN",
  venueId = null,
}: {
  /** Display-only role badge from the pasted contract. */
  userRole?: string;
  /** Initial name-substring filter for the audit table (null = all venues). */
  venueId?: string | null;
}) {
  const [query, setQuery] = useState(venueId ?? "");
  const { venueAuditRows } = CIVIC_COMPLIANCE_DATA;
  const visibleVenues = filterVenuesByName(venueAuditRows, query);

  return (
    <section
      aria-label="Civic compliance and economic telemetry"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#8B0000]" />
          <h2 className="text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
            Civic Compliance &amp; Economic Telemetry
          </h2>
        </div>
        <span className="rounded-full border border-atx-line bg-white px-3 py-1 text-xs font-semibold text-stone-500">
          {userRole}
        </span>
      </div>
      <p className="text-xs text-stone-500">
        Deterministic telemetry — fixed display figures, not real-time feeds.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Gauge}
          label="Active Stage Utilization"
          value={CIVIC_COMPLIANCE_DATA.activeStageUtilization}
          caption="Share of tracked stages hosting a live act tonight"
        />
        <MetricCard
          icon={BadgeDollarSign}
          label="Est. MBGRT Tax Yield"
          value={CIVIC_COMPLIANCE_DATA.estMbrtTaxYieldUsd}
          caption={`Based on ${CIVIC_COMPLIANCE_DATA.mbrtTaxRateLabel}`}
        />
        <MetricCard
          icon={Scale}
          label="Ordinance Compliance"
          value={CIVIC_COMPLIANCE_DATA.ordinanceComplianceRate}
          caption={`${CIVIC_COMPLIANCE_DATA.ordinanceViolationsCount} venues over their decibel ordinance`}
          tone="violation"
        />
      </div>

      <div className="rounded-2xl border border-atx-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-[0.1em] text-stone-500 uppercase">
            Live Decibel (dB) &amp; Ordinance Audit
          </h3>
          <label className="flex items-center gap-2 rounded-xl border border-atx-line bg-atx-paper px-3 py-1.5">
            <Search className="h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter venues by name"
              aria-label="Filter audit venues by name"
              className="w-44 bg-transparent text-sm text-atx-ink outline-none placeholder:text-stone-400"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {visibleVenues.map((venue) => {
            const status = deriveVenueStatus(venue.currentDb, venue.limitDb);
            return (
              <div
                key={venue.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-atx-line bg-atx-paper p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0 rounded-md bg-[#0055FF]/10 px-2 py-0.5 text-xs font-semibold text-[#0055FF]">
                    {venue.district}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-atx-ink">
                      {venue.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {venue.currentDb} dB vs limit {venue.limitDb} dB
                    </p>
                  </div>
                </div>
                <VenueStatusPill status={status} />
              </div>
            );
          })}
          {visibleVenues.length === 0 ? (
            <p className="rounded-xl border border-atx-line bg-atx-paper p-3 text-sm text-stone-500">
              No venues match that name.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
