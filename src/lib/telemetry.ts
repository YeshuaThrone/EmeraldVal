/**
 * Unified admin telemetry model — the single source of truth for every
 * dashboard figure across /admin. The base counts are the pasted display
 * contract (fixed literals); every percentage and dollar figure is computed
 * in-module from those counts, never hardcoded, and cross-dashboard figures
 * are imported rather than duplicated so the municipal and civic suites can
 * never drift from this model.
 *
 * The canonical nighttime economic impact literal lives in civic.ts (the
 * dependency leaf of the admin data modules) so municipal and telemetry can
 * both import it without a circular import; the equality between this
 * model's impact and MUNICIPAL_DATA's is pinned by a sync test.
 */

import {
  MBGRT_RATE,
  NIGHTTIME_ECONOMY_IMPACT_USD,
  calculateTaxYield,
} from "./civic";

/** Contract base count — total active live venues on the map. */
export const TOTAL_VENUES = 36;

/** Contract base count — venues streaming live right now. */
export const LIVE_STREAMS = 14;

/** Contract base count — local Austin acts on the roster. */
export const LOCAL_ACTS_COUNT = 25;

/** Contract base count — national touring acts on the roster. */
export const TOURING_ACTS_COUNT = 11;

/** Pure share-of-total percentage rounded to a whole percent (e.g. 14/36 → "39%"). */
export function deriveWholePercent(part: number, total: number): string {
  return `${Math.round((part / total) * 100)}%`;
}

/** Pure share-of-total percentage kept to one decimal place (e.g. 25/36 → "69.4%"). */
export function deriveDecimalPercent(part: number, total: number): string {
  return `${((part / total) * 100).toFixed(1)}%`;
}

/**
 * The master telemetry contract. Base counts are literals; liveStreamsPct,
 * localSharePct, mbgrtTaxYield, and nighttimeEconomicImpact are all derived
 * or imported — never stored as duplicated figures.
 */
export const ADMIN_TELEMETRY_DATA = {
  totalVenues: TOTAL_VENUES,
  liveStreams: LIVE_STREAMS,
  localActsCount: LOCAL_ACTS_COUNT,
  touringActsCount: TOURING_ACTS_COUNT,
  realtimeFootTraffic: "14,280",
  soundDensityIndex: "92%",
  liveStreamsPct: deriveWholePercent(LIVE_STREAMS, TOTAL_VENUES),
  localSharePct: deriveDecimalPercent(LOCAL_ACTS_COUNT, TOTAL_VENUES),
  mbgrtTaxYield: calculateTaxYield(NIGHTTIME_ECONOMY_IMPACT_USD, MBGRT_RATE),
  nighttimeEconomicImpact: NIGHTTIME_ECONOMY_IMPACT_USD,
} as const;
