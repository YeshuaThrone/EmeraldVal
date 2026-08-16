import { LIVE_TTL_MS } from "@/lib/countdown";
import type { Pin } from "@/lib/types";

export const DOWNTOWN_AUSTIN = {
  latitude: 30.2655,
  longitude: -97.743,
};

export const DEFAULT_ZOOM = 15.6;
export const DEFAULT_PITCH = 58;
export const DEFAULT_BEARING = -18;
export const PIN_ZOOM = 16.4;

export const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#121826] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/40";

const SEED_LIVE_AT = Date.now();
const SEED_LIVE_UNTIL = SEED_LIVE_AT + LIVE_TTL_MS;

export const INITIAL_PINS: Pin[] = [
  {
    id: "seed-sixth",
    lat: 30.2674,
    lng: -97.7398,
    performerName: "The Blackhearts",
    locationName: "East 6th Street",
    genre: "Rock",
    kind: "live",
    tipAmount: "",
    cashApp: "blackheartsatx",
    venmo: "blackhearts",
    source: "live",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
  },
  {
    id: "seed-red-river",
    lat: 30.2676,
    lng: -97.7372,
    performerName: "Nightshade",
    locationName: "Red River District",
    genre: "Electronic",
    kind: "live",
    tipAmount: "",
    cashApp: "nightshadeatx",
    venmo: "nightshadeatx",
    source: "live",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
  },
  {
    id: "seed-rainey",
    lat: 30.2578,
    lng: -97.7392,
    performerName: "Rainey Street Brass",
    locationName: "Rainey Street District",
    genre: "Hip-Hop",
    kind: "live",
    tipAmount: "",
    cashApp: "raineybrass",
    venmo: "raineybrass",
    source: "live",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
  },
  {
    id: "seed-soco",
    lat: 30.2504,
    lng: -97.749,
    performerName: "SoCo Strings",
    locationName: "South Congress Avenue",
    genre: "Acoustic",
    kind: "live",
    tipAmount: "",
    cashApp: "socostrings",
    venmo: "socostrings",
    source: "live",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
  },
  {
    id: "fest-red-river",
    lat: 30.2675,
    lng: -97.7364,
    performerName: "Red River Revival",
    locationName: "6th Street & Red River",
    genre: "Rock",
    kind: "festival",
    tipAmount: "",
    cashApp: "redriverrevival",
    venmo: "redriverrevival",
    source: "festival",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
    stages: [
      {
        name: "Main Stage",
        sets: [
          {
            artist: "The Blackhearts",
            startTime: "7:00 PM",
            endTime: "7:45 PM",
            genre: "Rock",
          },
          {
            artist: "Hot Iron",
            startTime: "8:00 PM",
            endTime: "8:50 PM",
            genre: "Rock",
          },
          {
            artist: "Nightshade",
            startTime: "9:15 PM",
            endTime: "10:30 PM",
            genre: "Electronic",
          },
        ],
      },
      {
        name: "Alley Stage",
        sets: [
          {
            artist: "Cedar & Smoke",
            startTime: "7:30 PM",
            endTime: "8:15 PM",
            genre: "Acoustic",
          },
          {
            artist: "Eastside Cipher",
            startTime: "8:30 PM",
            endTime: "9:20 PM",
            genre: "Hip-Hop",
          },
        ],
      },
    ],
  },
  {
    id: "fest-zilker",
    lat: 30.2669,
    lng: -97.7728,
    performerName: "Zilker Sunset Sessions",
    locationName: "Zilker Park",
    genre: "Electronic",
    kind: "festival",
    tipAmount: "",
    cashApp: "zilkersessions",
    venmo: "zilkersessions",
    source: "festival",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
    stages: [
      {
        name: "Hillside Stage",
        sets: [
          {
            artist: "Lumen Waves",
            startTime: "6:00 PM",
            endTime: "7:10 PM",
            genre: "Electronic",
          },
          {
            artist: "SoCo Strings",
            startTime: "7:30 PM",
            endTime: "8:15 PM",
            genre: "Acoustic",
          },
        ],
      },
      {
        name: "Grove Stage",
        sets: [
          {
            artist: "Barton Beats",
            startTime: "8:30 PM",
            endTime: "9:45 PM",
            genre: "Electronic",
          },
        ],
      },
    ],
  },
  {
    id: "fest-rainey",
    lat: 30.2584,
    lng: -97.7386,
    performerName: "Rainey Block Party",
    locationName: "Rainey Street Historic District",
    genre: "Hip-Hop",
    kind: "festival",
    tipAmount: "",
    cashApp: "raineyblock",
    venmo: "raineyblock",
    source: "festival",
    liveAt: SEED_LIVE_AT,
    liveUntil: SEED_LIVE_UNTIL,
    stages: [
      {
        name: "Bungalow Stage",
        sets: [
          {
            artist: "Rainey Street Brass",
            startTime: "6:30 PM",
            endTime: "7:20 PM",
            genre: "Hip-Hop",
          },
          {
            artist: "Ladybird Flow",
            startTime: "7:40 PM",
            endTime: "8:30 PM",
            genre: "Hip-Hop",
          },
        ],
      },
    ],
  },
];

export function pinRadiusMeters(zoom: number): number {
  return Math.max(2.8, Math.min(16, 72 / 2 ** (zoom - 12)));
}

export function pinElevationMeters(zoom: number): number {
  return Math.max(16, Math.min(70, 10 * 2 ** (16.2 - zoom)));
}

export function pinGlowPixels(zoom: number, selected: boolean): number {
  const base = zoom >= 16 ? 11 : zoom >= 15 ? 8 : 5;
  return selected ? base + 5 : base;
}
