/**
 * Deterministic civic compliance & economic telemetry for the /admin
 * dashboard. Labeled as deterministic telemetry like the rest of the
 * municipal suite, never as a real-time feed. The MBGRT tax yield is a
 * mathematical contract — gross beverage receipts (synced to the municipal
 * suite's nighttime economic impact, never duplicated) times the official
 * Texas MBGRT rate — computed through `calculateTaxYield` rather than
 * stored as a literal.
 */

import { NIGHTTIME_ECONOMY_IMPACT_USD } from "./municipal";

/** Official Texas Mixed Beverage Gross Receipts Tax rate (6.7%). */
export const MBGRT_RATE = 0.067;

/**
 * Gross beverage receipts backing the tax yield — matched directly to
 * citywide nighttime economic impact. Imported from the municipal suite
 * so the two dashboards can never drift (a test asserts the equality).
 */
export const GROSS_BEVERAGE_RECEIPTS_USD = NIGHTTIME_ECONOMY_IMPACT_USD;

/**
 * Pure MBGRT yield calculator: receipts × rate, formatted as en-US USD
 * with no fraction digits (e.g. 142500 × 0.067 → "$9,548").
 */
export function calculateTaxYield(receipts: number, rate: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(receipts * rate);
}

/** Audit outcome for a venue's decibel reading against its ordinance limit. */
export type VenueAuditStatus = "OVER_LIMIT" | "COMPLIANT";

/** One per-venue row of the Live Decibel (dB) & Ordinance Audit table. */
export interface VenueAuditRow {
  /** Venue display name. */
  name: string;
  /** Council district label, e.g. "D9". */
  district: string;
  /** Current measured decibel level. */
  currentDb: number;
  /** Ordinance decibel cap for the venue. */
  limitDb: number;
}

/** Card 1 — Active Stage Utilization, percent of stages in use tonight. */
export const ACTIVE_STAGE_UTILIZATION_PERCENT = "84.2%";

/** Card 2 — Estimated MBGRT (Mixed Beverage Gross Receipts Tax) yield, USD. */
export const EST_MBGRT_TAX_YIELD_USD = calculateTaxYield(
  GROSS_BEVERAGE_RECEIPTS_USD,
  MBGRT_RATE,
);

/** Card 2 caption — the tax basis behind the yield figure. */
export const MBGRT_TAX_RATE_LABEL = "Texas 6.7% MBGRT venue tax rate";

/** Card 3 — Ordinance compliance rate across audited venues, percent. */
export const ORDINANCE_COMPLIANCE_RATE = "92%";

/** Card 3 — venues currently in violation of the decibel ordinance. */
export const ORDINANCE_VIOLATIONS_COUNT = 2;

/**
 * Per-venue decibel audit rows, in fixed display order. Two venues sit
 * over their ordinance caps on purpose so both audit states are exercised
 * in the default dataset.
 */
export const VENUE_AUDIT_ROWS: VenueAuditRow[] = [
  { name: "Empire Control Room", district: "D9", currentDb: 88, limitDb: 85 },
  { name: "Far Out Lounge", district: "D2", currentDb: 79, limitDb: 80 },
  { name: "Mohawk", district: "D9", currentDb: 91, limitDb: 85 },
  { name: "The Continental Club", district: "D9", currentDb: 74, limitDb: 80 },
  { name: "C-Boy's Heart & Soul", district: "D9", currentDb: 72, limitDb: 75 },
];

/** Single import surface for the /admin civic compliance section. */
export const CIVIC_COMPLIANCE_DATA = {
  activeStageUtilization: ACTIVE_STAGE_UTILIZATION_PERCENT,
  estMbrtTaxYieldUsd: EST_MBGRT_TAX_YIELD_USD,
  mbrtTaxRateLabel: MBGRT_TAX_RATE_LABEL,
  ordinanceComplianceRate: ORDINANCE_COMPLIANCE_RATE,
  ordinanceViolationsCount: ORDINANCE_VIOLATIONS_COUNT,
  venueAuditRows: VENUE_AUDIT_ROWS,
} as const;

/**
 * Pure audit classifier: a venue is OVER_LIMIT the moment its current
 * reading exceeds the ordinance cap — there is no warning band in this
 * contract (unlike `classifyDecibel` in municipal.ts, which has one).
 */
export function deriveVenueStatus(
  currentDb: number,
  limitDb: number,
): VenueAuditStatus {
  return currentDb > limitDb ? "OVER_LIMIT" : "COMPLIANT";
}

/**
 * Case-insensitive name-substring filter over audit rows. A null, empty,
 * or whitespace-only query returns every venue unchanged — this is the
 * usable form of the pasted component's `venueId` prop contract.
 */
export function filterVenuesByName(
  venues: VenueAuditRow[],
  query: string | null,
): VenueAuditRow[] {
  const normalized = query?.trim().toLowerCase() ?? "";
  if (normalized === "") {
    return venues;
  }
  return venues.filter((venue) =>
    venue.name.toLowerCase().includes(normalized),
  );
}
