import {
  DEFAULT_CURFEW_RULES,
  type CurfewRule,
} from "@/lib/masterSdk";
import {
  VENUE_AUDIT_ROWS,
  deriveVenueStatus,
  type VenueAuditRow,
  type VenueAuditStatus,
} from "@/lib/civic";
import { districtForPoint } from "@/lib/district";
import { CITY_PINS } from "@/lib/seedData";
import { VENUE_VENUE_NAME } from "@/lib/venueStudio";
import type { District } from "@/lib/types";
import type { ATXDistrict } from "@/lib/venueStudioBlueprint";

/**
 * Operator Console domain logic (Operator Pass O2 — spec art_zVtFFMSp).
 *
 * Every figure this module returns comes from a source that already exists
 * — no second source of truth:
 *
 *  - Curfew state: DEFAULT_CURFEW_RULES + ATXLiveEngine.evaluateCurfewStatus
 *    (masterSdk.ts) — the same engine the Sound Telemetry Guard and the
 *    master-SDK ping read. Edits are client-state-only (spec locked
 *    decision #4): applyCurfewEdit returns a new rule and the caller
 *    re-derives status through the engine; nothing persists.
 *  - Sound level now + the last-hour trace: anchored to the admin audit
 *    contract (civic.ts VENUE_AUDIT_ROWS) and derived deterministically
 *    from a fixed-seed PRNG keyed on the venue name — byte-identical
 *    across reloads, the discipline seedData.ts establishes.
 *
 * Framework-agnostic: no React imports, nothing async, no clock reads —
 * every function takes its `now` explicitly so tests are deterministic.
 */

// ── Seed-district → curfew-family mapping ────────────────────────────────

/**
 * The map seed classifies venues into five coarse districts
 * (districtForPoint); the curfew engine's families are the eight
 * ATXDistrict keys of DEFAULT_CURFEW_RULES. This plumbing table is the
 * single documented bridge — a map district never borrows a family's
 * figures silently, it maps through here.
 *
 * Consequences of the coarse classifier, kept honest rather than flattened:
 * the seed's "South" band covers S Lamar/deep SoCo and maps to SOUTH_LAMAR;
 * "West" has no dedicated family and maps to the engine's GREATER_AUSTIN
 * default; "North" maps to DOMAIN (the seed's north anchor is the Domain).
 * Red River and Rainey stay selectable directly from the family list.
 */
export const CURFEW_FAMILY_BY_MAP_DISTRICT: Record<District, ATXDistrict> = {
  Downtown: "DOWNTOWN",
  East: "EAST_AUSTIN",
  South: "SOUTH_LAMAR",
  North: "DOMAIN",
  West: "GREATER_AUSTIN",
};

/** All curfew family keys, in engine seed order — the console's selector. */
export const CURFEW_FAMILY_IDS: ATXDistrict[] = Object.keys(
  DEFAULT_CURFEW_RULES,
) as ATXDistrict[];

/**
 * Classifies a coordinate through the map's classifier and bridges to the
 * curfew family. Outside AUSTIN_BOUNDS → undefined (the documented
 * districtForPoint fallback — never a guessed district).
 */
export function curfewFamilyForPoint(
  lat: number,
  lng: number,
): ATXDistrict | undefined {
  const seedDistrict = districtForPoint(lat, lng);
  return seedDistrict === undefined
    ? undefined
    : CURFEW_FAMILY_BY_MAP_DISTRICT[seedDistrict];
}

/** The seed pin this studio operates. */
export const OPERATOR_SEED_PIN = CITY_PINS.find(
  (pin) => pin.performerName === "Warehouse Six",
);

/** The seed district of the operator venue (undefined if the seed changes). */
export const OPERATOR_MAP_DISTRICT: District | undefined =
  OPERATOR_SEED_PIN?.district;

// ── Client-state-only curfew edit ────────────────────────────────────────

export interface CurfewEdit {
  startHour24?: number;
  endHour24?: number;
  standardCapDb?: number;
  curfewCapDb?: number;
}

const MIN_HOUR = 0;
const MAX_HOUR = 23;
const MIN_CAP_DB = 50;
const MAX_CAP_DB = 120;

function isUsableHour(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isInteger(value) &&
    value >= MIN_HOUR &&
    value <= MAX_HOUR
  );
}

function isUsableCap(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isFinite(value) &&
    value >= MIN_CAP_DB &&
    value <= MAX_CAP_DB
  );
}

/**
 * Applies an operator edit to a curfew rule, returning a NEW rule — the
 * seed record is never mutated (spec locked decision #4). Out-of-range or
 * non-finite edit fields are ignored rather than clamped into invented
 * values, so the UI never shows a schedule the operator did not set.
 */
