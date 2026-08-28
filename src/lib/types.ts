export const GENRES = [
  "Acoustic",
  "Hip-Hop",
  "Blues/Rock",
  "Brass",
  "Country",
] as const;

export type Genre = (typeof GENRES)[number];

export type PinSource = "search" | "live" | "map" | "artist";

/** How tickets are sold for a show — an external link or ATXLive native ticketing. */
export type ExternalTicketing = {
  type: "external";
  /** Empty or whitespace-only means "no link" (the field was cleared). */
  ticketUrl?: string;
};

/** Native ticketing is data, not checkout — no payment backend exists yet. */
export type NativeTicketing = {
  type: "native";
  /** Price in dollars; finite and ≥ 0. */
  price: number;
  /** Whole number of tickets; integer ≥ 1. */
  capacity: number;
};

export type Ticketing = ExternalTicketing | NativeTicketing;

export type District = "Downtown" | "North" | "South" | "East" | "West";

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  performerName: string;
  locationName: string;
  genre: Genre | "";
  tipAmount: string;
  cashApp: string;
  venmo: string;
  source: PinSource;
  /** Set at creation (seed or districtForPoint); admin analytics groups by it. */
  district?: District;
  /** Local act vs touring act. Undefined for user-created pins (search/map/live). */
  isLocal?: boolean;
  /** Artist v2 metadata — set by the artist SDK on show pins. */
  /** Verbatim City Council District select label, e.g. "District 1". */
  councilDistrict?: string;
  /** Display name from the v2 panel's Artist Name field. */
  artistName?: string;
  /** Ticketing method captured by the v2 panel. */
  ticketing?: Ticketing;
};

export type FlyToTarget = {
  lat: number;
  lng: number;
  zoom: number;
};

export type ToastMessage = {
  type: "success" | "error";
  message: string;
};

export type GeocodeSuccess = {
  ok: true;
  lat: number;
  lng: number;
  displayName: string;
};

export type GeocodeFailure = {
  ok: false;
  error: string;
};

export type GeocodeResponse = GeocodeSuccess | GeocodeFailure;
