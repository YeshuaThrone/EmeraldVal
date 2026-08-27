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
