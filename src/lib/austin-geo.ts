export type CulturalCorridor =
  | "red-river"
  | "rainey"
  | "east-6th"
  | "south-congress"
  | "downtown-warehouse";

export type LatLng = {
  lat: number;
  lng: number;
};

export type LocationKind = "district" | "zip-zone" | "outside";

export type LocationIndex = {
  inAustin: boolean;
  kind: LocationKind;
  corridor: CulturalCorridor | null;
  zipCode: string | null;
  neighborhood: string | null;
  zoneTag: string;
  lat: number;
  lng: number;
};

type Bounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

type ZipZone = Bounds & {
  zipCode: string;
  neighborhood: string;
  slug: string;
};

/** Greater Austin / Travis County working box: Slaughter through Cedar Park. */
export const AUSTIN_MUNICIPAL_BOUNDS: Bounds = {
  south: 30.098,
  north: 30.565,
  west: -98.02,
  east: -97.48,
};

export const CORRIDOR_BOUNDS: Record<CulturalCorridor, Bounds> = {
  "red-river": { south: 30.2648, north: 30.2712, west: -97.7396, east: -97.7346 },
  rainey: { south: 30.2548, north: 30.2616, west: -97.7418, east: -97.7364 },
  "east-6th": { south: 30.2654, north: 30.2694, west: -97.7428, east: -97.7268 },
  "south-congress": { south: 30.2448, north: 30.2588, west: -97.7526, east: -97.7452 },
  "downtown-warehouse": {
    south: 30.2638,
    north: 30.2718,
    west: -97.7518,
    east: -97.7416,
  },
};

export const DISTRICT_ZONE_TAGS: Record<CulturalCorridor, string> = {
  "red-river": "District_Red_River",
  rainey: "District_Rainey",
  "east-6th": "District_East_6th",
  "south-congress": "District_SoCo",
  "downtown-warehouse": "District_Downtown_Warehouse",
};

export const DISTRICT_LABELS: Record<CulturalCorridor, string> = {
  "red-river": "Red River Cultural District",
  rainey: "Rainey Street Historic District",
  "east-6th": "East 6th Street Corridor",
  "south-congress": "South Congress (SoCo)",
  "downtown-warehouse": "Downtown / Warehouse District",
};

const ZIP_ZONES: ZipZone[] = [
  { zipCode: "78749", neighborhood: "Slaughter", slug: "Slaughter", south: 30.168, north: 30.214, west: -97.882, east: -97.812 },
  { zipCode: "78748", neighborhood: "Slaughter", slug: "Slaughter", south: 30.148, north: 30.198, west: -97.84, east: -97.77 },
  { zipCode: "78739", neighborhood: "Circle C", slug: "Circle_C", south: 30.148, north: 30.198, west: -97.93, east: -97.86 },
  { zipCode: "78745", neighborhood: "Menchaca", slug: "Menchaca", south: 30.198, north: 30.236, west: -97.82, east: -97.76 },
  { zipCode: "78735", neighborhood: "Oak Hill", slug: "Oak_Hill", south: 30.228, north: 30.272, west: -97.92, east: -97.84 },
  { zipCode: "78736", neighborhood: "Oak Hill West", slug: "Oak_Hill", south: 30.21, north: 30.268, west: -98.0, east: -97.91 },
  { zipCode: "78704", neighborhood: "South Austin", slug: "South_Austin", south: 30.228, north: 30.256, west: -97.78, east: -97.74 },
  { zipCode: "78741", neighborhood: "Riverside", slug: "Riverside", south: 30.22, north: 30.25, west: -97.74, east: -97.69 },
  { zipCode: "78702", neighborhood: "East Austin", slug: "East_Austin", south: 30.25, north: 30.275, west: -97.73, east: -97.69 },
  { zipCode: "78721", neighborhood: "East Austin", slug: "East_Austin", south: 30.26, north: 30.29, west: -97.69, east: -97.65 },
  { zipCode: "78723", neighborhood: "Mueller", slug: "Mueller", south: 30.29, north: 30.322, west: -97.72, east: -97.68 },
  { zipCode: "78751", neighborhood: "Hyde Park", slug: "Hyde_Park", south: 30.3, north: 30.322, west: -97.74, east: -97.72 },
  { zipCode: "78756", neighborhood: "Brentwood", slug: "Brentwood", south: 30.31, north: 30.335, west: -97.75, east: -97.725 },
  { zipCode: "78757", neighborhood: "Allandale", slug: "Allandale", south: 30.335, north: 30.365, west: -97.75, east: -97.72 },
  { zipCode: "78758", neighborhood: "North Lamar", slug: "North_Lamar", south: 30.365, north: 30.42, west: -97.73, east: -97.68 },
  { zipCode: "78753", neighborhood: "Windsor Hills", slug: "North_Lamar", south: 30.365, north: 30.42, west: -97.68, east: -97.64 },
  { zipCode: "78759", neighborhood: "Great Hills", slug: "Northwest", south: 30.39, north: 30.44, west: -97.78, east: -97.73 },
  { zipCode: "78727", neighborhood: "Scofield", slug: "North", south: 30.42, north: 30.46, west: -97.73, east: -97.68 },
  { zipCode: "78750", neighborhood: "Anderson Mill", slug: "Northwest", south: 30.43, north: 30.48, west: -97.82, east: -97.76 },
  { zipCode: "78729", neighborhood: "Pond Springs", slug: "North", south: 30.45, north: 30.5, west: -97.78, east: -97.73 },
  { zipCode: "78613", neighborhood: "Cedar Park", slug: "Cedar_Park", south: 30.48, north: 30.545, west: -97.86, east: -97.76 },
  { zipCode: "78744", neighborhood: "Southeast", slug: "Southeast", south: 30.17, north: 30.22, west: -97.77, east: -97.7 },
  { zipCode: "78747", neighborhood: "Onion Creek", slug: "Southeast", south: 30.12, north: 30.17, west: -97.8, east: -97.72 },
  { zipCode: "78719", neighborhood: "Airport", slug: "Airport", south: 30.18, north: 30.22, west: -97.7, east: -97.64 },
  { zipCode: "78746", neighborhood: "West Lake", slug: "West_Lake", south: 30.26, north: 30.31, west: -97.82, east: -97.77 },
  { zipCode: "78731", neighborhood: "Northwest Hills", slug: "Northwest_Hills", south: 30.34, north: 30.38, west: -97.78, east: -97.74 },
  { zipCode: "78703", neighborhood: "Clarksville", slug: "Clarksville", south: 30.27, north: 30.3, west: -97.77, east: -97.75 },
  { zipCode: "78705", neighborhood: "UT Campus", slug: "Campus", south: 30.28, north: 30.3, west: -97.75, east: -97.73 },
  { zipCode: "78701", neighborhood: "Downtown", slug: "Downtown", south: 30.262, north: 30.275, west: -97.75, east: -97.738 },
  { zipCode: "78752", neighborhood: "North Loop", slug: "North_Loop", south: 30.325, north: 30.355, west: -97.72, east: -97.69 },
  { zipCode: "78754", neighborhood: "Windsor Park East", slug: "Northeast", south: 30.34, north: 30.39, west: -97.66, east: -97.62 },
  { zipCode: "78724", neighborhood: "Colony Park", slug: "East", south: 30.28, north: 30.33, west: -97.64, east: -97.58 },
  { zipCode: "78725", neighborhood: "Hornssby Bend", slug: "East", south: 30.22, north: 30.28, west: -97.64, east: -97.56 },
  { zipCode: "78742", neighborhood: "Montopolis", slug: "Southeast", south: 30.23, north: 30.26, west: -97.7, east: -97.66 },
  { zipCode: "78717", neighborhood: "Avery Ranch", slug: "North", south: 30.48, north: 30.53, west: -97.78, east: -97.73 },
  { zipCode: "78617", neighborhood: "Del Valle", slug: "Southeast", south: 30.14, north: 30.2, west: -97.68, east: -97.56 },
  { zipCode: "78652", neighborhood: "Manchaca", slug: "Manchaca", south: 30.1, north: 30.15, west: -97.86, east: -97.8 },
  { zipCode: "78660", neighborhood: "Pflugerville", slug: "Pflugerville", south: 30.42, north: 30.5, west: -97.66, east: -97.58 },
];

