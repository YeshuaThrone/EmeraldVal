import { geocodeQuery, reverseGeocode } from "@/lib/geocode";
import { districtForPoint } from "@/lib/district";
import type { District, Pin } from "@/lib/types";

/**
 * ATXLiveArtistSDK — client-side backing for the pasted ATXLiveArtistSDK.
 *
 * Load-bearing assumption (see the Artist SDK & Upload Studio spec): the
 * pasted SDK POSTs to https://api.atxlive.app/v1, an API that does not
 * exist — this app is frontend-only with a client-side pin model. Shipped
 * as written, every call would throw at runtime. So the public interface
 * is kept byte-compatible (constructor(config), init, uploadShow,
 * triggerLivePing, and the exact payload field names) while the backing is
 * the same flow the Go-Live modal uses: Nominatim geocoding via
 * `geocodeQuery` and typed pins in the live pin store. A future real
 * backend is a drop-in swap of the transport only — the payload builders
 * below already produce the wire shapes (artist_id, venue_name, address,
 * district, set_time, ticket_url, created_at / artist_id, latitude,
 * longitude, timestamp, status: "ON_STAGE").
 *
 * Error contract (deliberate, tested):
 * - `uploadShow` NEVER throws. Every failure — validation, uninitialized
 *   artist, geocoding — returns `{ success: false, error, code }` so the
 *   upload widget can render themed inline feedback instead of an alert().
 * - `triggerLivePing` THROWS when `init(artistId)` was never called
 *   (calling it uninitialized is a programmer error, not user input), and
 *   returns a typed failure for invalid coordinates.
 *
 * Framework-agnostic: no React imports. The widget (PR 18) mirrors the
 * returned pins into React state; a future transport can consume the same
 * payloads server-side.
 */

export type ArtistPinStatus = "SCHEDULED" | "ON_STAGE";

/** A show pin created by the SDK — an existing Pin with artist metadata. */
export type ArtistShowPin = Pin & {
  source: "artist";
  artistId: string;
  status: ArtistPinStatus;
  /** ISO 8601 set time. */
  setTime: string;
  ticketUrl?: string;
};

export type UploadShowInput = {
  venueName: string;
  address?: string;
  district: District;
  /** datetime-local string or any value `new Date()` can parse. */
  setTime: string;
  ticketUrl?: string;
};

export type LivePingInput = {
  lat: number;
  lng: number;
};

export type ATXLiveArtistSDKConfig = {
  artistId?: string;
  /**
   * Kept for the future HTTP transport swap only. The client-side backing
   * never reads it — there is no backend to point at (see the spec's
   * load-bearing assumption).
   */
  baseUrl?: string;
};

/** Wire shape for a future transport — field names match the pasted SDK. */
export type UploadShowPayload = {
  artist_id: string;
  venue_name: string;
  address: string;
  district: string;
  set_time: string;
  ticket_url: string;
  created_at: string;
};

/** Wire shape for a future transport — field names match the pasted SDK. */
export type LivePingPayload = {
  artist_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: "ON_STAGE";
};

export type ArtistSdkErrorCode =
  | "not_initialized"
  | "missing_venue"
  | "invalid_district"
  | "missing_set_time"
  | "invalid_set_time"
  | "invalid_coords"
  | "geocode_failed";

export type ArtistSdkSuccess<P> = {
  success: true;
  pinId: string;
  pin: ArtistShowPin;
  /** The transport payload this call would have POSTed to the real API. */
  payload: P;
};

export type ArtistSdkFailure = {
  success: false;
  error: string;
  code: ArtistSdkErrorCode;
};

export type UploadShowResult =
  | ArtistSdkSuccess<UploadShowPayload>
  | ArtistSdkFailure;

export type LivePingResult =
  | ArtistSdkSuccess<LivePingPayload>
  | ArtistSdkFailure;

/** The five districts this app tracks — the only valid `district` values. */
export const ARTIST_SDK_DISTRICTS: readonly District[] = [
  "Downtown",
  "North",
  "South",
  "East",
  "West",
];

const ERROR_MESSAGES: Record<ArtistSdkErrorCode, string> = {
  not_initialized: "Initialize the SDK with init(artistId) first.",
  missing_venue: "Venue name is required.",
  invalid_district: "District must be one of the five Austin districts.",
  missing_set_time: "Set time is required.",
  invalid_set_time: "Set time must be a valid date and time.",
  invalid_coords: "Live ping needs valid latitude and longitude.",
  geocode_failed: "Could not find that venue on the map.",
};

