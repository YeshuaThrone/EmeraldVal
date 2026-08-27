import { districtForPoint } from "@/lib/district";
import { GENRES, type Pin, type PinSource } from "@/lib/types";

/**
 * Deterministic PRNG (mulberry32). Fixed-seed, so `generateCityPins()`
 * produces byte-identical output on every call — no `Math.random`, no
 * clock, no per-load drift. This is what makes the "municipal dataset"
 * reproducible across dev/prod/tests (see the blueprint's load-bearing
 * assumption: it's a representative mock seed, not a real import).
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

const SEED = 0x415458; // "ATX" in hex-ish — arbitrary but fixed

/** Fisher-Yates shuffle driven by the seeded rng; preserves the input multiset. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Lowercase, alphanumeric-only handle derived from a venue/performer name. */
function toHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The three original demo pins (East 6th, Rainey, SoCo) — kept verbatim
 * among the seeds per the blueprint, all inside the Downtown corridor.
 */
const ORIGINAL_PINS: Pin[] = [
  {
    id: "seed-sixth",
    lat: 30.2674,
    lng: -97.7398,
    performerName: "The Blackhearts",
    locationName: "East 6th Street",
    genre: "Blues/Rock",
    tipAmount: "",
    cashApp: "blackheartsatx",
    venmo: "blackhearts",
    source: "live",
    district: districtForPoint(30.2674, -97.7398),
    isLocal: true,
  },
  {
    id: "seed-rainey",
    lat: 30.2578,
    lng: -97.7392,
    performerName: "Rainey Street Brass",
    locationName: "Rainey Street District",
    genre: "Brass",
    tipAmount: "",
    cashApp: "raineybrass",
    venmo: "raineybrass",
    source: "live",
    district: districtForPoint(30.2578, -97.7392),
    isLocal: true,
  },
  {
    id: "seed-soco",
    lat: 30.2504,
    lng: -97.749,
    performerName: "SoCo Strings",
    locationName: "South Congress Avenue",
    genre: "Acoustic",
    tipAmount: "",
    cashApp: "socostrings",
    venmo: "socostrings",
    source: "live",
    district: districtForPoint(30.2504, -97.749),
    isLocal: true,
  },
];

interface VenueTemplate {
  performerName: string;
  locationName: string;
  lat: number;
  lng: number;
}

/**
 * 33 additional venues (36 total with the three originals above), placed so
 * each falls unambiguously inside its intended district under
 * `districtForPoint` — see src/lib/district.ts for the boundary logic.
 */
