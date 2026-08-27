import { CITY_PINS } from "@/lib/seedData";

/**
 * Deterministic municipal analytics for the /admin civic dashboard. Every
 * figure here is a fixed display contract (user-specified, not recomputed
 * from the seed) with one exception: `activeVenueCount`, which is derived
 * from `CITY_PINS.length` so the "36 active live venues" figure can never
 * silently drift from the actual seed size. See the blueprint's locked
 * decision: "User figures are the display contract."
 */

export interface DistrictSoundIndexEntry {
  /** Display name of the cultural district (not the Pin `District` enum). */
  district: string;
  /** Sound & density index, 0-100. */
  indexPercent: number;
}

export interface CouncilDistrictEntry {
  /** Austin City Council district number. */
  number: number;
  /** Short geographic label for the district. */
  name: string;
  /** Active show density, 0-100, used to size the distribution bar. */
  showDensity: number;
}

export interface OutdoorStage {
  name: string;
  district: string;
  currentDb: number;
  zoningLimitDb: number;
}

export type ComplianceStatus = "Compliant" | "Warning" | "Over Limit";

/** Card 1 — Citywide Real-Time Foot Traffic: active fans tracked tonight. */
export const ACTIVE_FANS = 14280;

/**
 * Card 1 — active live venues, derived from the seed so it never drifts
 * from the real pin count (currently 36, matching the contract figure).
 */
export const ACTIVE_VENUE_COUNT = CITY_PINS.length;

/** Card 2 — Local Artist Economic Share, percent. */
export const LOCAL_ARTIST_SHARE_PERCENT = 78.4;

/** Card 3 — Estimated Nighttime Economy Impact, USD. */
export const NIGHTTIME_ECONOMY_IMPACT_USD = 142500;

/** Card 4 — District Sound & Density Index, in fixed display order. */
export const DISTRICT_SOUND_DENSITY_INDEX: DistrictSoundIndexEntry[] = [
  { district: "Downtown", indexPercent: 92 },
  { district: "East Austin", indexPercent: 64 },
  { district: "South Congress", indexPercent: 81 },
  { district: "North Loop", indexPercent: 45 },
];

/**
 * Council-district active show density, in fixed display order. These are
 * Austin City Council districts (civic numbering) — a distinct axis from
 * the app's five-way Pin `District` field used elsewhere on /admin.
 */
export const COUNCIL_DISTRICT_SHOW_DENSITY: CouncilDistrictEntry[] = [
  { number: 1, name: "East", showDensity: 58 },
  { number: 3, name: "Southeast", showDensity: 37 },
  { number: 9, name: "Downtown/UT", showDensity: 96 },
  { number: 5, name: "South", showDensity: 72 },
];

/**
 * Outdoor stage decibel readings against each stage's zoning limit. Mixed
 * compliance on purpose (Compliant, Warning-band, and Over Limit stages all
 * present) so the widget's three states are all exercised in the default
 * dataset.
 */
export const OUTDOOR_STAGES: OutdoorStage[] = [
  {
    name: "Waterloo Park Main Stage",
    district: "Downtown",
    currentDb: 88,
    zoningLimitDb: 85,
  },
  {
    name: "Rainey Street Amphitheater",
    district: "East",
    currentDb: 83,
    zoningLimitDb: 85,
  },
  {
    name: "South Congress Plaza",
    district: "South Congress",
    currentDb: 74,
    zoningLimitDb: 80,
  },
  {
    name: "Red River Block Stage",
    district: "Downtown",
    currentDb: 91,
    zoningLimitDb: 85,
  },
  {
    name: "North Loop Green",
    district: "North Loop",
    currentDb: 62,
    zoningLimitDb: 75,
  },
];

/** Single import surface for the /admin municipal suite. */
export const MUNICIPAL_DATA = {
  activeFans: ACTIVE_FANS,
  activeVenueCount: ACTIVE_VENUE_COUNT,
  localArtistSharePercent: LOCAL_ARTIST_SHARE_PERCENT,
  nighttimeEconomyImpactUsd: NIGHTTIME_ECONOMY_IMPACT_USD,
  districtSoundDensityIndex: DISTRICT_SOUND_DENSITY_INDEX,
  councilDistrictShowDensity: COUNCIL_DISTRICT_SHOW_DENSITY,
  outdoorStages: OUTDOOR_STAGES,
};

/**
 * How far below the zoning limit a stage can sit before it's flagged as
 * "Warning" instead of "Compliant". 3dB is a perceptible-but-not-yet-over
 * safety margin — documented here since it's the one non-obvious threshold
 * in an otherwise literal comparison.
 */
const WARNING_MARGIN_DB = 3;

/**
 * Pure compliance classifier: Over Limit when the current reading exceeds
 * the zoning cap, Warning when it's within `WARNING_MARGIN_DB` of the cap
 * (inclusive), Compliant otherwise.
 */
export function classifyDecibel(
  currentDb: number,
  zoningLimitDb: number,
): ComplianceStatus {
  if (currentDb > zoningLimitDb) {
    return "Over Limit";
  }
  if (currentDb >= zoningLimitDb - WARNING_MARGIN_DB) {
    return "Warning";
  }
  return "Compliant";
}
