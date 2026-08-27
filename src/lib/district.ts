import { AUSTIN_BOUNDS } from "@/lib/constants";
import type { District } from "@/lib/types";

/**
 * Pure classifier mapping a coordinate to one of the five Austin districts
 * this app tracks. It is a coarse, priority-ordered box partition of the
 * city — not a GIS lookup — because the "municipal dataset" is a mock seed
 * (see the blueprint's load-bearing assumption). Order matters: North is
 * carved out first because the Domain sits well north of everywhere else,
 * then South (below the river corridor), then the core band is split
 * East/West/Downtown by longitude around the 6th & Congress meridian.
 *
 * Coordinates outside AUSTIN_BOUNDS return undefined rather than guessing —
 * this is the documented fallback (not "Downtown").
 */
export function districtForPoint(lat: number, lng: number): District | undefined {
  const [[minLat, minLng], [maxLat, maxLng]] = AUSTIN_BOUNDS;
  const inBounds = lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  if (!inBounds) {
    return undefined;
  }

  if (lat >= 30.32) {
    return "North"; // Domain / Rock Rose — a clear latitude gap from the rest
  }

  if (lat < 30.24) {
    return "South"; // S Lamar / Zilker / deep South Congress, below the river corridor
  }

  if (lng > -97.73) {
    return "East"; // East Cesar Chavez / East 6th, across I-35
  }

  if (lng < -97.75) {
    return "West"; // Clarksville / West End
  }

  return "Downtown"; // 6th / Rainey / SoCo corridor
}
