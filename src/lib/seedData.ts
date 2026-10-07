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
 * MOVE 3 — Real Austin scale. The curated set below appends 93 real Austin
 * live-music venues to the fixed-seed dataset, every entry in the same
 * `VenueTemplate` shape as the legacy generated rooms. The venue-count
 * contract is self-contained: the fixed SEED ("ATX"), the genre / source /
 * isLocal scheduling via `shuffle`, and `districtForPoint` classification
 * are all untouched — the same thresholds now sequence a longer list, so
 * filter counts, heat-pin blends, and admin analytics absorb the larger
 * set automatically.
 *
 * Sourcing: names and addresses cross-checked against published Austin
 * venue guides; the 13 flagship venues named in the brief (Mohawk,
 * Continental Club, Stubb's, ACL Live at the Moody Theater, Antone's,
 * Saxon Pub, Broken Spoke, Empire Garage, C-Boy's, Beerland, Honey, Kick
 * Butt Coffee, Garage) were coordinate-verified via live web retrieval on
 * 2026-10-07. Coordinates are real lat/lng — and they feed this app's
 * deliberate COARSE five-district classifier. Two honest consequences of
 * that classifier, not bugs: Saxon Pub (1320 S Lamar) classifies West
 * because the West band boundary sits at -97.75, and Radio Coffee &
 * Beer classifies South (lat < 30.24). No district logic was touched to
 * flatter the labels.
 */
