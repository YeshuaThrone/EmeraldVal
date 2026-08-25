export const GENRES = ["Acoustic", "Hip-Hop", "Rock", "Electronic"] as const;

export type Genre = (typeof GENRES)[number];

export const GENRE_FILTERS = [
  "All",
  "Festivals",
  "Acoustic",
  "Hip-Hop",
  "Rock",
  "Electronic",
] as const;

export type GenreFilter = (typeof GENRE_FILTERS)[number];

export type MapViewMode = "map" | "festivals";

export type PinKind = "live" | "festival" | "drop";

export type PinSource = "search" | "live" | "map" | "festival";

export type FestivalSet = {
  artist: string;
  startTime: string;
  endTime: string;
  genre: Genre;
};

export type FestivalStage = {
  name: string;
  sets: FestivalSet[];
};

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  performerName: string;
  locationName: string;
  genre: Genre | "";
  kind: PinKind;
  tipAmount: string;
  cashApp: string;
  venmo: string;
  source: PinSource;
  liveAt: number;
  liveUntil: number;
  stages?: FestivalStage[];
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
