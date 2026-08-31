import {
  ATXLiveIntelligenceEngine,
  type DecibelAccelerationResult,
} from "@/lib/intelligenceEngine";
import type { StoredShow } from "@/lib/shows";
import { requestJson } from "@/lib/transport";

/**
 * Venue Studio domain logic (PR 33 — fifth surface).
 *
 * The paste's VenueStudioView hardcoded its telemetry threshold and kept
 * published shows in client state. This module holds the real wiring as
 * pure, unit-tested functions:
 *
 *  - the Sound Telemetry Guard's readings history and operator actions
 *    (append a reading, lower master volume with a floor, reset baseline),
 *    evaluated through ATXLiveIntelligenceEngine.evaluateDecibelAcceleration
 *    so predicted dB, the pre-violation flag, the recommended drop, and the
 *    message all come from the engine — never a hardcoded threshold;
 *  - the published-shows feed filter over GET /api/shows, narrowed to the
 *    venue's own venue name.
 *
 * Framework-agnostic: no React imports. `fetchVenueShows` is the only
 * network touchpoint and never throws — the view renders the typed failure.
 */

/** The venue this studio operates. Publishes and filters under this name. */
export const VENUE_VENUE_NAME = "Empire Control Room";

/** Ordinance decibel cap for the venue (the paste's 85 dB limit). */
export const VENUE_DB_LIMIT = 85;

/** Baseline reading the monitor boots at (the paste's 84 dB default). */
export const VENUE_BASELINE_DB = 84;

/** 'Lower Master Volume' step in dB. */
export const VOLUME_STEP_DB = 3;

/** Master volume never drops below this floor. */
export const VOLUME_FLOOR_DB = 70;

/** Stable telemetry identity passed to the engine (mirrors audit row ids). */
export const VENUE_TELEMETRY_ID = "v-venue-studio";

/**
 * Appends one reading to the operator's readings history. Pure — the view
 * calls this on every fader action so the engine's acceleration and
 * prediction update from real history, not a static snapshot.
 */
export function appendReading(history: number[], reading: number): number[] {
  return [...history, reading];
}

/**
 * Operator action: lower master volume by VOLUME_STEP_DB, clamped to the
 * floor. Pure so the floor rule is unit-testable.
 */
export function lowerMasterVolume(currentDb: number): number {
  return Math.max(VOLUME_FLOOR_DB, currentDb - VOLUME_STEP_DB);
}

/**
 * Evaluates the guard for the venue's current readings history and level.
 * A thin typed wrapper over the engine — the single place the view touches
 * evaluateDecibelAcceleration, so the venue id and defaults stay consistent.
 */
export function evaluateTelemetry(
  readings: number[],
  currentDb: number,
): DecibelAccelerationResult {
  return ATXLiveIntelligenceEngine.evaluateDecibelAcceleration({
    venueId: VENUE_TELEMETRY_ID,
    readingsOverTime: readings,
    currentDb,
    limitDb: VENUE_DB_LIMIT,
  });
}

/**
 * Pure feed filter: narrows GET /api/shows records to this venue's shows.
 * The venue studio's published list shows only shows published under its
 * own venue name — other artists' venues stay on the fan map, not here.
 */
export function venueShowsFromRecords(
  records: StoredShow[],
  venueName: string = VENUE_VENUE_NAME,
): StoredShow[] {
  return records.filter((record) => record.venue_name === venueName);
}

/** Result of the published-shows fetch — the view renders every branch. */
export type FetchVenueShowsResult =
  | { ok: true; shows: StoredShow[] }
  | { ok: false; error: string };

/**
 * Reads GET /api/shows and narrows it to the venue's shows. Never throws —
 * transport failures and malformed bodies resolve as typed failures so the
 * view can degrade to the empty state instead of crashing the page.
 */
export async function fetchVenueShows(
  venueName: string = VENUE_VENUE_NAME,
): Promise<FetchVenueShowsResult> {
  const result = await requestJson("/api/shows");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  if (!Array.isArray(result.body)) {
    return { ok: false, error: "Server returned an unexpected response." };
  }
  return { ok: true, shows: venueShowsFromRecords(result.body, venueName) };
}