export const REAL_AUSTIN_VENUES: VenueTemplate[] = [
  // — Red River Cultural District + East/West 6th + Congress (26) —
  { performerName: "Mohawk", locationName: "912 Red River St", lat: 30.26879, lng: -97.73634 },
  { performerName: "Stubb's Bar-B-Q", locationName: "801 Red River St", lat: 30.26804, lng: -97.73642 },
  { performerName: "Cheer Up Charlies", locationName: "900 Red River St", lat: 30.2682, lng: -97.7375 },
  { performerName: "Honey", locationName: "506 E 6th St", lat: 30.26702, lng: -97.73912 },
  { performerName: "Beerland", locationName: "711 Red River St", lat: 30.2659, lng: -97.7368 },
  { performerName: "Garage", locationName: "504 Brushy St", lat: 30.2664, lng: -97.735 },
  { performerName: "Parish", locationName: "501 Brushy St", lat: 30.2675, lng: -97.7342 },
  { performerName: "Elysium", locationName: "705 Red River St", lat: 30.2649, lng: -97.7365 },
  { performerName: "Barracuda", locationName: "611 Red River St", lat: 30.2662, lng: -97.7355 },
  { performerName: "Empire Garage & Control Room", locationName: "606 E 7th St", lat: 30.2672, lng: -97.736 },
  { performerName: "Antone's Nightclub", locationName: "305 E 5th St", lat: 30.26624, lng: -97.74132 },
  { performerName: "ACL Live at the Moody Theater", locationName: "310 W Willie Nelson Blvd", lat: 30.26529, lng: -97.74919 },
  { performerName: "3TEN at ACL Live", locationName: "310 W Willie Nelson Blvd", lat: 30.264, lng: -97.7498 },
  { performerName: "Flamingo Cantina", locationName: "515 E 6th St", lat: 30.2668, lng: -97.7378 },
  { performerName: "B.D. Riley's", locationName: "204 E 6th St", lat: 30.2672, lng: -97.74 },
  { performerName: "Friends Bar", locationName: "213 E 6th St", lat: 30.2673, lng: -97.741 },
  { performerName: "Buffalo Billiards", locationName: "201 E 6th St", lat: 30.2673, lng: -97.7422 },
  { performerName: "Maggie Mae's", locationName: "323 E 6th St", lat: 30.267, lng: -97.739 },
  { performerName: "Thirsty Nickel", locationName: "418 E 6th St", lat: 30.2662, lng: -97.7399 },
  { performerName: "Firehouse Lounge", locationName: "505 E 5th St", lat: 30.2652, lng: -97.7403 },
  { performerName: "Elephant Room", locationName: "315 Congress Ave", lat: 30.2647, lng: -97.7435 },
  { performerName: "Speakeasy", locationName: "412 Congress Ave", lat: 30.2657, lng: -97.743 },
  { performerName: "The Belmont", locationName: "305 W 6th St", lat: 30.267, lng: -97.7449 },
  { performerName: "Cedar Street Courtyard", locationName: "208 W 4th St", lat: 30.2658, lng: -97.7446 },
  { performerName: "Parker Jazz Club", locationName: "117 W 4th St", lat: 30.2652, lng: -97.7425 },
  { performerName: "The White Tiger", locationName: "705 E 6th St", lat: 30.2665, lng: -97.7335 },
  // — Rainey Street (5) —
  { performerName: "Blackheart", locationName: "86 Rainey St", lat: 30.2569, lng: -97.7385 },
  { performerName: "Icenhauer's", locationName: "83 Rainey St", lat: 30.2572, lng: -97.7405 },
  { performerName: "Lucille", locationName: "77 Rainey St", lat: 30.2582, lng: -97.7392 },
  { performerName: "Bar 96", locationName: "96 Rainey St", lat: 30.2558, lng: -97.7388 },
  { performerName: "Lustre Pearl", locationName: "97 Rainey St", lat: 30.2576, lng: -97.7378 },
  // — Congress / Colorado downtown (5) —
  { performerName: "Paramount Theatre", locationName: "713 Congress Ave", lat: 30.2686, lng: -97.7427 },
  { performerName: "Stateside at the Paramount", locationName: "719 Congress Ave", lat: 30.2685, lng: -97.7415 },
  { performerName: "Statesman Skylight Lounge", locationName: "305 S Congress Ave", lat: 30.262, lng: -97.744 },
  { performerName: "Hangar Lounge", locationName: "318 Colorado St", lat: 30.2648, lng: -97.745 },
  { performerName: "Ego's", locationName: "500 S Congress Ave", lat: 30.261, lng: -97.7437 },
  // — South Congress (3) —
  { performerName: "Continental Club", locationName: "1315 S Congress Ave", lat: 30.24893, lng: -97.74956 },
  { performerName: "C-Boy's Heart & Soul", locationName: "2008 S Congress Ave", lat: 30.2447, lng: -97.749 },
  { performerName: "Hotel San José", locationName: "1316 S Congress Ave", lat: 30.249, lng: -97.7485 },
  // — South Lamar / far South / Menchaca (15) —
  // (Saxon Pub classifies West under the coarse lng boundary — documented above.)
  { performerName: "Saxon Pub", locationName: "1320 S Lamar Blvd", lat: 30.25055, lng: -97.76761 },
  { performerName: "Broken Spoke", locationName: "3201 S Lamar Blvd", lat: 30.23577, lng: -97.78915 },
  { performerName: "Radio Coffee & Beer", locationName: "4204 Menchaca Rd", lat: 30.2258, lng: -97.798 },
  { performerName: "The 04 Center", locationName: "2701 S Lamar Blvd", lat: 30.2335, lng: -97.788 },
  { performerName: "The ABGB", locationName: "1305 W Oltorf St", lat: 30.2292, lng: -97.77 },
  { performerName: "Sam's Town Point", locationName: "2115 Allred Dr", lat: 30.2185, lng: -97.7435 },
  { performerName: "The Far Out Lounge & Stage", locationName: "8504 S Congress Ave", lat: 30.1695, lng: -97.763 },
  { performerName: "Sagebrush", locationName: "5500 S Congress Ave", lat: 30.194, lng: -97.7495 },
  { performerName: "Moontower Saloon", locationName: "10212 Manchaca Rd", lat: 30.1815, lng: -97.7995 },
  { performerName: "Armadillo Den", locationName: "10106 Menchaca Rd", lat: 30.1803, lng: -97.8002 },
  { performerName: "Indian Roller", locationName: "10006 Manchaca Rd", lat: 30.179, lng: -97.8 },
  { performerName: "The Hive", locationName: "10542 Manchaca Rd", lat: 30.1745, lng: -97.801 },
  { performerName: "Giddy Ups", locationName: "12010 Manchaca Rd", lat: 30.166, lng: -97.806 },
  { performerName: "Austin360 Amphitheater at COTA", locationName: "12001 Circuit of the Americas Blvd", lat: 30.1342, lng: -97.6397 },
  { performerName: "Emo's Austin", locationName: "2015 E Riverside Dr", lat: 30.2525, lng: -97.7425 },
  // — East 6th + Comal corridor (13) —
  { performerName: "The White Horse", locationName: "500 Comal St", lat: 30.2607, lng: -97.7243 },
  { performerName: "Hotel Vegas", locationName: "1500 E 6th St", lat: 30.2629, lng: -97.7245 },
  { performerName: "Volstead Lounge", locationName: "1500 E 6th St", lat: 30.2627, lng: -97.7235 },
  { performerName: "Nickel City", locationName: "1507 E 6th St", lat: 30.2617, lng: -97.7238 },
  { performerName: "The Liberty", locationName: "1618 E 6th St", lat: 30.2625, lng: -97.7223 },
  { performerName: "The Grackle", locationName: "1700 E 6th St", lat: 30.2626, lng: -97.721 },
  { performerName: "Eastside Lounge", locationName: "1174 E 6th St", lat: 30.263, lng: -97.7295 },
  { performerName: "East Austin Hotel", locationName: "1108 E 6th St", lat: 30.2631, lng: -97.7315 },
  { performerName: "Shangri-La", locationName: "1016 E 6th St", lat: 30.2634, lng: -97.7305 },
  { performerName: "Latchkey", locationName: "1308 E 6th St", lat: 30.2628, lng: -97.7282 },
  { performerName: "Yellow Jacket Social Club", locationName: "1704 E 4th St", lat: 30.2603, lng: -97.7165 },
  { performerName: "Scoot Inn", locationName: "1308 E 4th St", lat: 30.2604, lng: -97.726 },
  { performerName: "Native Hostel", locationName: "807 E 4th St", lat: 30.2614, lng: -97.7288 },
  // — East 11th + far-East (9) —
  { performerName: "Kenny Dorham's Backyard", locationName: "1106 E 11th St", lat: 30.2756, lng: -97.7272 },
  { performerName: "Victory Grill", locationName: "1104 E 11th St", lat: 30.2746, lng: -97.7282 },
  { performerName: "Sahara Lounge", locationName: "1413 Webberville Rd", lat: 30.2535, lng: -97.7075 },
  { performerName: "The Lost Well", locationName: "2422 Webberville Rd", lat: 30.253, lng: -97.704 },
  { performerName: "Skylark Lounge", locationName: "2039 Airport Blvd", lat: 30.2785, lng: -97.7145 },
  { performerName: "The Vortex", locationName: "2307 Manor Rd", lat: 30.296, lng: -97.716 },
  { performerName: "Meanwhile Brewing Co.", locationName: "3901 Promontory Point Dr", lat: 30.2335, lng: -97.708 },
  { performerName: "Radio East", locationName: "3504 Montopolis Dr", lat: 30.236, lng: -97.703 },
  { performerName: "Central Machine Works", locationName: "4824 E Cesar Chavez St", lat: 30.2535, lng: -97.7055 },
  // — UT / Guadalupe / North (6) —
  { performerName: "Bass Concert Hall", locationName: "2350 Robert Dedman Dr", lat: 30.2885, lng: -97.7379 },
  { performerName: "Hogg Memorial Auditorium", locationName: "2300 Robert Dedman Dr", lat: 30.287, lng: -97.736 },
  { performerName: "Spider House Ballroom", locationName: "2906 Fruth St", lat: 30.2893, lng: -97.7423 },
  { performerName: "Hole in the Wall", locationName: "2538 Guadalupe St", lat: 30.2885, lng: -97.7405 },
  { performerName: "Waterloo Records", locationName: "600 N Lamar Blvd", lat: 30.2712, lng: -97.752 },
  { performerName: "Austin Scottish Rite Theater", locationName: "207 W 18th St", lat: 30.279, lng: -97.74 },
  // — Kick Butt Coffee (locked venue — North via the Airport corridor) —
  { performerName: "Kick Butt Coffee", locationName: "5775 Airport Blvd", lat: 30.32562, lng: -97.7152 },
  // — West Austin (10) —
  { performerName: "The Tavern", locationName: "1206 W 6th St", lat: 30.2818, lng: -97.7553 },
  { performerName: "Donn's Depot", locationName: "1600 W 5th St", lat: 30.283, lng: -97.7647 },
  { performerName: "Deep Eddy Cabaret", locationName: "2315 Lake Austin Blvd", lat: 30.286, lng: -97.7645 },
  { performerName: "Mozart's Coffee Roasters", locationName: "3825 Lake Austin Blvd", lat: 30.2915, lng: -97.786 },
  { performerName: "ZACH Theater — Kleberg Stage", locationName: "1510 Toomey Rd", lat: 30.2624, lng: -97.757 },
  { performerName: "The Long Center", locationName: "701 W Riverside Dr", lat: 30.2605, lng: -97.76 },
  { performerName: "Auditorium Shores Stage", locationName: "800 W Riverside Dr", lat: 30.26, lng: -97.763 },
  { performerName: "Zilker Hillside Theater", locationName: "2201 Barton Springs Rd", lat: 30.262, lng: -97.768 },
  { performerName: "ACL Festival Grounds at Zilker", locationName: "2101 Barton Springs Rd", lat: 30.263, lng: -97.772 },
  { performerName: "One World Theatre", locationName: "7701 Bee Cave Rd", lat: 30.2848, lng: -97.8103 },
];