function contains(bounds: Bounds, point: LatLng): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  );
}

export function isWithinMunicipalBounds(point: LatLng): boolean {
  return contains(AUSTIN_MUNICIPAL_BOUNDS, point);
}

export function corridorAt(point: LatLng): CulturalCorridor | null {
  const matches: CulturalCorridor[] = [];
  for (const [id, box] of Object.entries(CORRIDOR_BOUNDS) as [CulturalCorridor, Bounds][]) {
    if (contains(box, point)) {
      matches.push(id);
    }
  }
  if (matches.includes("red-river")) {
    return "red-river";
  }
  if (matches.includes("east-6th")) {
    return "east-6th";
  }
  return matches[0] ?? null;
}

function zipZoneAt(point: LatLng): ZipZone | null {
  let best: ZipZone | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const zone of ZIP_ZONES) {
    if (!contains(zone, point)) {
      continue;
    }
    const area = (zone.north - zone.south) * (zone.east - zone.west);
    if (area < bestArea) {
      best = zone;
      bestArea = area;
    }
  }
  return best;
}

export function citywideZoneTag(index: LocationIndex): string {
  return index.zoneTag;
}

export function indexLocation(point: LatLng): LocationIndex {
  const corridor = corridorAt(point);
  if (corridor) {
    return {
      inAustin: true,
      kind: "district",
      corridor,
      zipCode: "78701",
      neighborhood: DISTRICT_LABELS[corridor],
      zoneTag: DISTRICT_ZONE_TAGS[corridor],
      lat: point.lat,
      lng: point.lng,
    };
  }

  const inAustin = isWithinMunicipalBounds(point);
  const zip = zipZoneAt(point);
  if (zip) {
    return {
      inAustin: true,
      kind: "zip-zone",
      corridor: null,
      zipCode: zip.zipCode,
      neighborhood: zip.neighborhood,
      zoneTag: `Austin_${zip.zipCode}_${zip.slug}`,
      lat: point.lat,
      lng: point.lng,
    };
  }

  if (inAustin) {
    return {
      inAustin: true,
      kind: "zip-zone",
      corridor: null,
      zipCode: null,
      neighborhood: "Greater Austin",
      zoneTag: "Austin_Citywide_Popup",
      lat: point.lat,
      lng: point.lng,
    };
  }

  return {
    inAustin: false,
    kind: "outside",
    corridor: null,
    zipCode: null,
    neighborhood: null,
    zoneTag: "Outside_Austin",
    lat: point.lat,
    lng: point.lng,
  };
}

export function labelForZoneTag(zoneTag: string): string {
  if (zoneTag.startsWith("District_")) {
    const corridor = (Object.entries(DISTRICT_ZONE_TAGS).find(([, tag]) => tag === zoneTag)?.[0] ??
      null) as CulturalCorridor | null;
    return corridor ? DISTRICT_LABELS[corridor] : zoneTag.replaceAll("_", " ");
  }
  const match = /^Austin_(\d{5})_(.+)$/.exec(zoneTag);
  if (match) {
    return `${match[2].replaceAll("_", " ")} (${match[1]})`;
  }
  return zoneTag.replaceAll("_", " ");
}
