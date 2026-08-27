import { AUSTIN_BOUNDS } from "@/lib/constants";
import { CITY_PINS } from "@/lib/seedData";
import type { Pin } from "@/lib/types";

/**
 * Deterministic PRNG (mulberry32) — same algorithm as seedData.ts, kept as
 * its own local copy since seedData doesn't export it. Fixed-seed, so
 * `generateHeatPoints()` produces byte-identical output on every call: no
 * `Math.random`, no clock, no per-load drift.
 */
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

const HEAT_SEED = 0x484541; // "HEA" hex-ish — arbitrary but fixed, mirrors seedData's SEED

export type CorridorName =
  | "6th Street"
  | "Red River Cultural District"
  | "Rainey Street"
  | "South Congress"
  | "East 12th Street";

export interface Corridor {
  name: CorridorName;
  /** Relative foot-traffic weight (0-1] driving both point density and heat intensity. */
  weight: number;
  /** Polyline tracing the corridor's real street path, downtown-Austin coordinates. */
  path: Array<[number, number]>;
}

/** Name + weight only, for the legend and for tests that don't need the geometry. */
export interface CorridorMeta {
  name: CorridorName;
  weight: number;
}

export interface HeatPoint {
  lat: number;
  lng: number;
  /** Heat weight in (0, 1], fed to leaflet.heat as the point's third value. */
  intensity: number;
  /** Set for corridor-seeded points; omitted for points blended in from live pins. */
  corridor?: CorridorName;
}

/**
 * The five Austin cultural corridors named in the brief, traced as
 * approximate street polylines (a handful of shaping points each — this is
 * a stylized mock dataset, not a GIS import, consistent with seedData.ts's
 * synthetic-but-plausible approach). Weights set relative foot-traffic
 * intensity: 6th Street and South Congress run hottest, East 12th coolest.
 */
export const CORRIDORS: Corridor[] = [
  {
    name: "6th Street",
    weight: 1.0,
    path: [
      [30.2669, -97.755],
      [30.267, -97.75],
      [30.2671, -97.745],
      [30.2672, -97.74],
      [30.2673, -97.735],
    ],
  },
  {
    name: "Red River Cultural District",
    weight: 0.8,
    path: [
      [30.262, -97.738],
      [30.2645, -97.7378],
      [30.2661, -97.7376],
      [30.2685, -97.7373],
      [30.271, -97.737],
    ],
  },
  {
    name: "Rainey Street",
    weight: 0.75,
    path: [
      [30.255, -97.7398],
      [30.2565, -97.7396],
      [30.2578, -97.7392],
      [30.2592, -97.7388],
      [30.2605, -97.7385],
    ],
  },
  {
    name: "South Congress",
    weight: 0.85,
    path: [
      [30.26, -97.75],
      [30.255, -97.7497],
      [30.2504, -97.749],
      [30.245, -97.748],
      [30.24, -97.747],
      [30.235, -97.746],
    ],
  },
  {
    name: "East 12th Street",
    weight: 0.65,
    path: [
      [30.273, -97.73],
      [30.2731, -97.725],
      [30.2732, -97.7211],
      [30.2733, -97.715],
      [30.2734, -97.709],
    ],
  },
];

export const CORRIDOR_META: CorridorMeta[] = CORRIDORS.map(({ name, weight }) => ({
  name,
  weight,
}));

const MIN_CORRIDOR_POINTS = 10;
const POINTS_PER_WEIGHT = 10;

/**
 * Higher-weight corridors get denser point clouds (bigger, hotter clusters).
 * Exported so tests can independently recompute the expected total point
 * count instead of hardcoding it.
 */
export function corridorPointCount(weight: number): number {
  return Math.round(MIN_CORRIDOR_POINTS + weight * POINTS_PER_WEIGHT);
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Linear position at fraction `t` (0..1) along a multi-segment polyline. */
function pointAlongPath(path: Array<[number, number]>, t: number): [number, number] {
  if (path.length === 1) {
    return path[0];
  }

  const segmentLengths = path.slice(0, -1).map((point, i) => distance(point, path[i + 1]));
  const total = segmentLengths.reduce((sum, len) => sum + len, 0);
  let remaining = t * total;

  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    const isLastSegment = i === segmentLengths.length - 1;
    if (remaining <= len || isLastSegment) {
      const ratio = len === 0 ? 0 : Math.min(1, remaining / len);
      const [lat1, lng1] = path[i];
      const [lat2, lng2] = path[i + 1];
      return [lat1 + (lat2 - lat1) * ratio, lng1 + (lng2 - lng1) * ratio];
    }
    remaining -= len;
  }

  return path[path.length - 1];
}

const JITTER_DEGREES = 0.0018;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Safety net around jitter: guarantees every emitted point stays inside AUSTIN_BOUNDS. */
function clampToBounds(lat: number, lng: number): [number, number] {
  const [[minLat, minLng], [maxLat, maxLng]] = AUSTIN_BOUNDS;
  return [clamp(lat, minLat, maxLat), clamp(lng, minLng, maxLng)];
}

function corridorHeatPoints(corridor: Corridor, rng: () => number): HeatPoint[] {
  const count = corridorPointCount(corridor.weight);
  const points: HeatPoint[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const [lat, lng] = pointAlongPath(corridor.path, t);
    const jitteredLat = lat + (rng() - 0.5) * JITTER_DEGREES;
    const jitteredLng = lng + (rng() - 0.5) * JITTER_DEGREES;
    const [boundedLat, boundedLng] = clampToBounds(jitteredLat, jitteredLng);
    const intensity = Math.min(1, corridor.weight * (0.55 + rng() * 0.45));

    points.push({
      lat: boundedLat,
      lng: boundedLng,
      intensity: Number(intensity.toFixed(3)),
      corridor: corridor.name,
    });
  }

  return points;
}

/** Live pins burn hottest — they're happening right now, not just a corridor baseline. */
function livePinHeatPoints(pins: Pin[], rng: () => number): HeatPoint[] {
  return pins
    .filter((pin) => pin.source === "live")
    .map((pin) => {
      const [lat, lng] = clampToBounds(pin.lat, pin.lng);
      return {
        lat,
        lng,
        intensity: Number(Math.min(1, 0.75 + rng() * 0.25).toFixed(3)),
      };
    });
}

/**
 * Pure heat-point generator: seeds jittered points along each of the five
 * corridors (density and intensity scaled by corridor weight) and blends in
 * one hot point per currently-live pin. Deterministic for a given `pins`
 * argument — call it with the currently *visible* (post-filter) pins so the
 * live-pin contribution reflects whatever the fan map is showing; the
 * corridor baseline itself is unaffected by filters, since the corridors
 * are fixed geography, not filtered venues.
 */
export function generateHeatPoints(pins: Pin[] = CITY_PINS): HeatPoint[] {
  const rng = mulberry32(HEAT_SEED);
  const corridorPoints = CORRIDORS.flatMap((corridor) => corridorHeatPoints(corridor, rng));
  const livePoints = livePinHeatPoints(pins, rng);
  return [...corridorPoints, ...livePoints];
}