export function applyCurfewEdit(
  rule: CurfewRule,
  edit: CurfewEdit,
): CurfewRule {
  return {
    district: rule.district,
    startHour24: isUsableHour(edit.startHour24)
      ? edit.startHour24
      : rule.startHour24,
    endHour24: isUsableHour(edit.endHour24) ? edit.endHour24 : rule.endHour24,
    standardCapDb: isUsableCap(edit.standardCapDb)
      ? edit.standardCapDb
      : rule.standardCapDb,
    curfewCapDb: isUsableCap(edit.curfewCapDb)
      ? edit.curfewCapDb
      : rule.curfewCapDb,
  };
}

// ── Room-status timing ───────────────────────────────────────────────────

/**
 * Seconds until the curfew state next flips: until curfew end when the
 * window is active, until curfew start during standard hours. Midnight-
 * spanning windows follow the engine's own getHours logic; values are
 * whole seconds derived from the rule's whole hours, so two calls in the
 * same minute agree.
 */
export function secondsToCurfewBoundary(
  now: Date,
  rule: CurfewRule,
): number {
  const start = rule.startHour24 > rule.endHour24
    ? now.getHours() >= rule.startHour24 || now.getHours() < rule.endHour24
    : now.getHours() >= rule.startHour24 && now.getHours() < rule.endHour24;
  const targetHour = start ? rule.endHour24 : rule.startHour24;
  const secondsOfDay =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const delta = targetHour * 3600 - secondsOfDay;
  // mod-normalize: a boundary earlier today reads as time until tomorrow's
  // boundary (e.g. 23:30 counting down to the 06:00 curfew end).
  return delta <= 0 ? delta + 24 * 3600 : delta;
}

/**
 * Formats a boundary countdown as `Hh Mm` / `Mm` — minute precision,
 * because the countdown source (the rule's whole hours) cannot honestly
 * claim finer granularity.
 */
export function formatCurfewCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// ── Sound level now + last hour (admin-contract anchored) ───────────────

/** Number of buckets in the last-hour trace (12 × 5 min = 60 min). */
export const OPERATOR_SOUND_BUCKETS = 12;

/** Minutes each last-hour trace bucket covers. */
export const OPERATOR_BUCKET_MINUTES = 5;

/**
 * The venue's row in the admin audit contract (civic.ts), or undefined if
 * admin has no row under this name — the console renders that absence as
 * "no admin audit row" rather than inventing a reading.
 */
export function adminAuditRowForVenue(
  venueName: string = VENUE_VENUE_NAME,
): VenueAuditRow | undefined {
  return VENUE_AUDIT_ROWS.find((row) => row.name === venueName);
}

export interface VenueSoundNow {
  currentDb: number;
  limitDb: number;
  /** The same classifier /admin renders in its ordinance audit table. */
  status: VenueAuditStatus;
}

/** Sound-now read straight off the admin audit contract. */
export function venueSoundNow(
  venueName: string = VENUE_VENUE_NAME,
): VenueSoundNow | null {
  const row = adminAuditRowForVenue(venueName);
  if (row === undefined) {
    return null;
  }
  return { currentDb: row.currentDb, limitDb: row.limitDb, status: deriveVenueStatus(row.currentDb, row.limitDb) };
}

/** FNV-1a — stable non-cryptographic key for the per-venue PRNG seed. */
function hashVenueName(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — the same fixed-seed PRNG discipline as seedData.ts. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WANDER_DB = 4;

/**
 * Deterministic last-hour trace: OPERATOR_SOUND_BUCKETS 5-minute readings
 * ending at the venue's admin-contract reading, each drifting at most
 * WANDER_DB around it via a fixed-seed PRNG keyed on the venue name. Two
 * calls for the same venue/name are deep-equal across reloads — the same
 * numbers a second of this module computing for /admin's row would see.
 * Anchor defaults to the admin row's currentDb; an explicit anchor keeps
 * the function total for venues with no admin row (all-constant trace).
 */
export function venueSoundHistory(
  venueName: string = VENUE_VENUE_NAME,
  anchorDb?: number,
): number[] {
  const row = adminAuditRowForVenue(venueName);
  const anchor = anchorDb ?? row?.currentDb ?? 0;
  if (row === undefined && anchorDb === undefined) {
    // No admin contract and no anchor: an honest empty trace, not zeros
    // pretending to be readings.
    return [];
  }
  const rng = mulberry32(hashVenueName(venueName));
  return Array.from({ length: OPERATOR_SOUND_BUCKETS }, (_, index) => {
    if (index === OPERATOR_SOUND_BUCKETS - 1) {
      return anchor; // the last bucket IS the admin-contract reading
    }
    const wander = Math.round(rng() * (2 * WANDER_DB) - WANDER_DB);
    return Math.max(0, anchor + wander);
  });
}
