import { GENRES, type District, type Genre, type Pin } from "@/lib/types";

/** The five districts this app tracks, in the fixed display order used everywhere. */
export const DISTRICTS: District[] = ["Downtown", "North", "South", "East", "West"];

export interface LocalVsTouringSplit {
  local: number;
  touring: number;
  /** Pins with `isLocal` left undefined — no affiliation recorded. */
  unspecified: number;
}

export interface AnalyticsSummary {
  totalVenues: number;
  liveNowCount: number;
  venuesByDistrict: Record<District, number>;
  genreDistribution: Record<Genre, number>;
  /** Pins with `genre === ""` — no genre recorded. */
  unspecifiedGenreCount: number;
  localVsTouring: LocalVsTouringSplit;
}

/** Total number of venues in the pin set. */
export function totalVenues(pins: Pin[]): number {
  return pins.length;
}

/** Count of pins currently broadcasting live (source "live"). */
export function liveNowCount(pins: Pin[]): number {
  return pins.filter((pin) => pin.source === "live").length;
}

/**
 * Venue counts per district. All five District keys are always present
 * (zero-filled) so callers can render a stable bar breakdown without
 * checking for missing keys. Pins with no district (outside AUSTIN_BOUNDS)
 * are excluded from every bucket.
 */
export function venuesByDistrict(pins: Pin[]): Record<District, number> {
  const counts = DISTRICTS.reduce(
    (acc, district) => {
      acc[district] = 0;
      return acc;
    },
    {} as Record<District, number>,
  );

  for (const pin of pins) {
    if (pin.district) {
      counts[pin.district] += 1;
    }
  }

  return counts;
}

/**
 * Venue counts per genre. All five Genre keys are always present
 * (zero-filled); pins with an unspecified genre ("") are counted
 * separately via `unspecifiedGenreCount`, not folded into a genre bucket.
 */
export function genreDistribution(pins: Pin[]): Record<Genre, number> {
  const counts = GENRES.reduce(
    (acc, genre) => {
      acc[genre] = 0;
      return acc;
    },
    {} as Record<Genre, number>,
  );

  for (const pin of pins) {
    if (pin.genre !== "") {
      counts[pin.genre] += 1;
    }
  }

  return counts;
}

/** Count of pins with no genre recorded. */
export function unspecifiedGenreCount(pins: Pin[]): number {
  return pins.filter((pin) => pin.genre === "").length;
}

/**
 * Local vs. touring split, bucketed on the tri-state `isLocal` flag:
 * true (local), false (touring), or undefined (unspecified — the case for
 * every user-created pin, since only seeded venues carry the flag).
 */
export function localVsTouringSplit(pins: Pin[]): LocalVsTouringSplit {
  return pins.reduce<LocalVsTouringSplit>(
    (acc, pin) => {
      if (pin.isLocal === true) {
        acc.local += 1;
      } else if (pin.isLocal === false) {
        acc.touring += 1;
      } else {
        acc.unspecified += 1;
      }
      return acc;
    },
    { local: 0, touring: 0, unspecified: 0 },
  );
}

/** Full analytics summary over a pin set — the single call the dashboard needs. */
export function summarizeAnalytics(pins: Pin[]): AnalyticsSummary {
  return {
    totalVenues: totalVenues(pins),
    liveNowCount: liveNowCount(pins),
    venuesByDistrict: venuesByDistrict(pins),
    genreDistribution: genreDistribution(pins),
    unspecifiedGenreCount: unspecifiedGenreCount(pins),
    localVsTouring: localVsTouringSplit(pins),
  };
}