/**
 * The original 33 generated rooms (36 pins with the three originals) —
 * kept verbatim; the real-Austin append is concatenated in after this block.
 */
const LEGACY_GENERATED_VENUES: VenueTemplate[] = [
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
 * Full generated venue set: the 33 legacy rooms plus the 93-venue
 * real-Austin Move 3 append, in that order (legacy indices first so the
 * original 36 pins keep their scheduled positions in the byte-stable
 * sequence). Every entry falls inside `AUSTIN_BOUNDS` and classifies under
 * `districtForPoint` — see src/lib/district.ts for the boundary logic.
 */
const GENERATED_VENUES: VenueTemplate[] = [
  ...LEGACY_GENERATED_VENUES,
  ...REAL_AUSTIN_VENUES,
];

/**
 * Generates the city-wide seed. Every call creates a fresh, fixed-seed PRNG,
 * so the sequence of shuffles below is identical every time — the returned
 * array is deep-equal across calls (see seedData.test.ts).
 *
 * Mix scheduling (locked thresholds preserved across the Move 3 expansion so
 * the byte-stable sequence holds over the longer list): the first 11 indices
 * of the generated set are "live", the next 11 "search", the rest "map" —
 * 11 live / 11 search / 104 map across the 126 generated venues. The
 * always-live price of byte-stability: the live count stays 14 (3 originals
 * + 11 scheduled) no matter how large the venue set grows, and local stays
 * 25 (3 originals + 22 scheduled) — both exchange the ~39% / ~69% x-of-36
 * shares for coverage; the admin display contract is pinned literals and
 * is untouched (see src/lib/telemetry.ts). */
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
