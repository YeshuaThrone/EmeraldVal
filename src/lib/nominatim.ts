const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

export const NOMINATIM_USER_AGENT =
  "ATXLive/1.0 (Austin Live Music Map; github.com/YeshuaThrone/EmeraldVal)";

const AUSTIN_VIEWBOX = "-97.95,30.52,-97.56,30.10";

const STREET_ALIASES: Record<string, string> = {
  "william cannon": "William Cannon Drive",
  "south congress": "South Congress Avenue",
  congress: "Congress Avenue",
  soco: "South Congress Avenue",
  rainey: "Rainey Street",
  sixth: "East 6th Street",
  "6th": "East 6th Street",
};

type GeoJson = {
  type: string;
  coordinates: unknown;
};

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  name?: string;
  geojson?: GeoJson;
};

type GeocodeHit = {
  lat: number;
  lng: number;
  displayName: string;
};

type Line = [number, number][];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function expandStreetName(input: string): string {
  let value = input.trim().replace(/\./g, "");
  value = value.replace(/\bN\b/gi, "North");
  value = value.replace(/\bS\b/gi, "South");
  value = value.replace(/\bE\b/gi, "East");
  value = value.replace(/\bW\b/gi, "West");
  value = value.replace(/\bBlvd\b/gi, "Boulevard");
  value = value.replace(/\bPkwy\b/gi, "Parkway");
  value = value.replace(/\bHwy\b/gi, "Highway");
  value = value.replace(/\bAve\b/gi, "Avenue");
  value = value.replace(/\bDr\b/gi, "Drive");
  value = value.replace(/\bRd\b/gi, "Road");
  value = value.replace(/\bLn\b/gi, "Lane");
  value = value.replace(/\bCt\b/gi, "Court");
  value = value.replace(/\bSt\b/gi, "Street");
  return value.replace(/\s+/g, " ").trim();
}

function withStreetType(name: string): string {
  const alias = STREET_ALIASES[name.toLowerCase()];
  if (alias) {
    return alias;
  }
  if (
    /\b(Street|Avenue|Drive|Road|Lane|Boulevard|Parkway|Highway|Court|Circle|Place|Trail|Loop)\b/i.test(
      name,
    )
  ) {
    return name;
  }
  return `${name} Street`;
}

function parseIntersection(query: string): [string, string] | null {
  const parts = query
    .split(/\s*(?:&|\/|\bat\b|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 2) {
    return [parts[0], parts[1]];
  }
  return null;
}

function isAustinHit(hit: NominatimHit): boolean {
  return (
    /Austin/i.test(hit.display_name) &&
    /Travis County/i.test(hit.display_name) &&
    !/Austin County/i.test(hit.display_name)
  );
}

function extractLines(geojson: GeoJson | undefined): Line[] {
  if (!geojson) {
    return [];
  }
  const { type, coordinates } = geojson;
  if (type === "LineString" && Array.isArray(coordinates)) {
    return [coordinates as Line];
  }
  if (type === "MultiLineString" && Array.isArray(coordinates)) {
    return coordinates as Line[];
  }
  return [];
}

function metersBetween(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const dy = (lat1 - lat2) * 111_000;
  const dx = (lng1 - lng2) * 111_000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

function segmentIntersection(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): [number, number] | null {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const [x3, y3] = c;
  const [x4, y4] = d;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (den === 0) {
    return null;
  }
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

function closestPointOnSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): [number, number] {
  const [px, py] = point;
  const [ax, ay] = start;
  const [bx, by] = end;
  const abx = bx - ax;
  const aby = by - ay;
  const length = abx * abx + aby * aby;
  if (length === 0) {
    return start;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / length));
  return [ax + t * abx, ay + t * aby];
}

function closestBetweenLines(
  lineA: Line,
  lineB: Line,
): { lng: number; lat: number; meters: number } | null {
  let best: { lng: number; lat: number; meters: number } | null = null;

  for (let i = 0; i < lineA.length - 1; i += 1) {
    for (let j = 0; j < lineB.length - 1; j += 1) {
      const a1 = lineA[i];
      const a2 = lineA[i + 1];
      const b1 = lineB[j];
      const b2 = lineB[j + 1];
      if (!a1 || !a2 || !b1 || !b2) {
        continue;
      }

      const cross = segmentIntersection(a1, a2, b1, b2);
      if (cross) {
        return { lng: cross[0], lat: cross[1], meters: 0 };
      }

      const candidates: [[number, number], [number, number]][] = [
        [a1, closestPointOnSegment(a1, b1, b2)],
        [a2, closestPointOnSegment(a2, b1, b2)],
        [closestPointOnSegment(b1, a1, a2), b1],
        [closestPointOnSegment(b2, a1, a2), b2],
      ];

      for (const [left, right] of candidates) {
        const gap = metersBetween(left[0], left[1], right[0], right[1]);
        if (!best || gap < best.meters) {
          best = {
            lng: (left[0] + right[0]) / 2,
            lat: (left[1] + right[1]) / 2,
            meters: gap,
          };
        }
      }
    }
  }

  return best;
}

async function fetchNominatim(url: URL): Promise<NominatimHit[]> {
  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error("Geocoding service is unavailable.");
  }
  return (await response.json()) as NominatimHit[];
}