const GENERATED_VENUES: VenueTemplate[] = [
  // Downtown (7) — 6th/Rainey/SoCo corridor
  { performerName: "Congress Ave Collective", locationName: "6th & Congress Corner", lat: 30.2669, lng: -97.7428 },
  { performerName: "Warehouse Six", locationName: "Warehouse District Plaza", lat: 30.2648, lng: -97.7452 },
  { performerName: "Red River Ramblers", locationName: "Red River Cultural District", lat: 30.2661, lng: -97.7378 },
  { performerName: "Fourth Street Fanfare", locationName: "Convention Center Plaza", lat: 30.2618, lng: -97.7405 },
  { performerName: "Republic Squares", locationName: "Republic Square Park", lat: 30.2676, lng: -97.7477 },
  { performerName: "Seaholm Sound", locationName: "Seaholm Power Plant District", lat: 30.2683, lng: -97.7495 },
  { performerName: "Brazos Street Horns", locationName: "Brazos Street Corridor", lat: 30.2692, lng: -97.7415 },
  // North (6) — Domain / Rock Rose
  { performerName: "Domain Nightlights", locationName: "Domain Northside Plaza", lat: 30.4005, lng: -97.7215 },
  { performerName: "Rock Rose Rhythm", locationName: "Rock Rose Avenue Stage", lat: 30.4021, lng: -97.7241 },
  { performerName: "Kramer Station Sound", locationName: "Kramer Station Yard", lat: 30.3985, lng: -97.7198 },
  { performerName: "Q2 Stadium Faithful", locationName: "Q2 Stadium Plaza", lat: 30.3897, lng: -97.7195 },
  { performerName: "Northside Green Notes", locationName: "Domain Northside Green", lat: 30.4033, lng: -97.7223 },
  { performerName: "Braker Lane Blend", locationName: "Braker Lane Backlot", lat: 30.3801, lng: -97.7011 },
  // South (7) — S Lamar / Zilker / SoFi
  { performerName: "South Lamar Sirens", locationName: "South Lamar Boulevard Stage", lat: 30.2385, lng: -97.7695 },
  { performerName: "Zilker Oak Trio", locationName: "Zilker Live Oak Stage", lat: 30.2298, lng: -97.7729 },
  { performerName: "SoFi Soul Session", locationName: "SoFi District Corner", lat: 30.2356, lng: -97.7605 },
  { performerName: "Bouldin Porch Pickers", locationName: "Bouldin Creek Porch Sessions", lat: 30.2371, lng: -97.7658 },
  { performerName: "Deep Eddy Divers", locationName: "Deep Eddy Poolside", lat: 30.2312, lng: -97.7754 },
  { performerName: "Manchaca Honky Tones", locationName: "Manchaca Road Honky-Tonk", lat: 30.2201, lng: -97.7889 },
  { performerName: "Hilltop Harmony", locationName: "St. Edward's Hilltop", lat: 30.2189, lng: -97.7601 },
  // East (7) — East Cesar Chavez / East 6th
  { performerName: "Pedernales Porch Band", locationName: "East 6th & Pedernales Stage", lat: 30.2624, lng: -97.7188 },
  { performerName: "Cesar Chavez Collective", locationName: "East Cesar Chavez Loft", lat: 30.2578, lng: -97.7205 },
  { performerName: "Holly Street Horns", locationName: "Holly Street Power Plant Green", lat: 30.2551, lng: -97.7239 },
  { performerName: "Springdale Session Players", locationName: "Springdale General Yard", lat: 30.2701, lng: -97.7089 },
  { performerName: "Mueller Lake Sound", locationName: "Mueller Lake Park Pavilion", lat: 30.2953, lng: -97.7059 },
  { performerName: "Govalle Backyard Band", locationName: "Govalle Backyard Stage", lat: 30.2569, lng: -97.7098 },
  { performerName: "Twelfth Street Soul", locationName: "East 12th Street Soul Room", lat: 30.2732, lng: -97.7211 },
  // West (6) — Clarksville / West End
  { performerName: "Clarksville Porch Choir", locationName: "Clarksville Porch Fest", lat: 30.2825, lng: -97.7595 },
  { performerName: "West End Wine Strings", locationName: "West End Wine Bar Patio", lat: 30.2871, lng: -97.7622 },
  { performerName: "Tarrytown Twilight", locationName: "Tarrytown Overlook", lat: 30.2967, lng: -97.7701 },
  { performerName: "Old West Green Notes", locationName: "Old West Austin Green", lat: 30.2889, lng: -97.7655 },
  { performerName: "Bryker Woods Brass", locationName: "Bryker Woods Backlot", lat: 30.3011, lng: -97.7598 },
  { performerName: "Pease Park Pickers", locationName: "Pease Park Amphitheater", lat: 30.2812, lng: -97.7568 },
];

/**
 * Generates the city-wide seed. Every call creates a fresh, fixed-seed PRNG,
 * so the sequence of shuffles below is identical every time — the returned
 * array is deep-equal across calls (see seedData.test.ts).
 *
 * Mix targets across the 33 generated venues (plus the 3 always-live
 * originals, all local): 11 live / 11 search / 22... — concretely 11 live,
 * 11 search, 11 map (33 total, ~1/3 each), giving 14/36 (~39%) live overall
 * to match the brief's ~40/60 live/dropped split; 22/33 local (66.7%),
 * giving 25/36 (~69%) local overall to match ~70%.
 */
export function generateCityPins(): Pin[] {
  const rng = mulberry32(SEED);

  const genreSequence = shuffle(
    GENERATED_VENUES.map((_, i) => GENRES[i % GENRES.length]),
    rng,
  );
  const sourceSequence = shuffle(
    GENERATED_VENUES.map((_, i): PinSource => {
      if (i < 11) return "live";
      if (i < 22) return "search";
      return "map";
    }),
    rng,
  );
  const localSequence = shuffle(
    GENERATED_VENUES.map((_, i) => i < 22),
    rng,
  );

  const generatedPins: Pin[] = GENERATED_VENUES.map((venue, i) => {
    const handle = toHandle(venue.performerName);
    return {
      id: `seed-${toHandle(venue.locationName)}-${i}`,
      lat: venue.lat,
      lng: venue.lng,
      performerName: venue.performerName,
      locationName: venue.locationName,
      genre: genreSequence[i],
      tipAmount: "",
      cashApp: handle,
      venmo: handle,
      source: sourceSequence[i],
      district: districtForPoint(venue.lat, venue.lng),
      isLocal: localSequence[i],
    };
  });

  return [...ORIGINAL_PINS, ...generatedPins];
}

/** The city-wide seed, computed once at module load. */
export const CITY_PINS: Pin[] = generateCityPins();
