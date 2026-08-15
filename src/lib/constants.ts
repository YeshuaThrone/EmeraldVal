import type { Pin } from "@/lib/types";

export const DOWNTOWN_AUSTIN: [number, number] = [30.2655, -97.743];
export const DEFAULT_ZOOM = 14;
export const PIN_ZOOM = 16;

export const AUSTIN_BOUNDS: [[number, number], [number, number]] = [
  [30.08, -98.05],
  [30.55, -97.5],
];

export const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#121826] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/40";

export const INITIAL_PINS: Pin[] = [
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
  },
];
