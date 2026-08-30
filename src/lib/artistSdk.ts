
import { geocodeQuery, reverseGeocode } from "@/lib/geocode";
import { districtForPoint } from "@/lib/district";
import type { District, Pin, Ticketing } from "@/lib/types";
import { requestJson, type TransportFailure } from "@/lib/transport";

/** Same-origin endpoints the SDK writes to (PR 22 transport swap). */
const SHOWS_ENDPOINT = "/api/shows";
const LIVE_PING_ENDPOINT = "/api/telemetry/live-ping";

/**
 * ATXLiveArtistSDK — the pasted SDK's interface over the real same-origin
 * API (PR 22 transport swap).
 *
 * The pasted SDK POSTed to https://api.atxlive.app/v1, an API that does
 * not exist; PRs #17/#19 kept the public interface byte-compatible
 * (constructor(config), init, uploadShow, triggerLivePing, and the exact
 * payload field names) while backing it with client state. PR 21 shipped
 * the real endpoints, and this module now POSTs to them: uploadShow →
 * POST /api/shows, triggerLivePing → POST /api/telemetry/live-ping, with
 * the exact PR #19 wire fields. Client-side geocoding stays — the SDK
 * computes the venue point with `geocodeQuery` and sends it in the payload
 * (additive latitude/longitude fields, same pattern as the v2 fields) so a
 * reloaded map can restore the pin without re-geocoding.
 *
 * Error contract (deliberate, tested):
 * - `uploadShow` NEVER throws. Every failure — validation, uninitialized
 *   artist, geocoding, transport (network, timeout, non-2xx) — returns
 *   `{ success: false, error, code }` so the upload widget can render
 *   themed inline feedback instead of an alert(). Transport failures carry
 *   distinct codes: network_error, request_timeout, auth_error (401/403),
 *   validation_error (other 4xx — the server's `{error, code}` envelope is
 *   surfaced verbatim), and server_error (5xx).
 * - `triggerLivePing` THROWS when `init(artistId)` was never called
 *   (calling it uninitialized is a programmer error, not user input), and
 *   returns a typed failure for invalid coordinates and transport errors.
 * - Successes carry `serverId` — the id the server assigned the stored
 *   record — alongside the local `pinId`.
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
  /** Required, non-empty after trim (v2 panel contract). */
  artistName: string;
  address?: string;
  district: District;
  /** datetime-local string or any value `new Date()` can parse. */
  setTime: string;
  /**
   * v2 ticketing — a discriminated union. When present it takes precedence
   * over the legacy flat `ticketUrl` below.
   */
  ticketing?: Ticketing;
  /**
   * Legacy flat form kept for pre-v2 callers: normalized to
   * `{ type: "external", ticketUrl }`. Ignored when `ticketing` is set.
   */
  ticketUrl?: string;
  /** Verbatim City Council District select label, e.g. "District 1" (v2). */
  councilDistrict?: string;
};

export type LivePingInput = {
  lat: number;
  lng: number;
};

export type ATXLiveArtistSDKConfig = {
  artistId?: string;
  /**
   * Reserved for a future remote host (the pasted SDK pointed at
   * https://api.atxlive.app/v1). The real transport writes to the
   * same-origin /api endpoints and does not read this yet.
   */
  baseUrl?: string;
};

/**
 * Wire shape for a future transport — field names match the pasted SDK.
 * The v2 fields below are additive; the original seven keep their names and
 * value shapes byte-compatible so an old transport keeps parsing.
 */