async function nominatimSearch(
  query: string,
  options: { limit: number; polygon: boolean; bounded: boolean },
): Promise<NominatimHit[]> {
  const prepared = /austin/i.test(query)
    ? query
    : `${query}, Austin, Travis County, Texas`;

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("q", prepared);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(options.limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", AUSTIN_VIEWBOX);
  url.searchParams.set("bounded", options.bounded ? "1" : "0");
  if (options.polygon) {
    url.searchParams.set("polygon_geojson", "1");
  }

  const hits = await fetchNominatim(url);
  return hits.filter(isAustinHit);
}

function toGeocodeHit(hit: NominatimHit, displayName?: string): GeocodeHit | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    lat,
    lng,
    displayName: displayName ?? hit.display_name,
  };
}

async function geocodeIntersection(
  streetA: string,
  streetB: string,
): Promise<GeocodeHit | null> {
  const nameA = withStreetType(expandStreetName(streetA));
  const nameB = withStreetType(expandStreetName(streetB));

  const hitsA = await nominatimSearch(nameA, {
    limit: 10,
    polygon: true,
    bounded: true,
  });
  await sleep(1100);
  const hitsB = await nominatimSearch(nameB, {
    limit: 10,
    polygon: true,
    bounded: true,
  });

  const highwaysA = hitsA.filter((hit) => hit.class === "highway");
  const highwaysB = hitsB.filter((hit) => hit.class === "highway");
  if (highwaysA.length === 0 || highwaysB.length === 0) {
    return null;
  }

  let best: { lng: number; lat: number; meters: number } | null = null;
  for (const hitA of highwaysA) {
    for (const hitB of highwaysB) {
      for (const lineA of extractLines(hitA.geojson)) {
        for (const lineB of extractLines(hitB.geojson)) {
          const candidate = closestBetweenLines(lineA, lineB);
          if (candidate && (!best || candidate.meters < best.meters)) {
            best = candidate;
          }
        }
      }
    }
  }

  if (!best || best.meters > 400) {
    return null;
  }

  return {
    lat: best.lat,
    lng: best.lng,
    displayName: `${nameA} & ${nameB}, Austin, Texas`,
  };
}

export async function geocodeAustinQuery(query: string): Promise<GeocodeHit | null> {
  const cleaned = query.trim().replace(/\s+/g, " ");
  const intersection = parseIntersection(cleaned);

  if (intersection) {
    const hit = await geocodeIntersection(intersection[0], intersection[1]);
    if (hit) {
      return hit;
    }
    await sleep(1100);
  }

  const expanded = expandStreetName(cleaned);
  const looksLikeAddress = /^\d/.test(expanded);
  const searchQuery =
    intersection || looksLikeAddress ? expanded : withStreetType(expanded);
  let hits = await nominatimSearch(searchQuery, {
    limit: 1,
    polygon: false,
    bounded: true,
  });
  if (hits.length === 0) {
    hits = await nominatimSearch(searchQuery, {
      limit: 1,
      polygon: false,
      bounded: false,
    });
  }

  const first = hits[0];
  if (!first) {
    return null;
  }

  const result = toGeocodeHit(first);
  if (result && intersection) {
    const nameA = withStreetType(expandStreetName(intersection[0]));
    const nameB = withStreetType(expandStreetName(intersection[1]));
    result.displayName = `${nameA} & ${nameB}, Austin, Texas`;
  }
  return result;
}
