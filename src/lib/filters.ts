import type { Genre, Pin, PinSource } from "@/lib/types";

export interface PinFilter {
  /**
   * Empty array = no genre restriction. "" is the legitimate
   * "Unspecified" bucket (Pin.genre for search/map-dropped pins), so this
   * mirrors Pin["genre"] rather than the narrower Genre union.
   */
  genres: Array<Genre | "">;
  /** When non-empty, only pins whose source is listed survive. */
  sources: PinSource[];
  /** Case-insensitive substring match on performerName or locationName. */
  query: string;
}

export const EMPTY_FILTER: PinFilter = { genres: [], sources: [], query: "" };

/**
 * "Dropped" is a single toggle in the UI (legend badge, FilterBar chip) but
 * spans two underlying Pin sources. Shared here so the legend and FilterBar
 * can never drift on what "dropped" means.
 */
export const DROPPED_SOURCES: PinSource[] = ["search", "map"];

/**
 * Toggles a group of sources together: on if any are missing from `current`,
 * off (removing all of them) if every source in the group is already active.
 * Used for both the single-source "live" toggle and the two-source "dropped"
 * toggle so the on/off semantics match everywhere sources are toggled.
 */
export function toggleSources(
  current: PinSource[],
  sources: PinSource[],
): PinSource[] {
  const allActive = sources.every((source) => current.includes(source));
  if (allActive) {
    return current.filter((source) => !sources.includes(source));
  }
  return [...new Set([...current, ...sources])];
}

export function isActive(filter: PinFilter): boolean {
  return (
    filter.genres.length > 0 ||
    filter.sources.length > 0 ||
    filter.query.trim() !== ""
  );
}

export function filterPins(pins: Pin[], filter: PinFilter): Pin[] {
  const q = filter.query.trim().toLowerCase();
  return pins.filter((pin) => {
    if (filter.sources.length > 0 && !filter.sources.includes(pin.source))
      return false;
    if (filter.genres.length > 0 && !filter.genres.includes(pin.genre))
      return false;
    if (q !== "") {
      const haystack = `${pin.performerName} ${pin.locationName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
