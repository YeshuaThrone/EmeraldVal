import type { District, Genre, Pin } from "@/lib/types";

/**
 * One venue's live lineup, derived from the live pins currently there: its
 * distinct genres (first-seen order), its district, and the ids of the
 * backing pins so the Festival Hub can build selection/tip links back to
 * those performers on the fan map.
 */
export type FestivalLineup = {
  venue: string;
  genres: Genre[];
  district: District | undefined;
  pinIds: string[];
};

/**
 * Groups live pins (source "live") by venue (locationName) into festival
 * lineups for the Festival Hub. Non-live pins are excluded entirely — the
 * hub only shows what's happening right now. Pins with no genre recorded
 * ("") don't contribute a genre entry but still count toward pinIds.
 * Result is sorted alphabetically by venue for a stable render order.
 */
export function festivalLineups(pins: Pin[]): FestivalLineup[] {
  const byVenue = new Map<string, FestivalLineup>();

  for (const pin of pins) {
    if (pin.source !== "live") {
      continue;
    }

    const existing = byVenue.get(pin.locationName);
    if (existing) {
      if (pin.genre !== "" && !existing.genres.includes(pin.genre)) {
        existing.genres.push(pin.genre);
      }
      existing.pinIds.push(pin.id);
    } else {
      byVenue.set(pin.locationName, {
        venue: pin.locationName,
        genres: pin.genre === "" ? [] : [pin.genre],
        district: pin.district,
        pinIds: [pin.id],
      });
    }
  }

  return [...byVenue.values()].sort((a, b) => a.venue.localeCompare(b.venue));
}

/**
 * Genre filter value for the Festival Hub's filter row. "All" clears the
 * filter; "Unspecified" isolates lineups whose live pins carried no genre
 * at all (mirrors FilterBar's "Unspecified" chip for the same Genre type).
 */
export type LineupGenreFilter = Genre | "All" | "Unspecified";

/**
 * Lineups matching the selected genre filter. "All" passes every lineup
 * through unfiltered; "Unspecified" matches lineups with zero genres
 * recorded; any real Genre matches lineups whose genre list includes it.
 */
export function filterLineupsByGenre(
  lineups: FestivalLineup[],
  genre: LineupGenreFilter,
): FestivalLineup[] {
  if (genre === "All") {
    return lineups;
  }
  if (genre === "Unspecified") {
    return lineups.filter((lineup) => lineup.genres.length === 0);
  }
  return lineups.filter((lineup) => lineup.genres.includes(genre));
}