function failure(code: ArtistSdkErrorCode, error?: string): ArtistSdkFailure {
  return { success: false, error: error ?? ERROR_MESSAGES[code], code };
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

function isParseableDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function isFiniteCoord(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Pure validator. Returns the error code for the first invalid field, or
 * null when the input would pass. Order: venue → district → setTime.
 */
export function validateUploadShowInput(
  input: UploadShowInput,
): ArtistSdkErrorCode | null {
  if (isBlank(input.venueName)) {
    return "missing_venue";
  }
  if (
    !ARTIST_SDK_DISTRICTS.includes(input.district)
  ) {
    return "invalid_district";
  }
  if (isBlank(input.setTime)) {
    return "missing_set_time";
  }
  if (!isParseableDate(input.setTime)) {
    return "invalid_set_time";
  }
  return null;
}

/** Pure payload builder — the exact wire shape the pasted SDK POSTed. */
export function buildUploadShowPayload(
  input: UploadShowInput,
  artistId: string,
  createdAt: Date,
): UploadShowPayload {
  return {
    artist_id: artistId,
    venue_name: input.venueName.trim(),
    address: input.address?.trim() ?? "",
    district: input.district,
    set_time: new Date(input.setTime).toISOString(),
    ticket_url: input.ticketUrl?.trim() ?? "",
    created_at: createdAt.toISOString(),
  };
}

/** Pure payload builder — the exact wire shape the pasted SDK POSTed. */
export function buildLivePingPayload(
  coords: LivePingInput,
  artistId: string,
  timestamp: Date,
): LivePingPayload {
  return {
    artist_id: artistId,
    latitude: coords.lat,
    longitude: coords.lng,
    timestamp: timestamp.toISOString(),
    status: "ON_STAGE",
  };
}

function createArtistPin(partial: {
  lat: number;
  lng: number;
  artistId: string;
  status: ArtistPinStatus;
  locationName: string;
  district: District | undefined;
  setTime: string;
  ticketUrl?: string;
}): ArtistShowPin {
  return {
    id: crypto.randomUUID(),
    lat: partial.lat,
    lng: partial.lng,
    // The SDK knows the artist only by id; the widget (PR 18) supplies the
    // display name context around it.
    performerName: partial.artistId,
    locationName: partial.locationName,
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "artist",
    district: partial.district,
    artistId: partial.artistId,
    status: partial.status,
    setTime: partial.setTime,
    ...(partial.ticketUrl ? { ticketUrl: partial.ticketUrl } : {}),
  };
}

export class ATXLiveArtistSDK {
  private artistId: string | null;
  private readonly baseUrl: string | null;
  private readonly pins: ArtistShowPin[] = [];

  constructor(config: ATXLiveArtistSDKConfig = {}) {
    // A constructor-provided artistId counts as initialized; init() can
    // still override it later.
    this.artistId = config.artistId?.trim() || null;
    this.baseUrl = config.baseUrl ?? null;
  }

  /** Sets (or overrides) the artist this SDK instance acts for. */
  init(artistId: string): void {
    const trimmed = artistId.trim();
    if (trimmed === "") {
      throw new Error(
        "ATXLiveArtistSDK.init requires a non-empty artistId.",
      );
    }
    this.artistId = trimmed;
  }

  /** Read-only view of the pins this instance created, for the map host. */
  get artistPins(): readonly ArtistShowPin[] {
    return this.pins;
  }

  private requireArtist(): string {
    if (this.artistId === null) {
      throw new Error(
        "ATXLiveArtistSDK used before init(artistId). Call init() first.",
      );
    }
    return this.artistId;
  }

  async uploadShow(input: UploadShowInput): Promise<UploadShowResult> {
    if (this.artistId === null) {
      return failure("not_initialized");
    }

    const validationError = validateUploadShowInput(input);
    if (validationError !== null) {
      return failure(validationError);
    }

    // Same geocoding flow as the Go-Live modal: address if given, else the
    // venue name — both go through the app's Nominatim-backed geocoder.
    const query = input.address?.trim() || input.venueName.trim();
    const geo = await geocodeQuery(query);
    if (!geo.ok) {
      return failure("geocode_failed", geo.error);
    }

    const payload = buildUploadShowPayload(input, this.artistId, new Date());

    // districtForPoint classifies the geocoded point the same way it does
    // every other user-created pin; the user-selected district is the
    // documented fallback for points outside AUSTIN_BOUNDS (where the
    // classifier returns undefined rather than guessing).
    const classified = districtForPoint(geo.lat, geo.lng);
    const pin = createArtistPin({
      lat: geo.lat,
      lng: geo.lng,
      artistId: this.artistId,
      status: "SCHEDULED",
      locationName: geo.displayName,
      district: classified ?? input.district,
      setTime: payload.set_time,
      ...(input.ticketUrl?.trim() ? { ticketUrl: input.ticketUrl.trim() } : {}),
    });
    this.pins.push(pin);

    return { success: true, pinId: pin.id, pin, payload };
  }

  async triggerLivePing(coords: LivePingInput): Promise<LivePingResult> {
    // Guard per the pasted interface: uninitialized use is a programmer
    // error, so it throws instead of returning a failure result.
    const artistId = this.requireArtist();

    if (!isFiniteCoord(coords.lat) || !isFiniteCoord(coords.lng)) {
      return failure("invalid_coords");
    }

    const payload = buildLivePingPayload(coords, artistId, new Date());

    // Mark the artist's most recent show pin ON_STAGE; if the artist never
    // uploaded a show, create an ON_STAGE pin at the ping's coordinates.
    const existing = [...this.pins]
      .reverse()
      .find((pin) => pin.artistId === artistId);

    if (existing) {
      existing.status = "ON_STAGE";
      return { success: true, pinId: existing.id, pin: existing, payload };
    }

    // Name the live spot when the reverse geocoder can; fall back to the
    // raw coordinates otherwise — the ping itself still succeeds.
    const reverse = await reverseGeocode(coords.lat, coords.lng);
    const locationName = reverse.ok
      ? reverse.displayName
      : `Live position (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

    const pin = createArtistPin({
      lat: coords.lat,
      lng: coords.lng,
      artistId,
      status: "ON_STAGE",
      locationName,
      district: districtForPoint(coords.lat, coords.lng),
      setTime: payload.timestamp,
    });
    this.pins.push(pin);

    return { success: true, pinId: pin.id, pin, payload };
  }
}