export type UploadShowPayload = {
  artist_id: string;
  venue_name: string;
  address: string;
  district: string;
  set_time: string;
  ticket_url: string;
  created_at: string;
  /** v2: display name from the panel's Artist Name field. */
  artist_name: string;
  /** v2: "external" | "native", or "" when no ticketing was given. */
  ticketing_type: "external" | "native" | "";
  /** v2: native-only; null for external or no ticketing. */
  native_ticket_price: number | null;
  /** v2: native-only; null for external or no ticketing. */
  native_ticket_capacity: number | null;
  /**
   * PR 22 additive fields — the client-geocoded venue point, so the server
   * can hand the pin's coordinates back on reload. Null when geocoding
   * produced no point (legacy clients); hydration skips such shows.
   */
  latitude: number | null;
  longitude: number | null;
  /** PR 22: verbatim council-district select label; "" when none chosen. */
  council_district: string;
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
  | "missing_artist_name"
  | "invalid_district"
  | "missing_set_time"
  | "invalid_set_time"
  | "invalid_ticketing"
  | "invalid_ticket_price"
  | "invalid_ticket_capacity"
  | "invalid_coords"
  | "geocode_failed"
  // PR 22 transport codes — every way a real HTTP call can fail.
  | "network_error"
  | "request_timeout"
  | "auth_error"
  | "validation_error"
  | "server_error";

export type ArtistSdkSuccess<P> = {
  success: true;
  pinId: string;
  pin: ArtistShowPin;
  /** The transport payload this call POSTed to the real API. */
  payload: P;
  /** The id the server assigned the stored record. */
  serverId: string;
};

export type ArtistSdkFailure = {
  success: false;
  error: string;
  code: ArtistSdkErrorCode;
  /** HTTP status, when the failure came from a server response. */
  httpStatus?: number;
  /** The server envelope's machine code, when one was returned. */
  serverCode?: string;
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

/** One row of the City Council District select, verbatim from the v2 panel. */
export type CouncilDistrictEntry = {
  /** Select option label, e.g. "District 1". */
  label: string;
  /** Area descriptor shown alongside the label in the select. */
  area: string;
  /** The app's five-district filter bucket this council district maps to. */
  district: District;
};

/**
 * All ten Austin City Council District options, verbatim, each mapped to the
 * app's five-district filter model. Display contract: the panel shows these
 * labels; the geocoded point still drives `districtForPoint` for filter
 * classification, and the chosen label is stored on the pin as metadata.
 */
export const COUNCIL_DISTRICTS: readonly CouncilDistrictEntry[] = [
  { label: "District 1", area: "East Austin", district: "East" },
  { label: "District 2", area: "Southeast Austin", district: "East" },
  { label: "District 3", area: "East / South Central", district: "East" },
  { label: "District 4", area: "North Central", district: "North" },
  { label: "District 5", area: "South Austin", district: "South" },
  { label: "District 6", area: "Northwest / Lakeline", district: "North" },
  { label: "District 7", area: "North Austin / Burnet", district: "North" },
  { label: "District 8", area: "Southwest / Oak Hill", district: "South" },
  { label: "District 9", area: "Downtown / UT Campus", district: "Downtown" },
  { label: "District 10", area: "West Austin / NW", district: "West" },
];

/** Pure lookup: the five-district bucket for a council-district label. */
export function councilDistrictBucket(label: string): District | undefined {
  return COUNCIL_DISTRICTS.find((entry) => entry.label === label)?.district;
}

const ERROR_MESSAGES: Record<ArtistSdkErrorCode, string> = {
  not_initialized: "Initialize the SDK with init(artistId) first.",
  missing_venue: "Venue name is required.",
  missing_artist_name: "Artist name is required.",
  invalid_district: "District must be one of the five Austin districts.",
  missing_set_time: "Set time is required.",
  invalid_set_time: "Set time must be a valid date and time.",
  invalid_ticketing: "Ticketing must be an external link or native ticketing.",
  invalid_ticket_price:
    "Native ticket price must be a number that is zero or more.",
  invalid_ticket_capacity:
    "Native ticket capacity must be a whole number of at least 1.",
  invalid_coords: "Live ping needs valid latitude and longitude.",
  geocode_failed: "Could not find that venue on the map.",
  network_error:
    "Couldn't reach the ATXLive server. Check your connection and try again.",
  request_timeout: "The server took too long to respond. Please try again.",
  auth_error: "You're not authorized to do that.",
  validation_error: "The server rejected this show.",
  server_error: "The ATXLive server hit an error. Please try again.",
};

function failure(
  code: ArtistSdkErrorCode,
  error?: string,
  extra?: { httpStatus?: number; serverCode?: string },
): ArtistSdkFailure {
  return {
    success: false,
    error: error ?? ERROR_MESSAGES[code],
    code,
    ...(extra?.httpStatus !== undefined
      ? { httpStatus: extra.httpStatus }
      : {}),
    ...(extra?.serverCode !== undefined
      ? { serverCode: extra.serverCode }
      : {}),
  };
}

/**
 * Maps a transport failure onto the SDK's result contract — the codes and
 * envelope fields carry over one-to-one; only the discriminant renames
 * (ok → success).
 */
function transportFailure(result: TransportFailure): ArtistSdkFailure {
  return failure(result.code, result.error, {
    httpStatus: result.httpStatus,
    serverCode: result.serverCode,
  });
}

/**
 * Extracts the server-assigned id from a stored-record response body. A 2xx
 * with an unexpected body is a server fault, not a success — the caller
 * maps this to a typed server_error instead of trusting it.
 */
function serverIdFrom(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { id?: unknown }).id === "string"
  ) {
    return (body as { id: string }).id;
  }
  return null;
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
 * Normalizes the two ticketing input forms into the v2 union: the
 * discriminated `ticketing` field wins; the legacy flat `ticketUrl` string
 * becomes `{ type: "external", ticketUrl }`. Undefined when neither is set.
 */
export function normalizeTicketing(
  input: Pick<UploadShowInput, "ticketing" | "ticketUrl">,
): Ticketing | undefined {
  if (input.ticketing !== undefined) {
    return input.ticketing;
  }
  if (input.ticketUrl !== undefined) {
    return { type: "external", ticketUrl: input.ticketUrl };
  }
  return undefined;
}

/**
 * Pure ticketing validator. External accepts any string URL (empty or
 * whitespace means "no link"); native requires a finite price ≥ 0 and an
 * integer capacity ≥ 1. Runtime typeof guards catch malformed unions from
 * untyped (JS) callers that the compiler would otherwise assume away.
 */
function validateTicketing(ticketing: Ticketing): ArtistSdkErrorCode | null {
  if (ticketing.type === "external") {
    if (
      ticketing.ticketUrl !== undefined &&
      typeof ticketing.ticketUrl !== "string"
    ) {
      return "invalid_ticketing";
    }
    return null;
  }
  if (ticketing.type === "native") {
    if (
      typeof ticketing.price !== "number" ||
      !Number.isFinite(ticketing.price) ||
      ticketing.price < 0
    ) {
      return "invalid_ticket_price";
    }
    if (
      typeof ticketing.capacity !== "number" ||
      !Number.isInteger(ticketing.capacity) ||
      ticketing.capacity < 1
    ) {
      return "invalid_ticket_capacity";
    }
    return null;
  }
  return "invalid_ticketing";
}

/**
 * Pure validator. Returns the error code for the first invalid field, or
 * null when the input would pass. Order: venue → artistName → district →
 * setTime → ticketing.
 */
export function validateUploadShowInput(
  input: UploadShowInput,
): ArtistSdkErrorCode | null {
  if (isBlank(input.venueName)) {
    return "missing_venue";
  }
  if (isBlank(input.artistName)) {
    return "missing_artist_name";
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
  const ticketing = normalizeTicketing(input);
  if (ticketing !== undefined) {
    const ticketingError = validateTicketing(ticketing);
    if (ticketingError !== null) {
      return ticketingError;
    }
  }
  return null;
}

/**
 * Pure payload builder — the exact wire shape the pasted SDK POSTed, plus
 * the PR 22 additive fields (geocoded point, council-district label). The
 * original fields keep their names and value shapes byte-compatible.
 */
export function buildUploadShowPayload(
  input: UploadShowInput,
  artistId: string,
  createdAt: Date,
  coords?: { latitude: number; longitude: number },
): UploadShowPayload {
  const ticketing = normalizeTicketing(input);
  return {
    artist_id: artistId,
    venue_name: input.venueName.trim(),
    address: input.address?.trim() ?? "",
    district: input.district,
    set_time: new Date(input.setTime).toISOString(),
    ticket_url:
      ticketing?.type === "external" ? (ticketing.ticketUrl?.trim() ?? "") : "",
    created_at: createdAt.toISOString(),
    artist_name: input.artistName.trim(),
    ticketing_type: ticketing?.type ?? "",
    native_ticket_price: ticketing?.type === "native" ? ticketing.price : null,
    native_ticket_capacity:
      ticketing?.type === "native" ? ticketing.capacity : null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    council_district: input.councilDistrict?.trim() ?? "",
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
  artistName?: string;
  councilDistrict?: string;
  ticketing?: Ticketing;
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
    ...(partial.artistName !== undefined
      ? { artistName: partial.artistName }
      : {}),
    ...(partial.councilDistrict !== undefined
      ? { councilDistrict: partial.councilDistrict }
      : {}),
    ...(partial.ticketing !== undefined
      ? { ticketing: partial.ticketing }
      : {}),
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

    const payload = buildUploadShowPayload(input, this.artistId, new Date(), {
      latitude: geo.lat,
      longitude: geo.lng,
    });

    // The payload builders finally go on the wire: the server validates
    // with the same shared validators, stores the show, and returns the
    // stored record (with its generated id) as 201.
    const transport = await requestJson(SHOWS_ENDPOINT, {
      method: "POST",
      body: payload,
    });
    if (!transport.ok) {
      return transportFailure(transport);
    }
    const serverId = serverIdFrom(transport.body);
    if (serverId === null) {
      return failure("server_error", "Server returned an unexpected response.", {
        httpStatus: transport.status,
      });
    }

    const ticketing = normalizeTicketing(input);

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
      ...(ticketing?.type === "external" && ticketing.ticketUrl?.trim()
        ? { ticketUrl: ticketing.ticketUrl.trim() }
        : {}),
      artistName: input.artistName.trim(),
      councilDistrict: input.councilDistrict?.trim() || undefined,
      ticketing,
    });
    this.pins.push(pin);

    return { success: true, pinId: pin.id, pin, payload, serverId };
  }

  async triggerLivePing(coords: LivePingInput): Promise<LivePingResult> {
    // Guard per the pasted interface: uninitialized use is a programmer
    // error, so it throws instead of returning a failure result.
    const artistId = this.requireArtist();

    if (!isFiniteCoord(coords.lat) || !isFiniteCoord(coords.lng)) {
      return failure("invalid_coords");
    }

    const payload = buildLivePingPayload(coords, artistId, new Date());

    // Persist the ping server-side first: only a stored ping flips the
    // local pin, so a failed request never leaves phantom live state.
    const transport = await requestJson(LIVE_PING_ENDPOINT, {
      method: "POST",
      body: payload,
    });
    if (!transport.ok) {
      return transportFailure(transport);
    }
    const serverId = serverIdFrom(transport.body);
    if (serverId === null) {
      return failure("server_error", "Server returned an unexpected response.", {
        httpStatus: transport.status,
      });
    }

    // Mark the artist's most recent show pin ON_STAGE; if the artist never
    // uploaded a show, create an ON_STAGE pin at the ping's coordinates.
    const existing = [...this.pins]
      .reverse()
      .find((pin) => pin.artistId === artistId);

    if (existing) {
      existing.status = "ON_STAGE";
      return {
        success: true,
        pinId: existing.id,
        pin: existing,
        payload,
        serverId,
      };
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

    return { success: true, pinId: pin.id, pin, payload, serverId };
  }
}
