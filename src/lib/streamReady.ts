import type { District, Pin } from "@/lib/types";

/**
 * Operator Pass O3 (spec art_zVtFFMSp, Move O3) — stream-ready readiness
 * helpers. The flag is seed-entry data (see VenueTemplate.streamReady in
 * seedData.ts); these are pure reads and filters over it. No persistence,
 * no API routes — the `streamUrl` seam belongs to the streaming spec
 * (locked decision #4).
 */

/** True only when the seed entry explicitly set the camera-ready flag. */
export function isStreamReady(pin: Pin): boolean {
  return pin.streamReady === true;
}

/** The console's filter-row state: a readiness toggle plus a district. */
export type StreamReadyFilter = {
  /** When true, only camera-ready venues survive the filter. */
  streamReadyOnly: boolean;
  /** District filter; undefined matches every district. */
  district?: District;
};

/**
 * Pure filter over the seed pins honored by the operator console's
 * screen. Returns a new array; never mutates its input (the seed is
 * module state and must stay untouched).
 */
export function filterVenues(pins: Pin[], filter: StreamReadyFilter): Pin[] {
  return pins.filter(
    (pin) =>
      (!filter.streamReadyOnly || isStreamReady(pin)) &&
      (filter.district === undefined || pin.district === filter.district),
  );
}
