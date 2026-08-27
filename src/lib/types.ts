export const GENRES = [
  "Acoustic",
  "Hip-Hop",
  "Blues/Rock",
  "Brass",
  "Country",
] as const;

export type Genre = (typeof GENRES)[number];

export type PinSource = "search" | "live" | "map";

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
