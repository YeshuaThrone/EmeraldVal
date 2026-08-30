import type { District } from "@/lib/types";

/**
 * Shared pure validators for the ATXLive wire payloads — the exact field
 * names the ATXLiveArtistSDK builds (see `buildUploadShowPayload` /
 * `buildLivePingPayload` in src/lib/artistSdk.ts).
 *
 * Single source of truth for the rules: the server route handlers validate
 * incoming JSON with these, and PR 22's SDK transport swap reuses them
 * client-side — the rules are never duplicated on both sides of the wire.
 *
 * Every validator accepts `unknown` (the JSON body is untyped at the
 * boundary) and returns a discriminated result: either the normalized,
 * strongly-typed value ready for the store, or a typed error code plus a
 * human-readable message for the {error, code} JSON envelope.
 */

/** The five districts this app tracks — the only valid `district` values. */
export const VALID_DISTRICTS: readonly District[] = [
  "Downtown",
  "North",
  "South",
  "East",
  "West",
];

export type ValidationErrorCode =
  | "malformed_body"
  | "missing_artist_id"
  | "missing_venue"
  | "missing_artist_name"
  | "invalid_district"
  | "missing_set_time"
  | "invalid_set_time"
  | "invalid_created_at"
  | "invalid_ticketing"
  | "invalid_ticket_price"
  | "invalid_ticket_capacity"
  | "invalid_coords"
  | "missing_timestamp"
  | "invalid_timestamp"
  | "invalid_status";

export type ValidationSuccess<T> = { ok: true; value: T };

export type ValidationFailure = {
  ok: false;
  code: ValidationErrorCode;
  message: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/** The validated, normalized shape of a POST /api/shows body. */
export type ValidShowPayload = {
  artist_id: string;
  artist_name: string;
  venue_name: string;
  address: string;
  district: District;
  /** ISO 8601. */
  set_time: string;
  ticket_url: string;
  /** ISO 8601; defaulted to now when the client omits it. */
  created_at: string;
  ticketing_type: "external" | "native" | "";
  native_ticket_price: number | null;
  native_ticket_capacity: number | null;
  /**
   * PR 22 additive fields — the client geocodes the venue and sends the
   * point along so a reloaded map can restore the pin without re-geocoding.
   * Null when the client omitted them (legacy records); hydration skips
   * shows it cannot place.
   */
  latitude: number | null;
  longitude: number | null;
  /** Verbatim council-district select label, e.g. "District 9"; "" if none. */
  council_district: string;
};

/** The validated shape of a POST /api/telemetry/live-ping body. */
export type ValidLivePingPayload = {
  artist_id: string;
  latitude: number;
  longitude: number;
  /** ISO 8601. */
  timestamp: string;
  status: "ON_STAGE";
};

const ERROR_MESSAGES: Record<ValidationErrorCode, string> = {
  malformed_body: "Request body must be a JSON object.",
  missing_artist_id: "artist_id is required.",
  missing_venue: "venue_name is required.",
  missing_artist_name: "artist_name is required.",
  invalid_district: "district must be one of the five Austin districts.",
  missing_set_time: "set_time is required.",
  invalid_set_time: "set_time must be a valid date and time.",
  invalid_created_at: "created_at must be a valid date and time.",
  invalid_ticketing:
    "ticketing_type must be 'external', 'native', or empty.",
  invalid_ticket_price:
    "native_ticket_price must be a number that is zero or more.",
  invalid_ticket_capacity:
    "native_ticket_capacity must be a whole number of at least 1.",
  invalid_coords:
    "latitude must be between -90 and 90 and longitude between -180 and 180.",
  missing_timestamp: "timestamp is required.",
  invalid_timestamp: "timestamp must be a valid date and time.",
  invalid_status: "status must be 'ON_STAGE'.",
};

function fail<T>(code: ValidationErrorCode): ValidationResult<T> {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isParseableDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Pure validator for a POST /api/shows body. Mirrors the SDK's upload
 * rules (venue → artist name → district → set time → ticketing) over the
 * wire field names, and normalizes dates to ISO 8601 and absent optional
 * fields to their stored defaults.
 */
export function validateShowPayload(
  input: unknown,
): ValidationResult<ValidShowPayload> {
  if (!isRecord(input)) {
    return fail("malformed_body");
  }

  if (!isNonEmptyString(input.artist_id)) {
    return fail("missing_artist_id");
  }
  if (!isNonEmptyString(input.venue_name)) {
    return fail("missing_venue");
  }
  if (!isNonEmptyString(input.artist_name)) {
    return fail("missing_artist_name");
  }
  const district = input.district;
  if (
    typeof district !== "string" ||
    !VALID_DISTRICTS.includes(district as District)
  ) {
    return fail("invalid_district");
  }
  if (typeof input.set_time !== "string" || input.set_time.trim() === "") {
    return fail("missing_set_time");
  }
  if (!isParseableDate(input.set_time)) {
    return fail("invalid_set_time");
  }
  if (
    input.created_at !== undefined &&
    (typeof input.created_at !== "string" || !isParseableDate(input.created_at))
  ) {
    return fail("invalid_created_at");
  }

  const ticketingType = input.ticketing_type ?? "";
  if (
    ticketingType !== "external" &&
    ticketingType !== "native" &&
    ticketingType !== ""
  ) {
    return fail("invalid_ticketing");
  }

  let nativeTicketPrice: number | null = null;
  let nativeTicketCapacity: number | null = null;
  if (ticketingType === "native") {
    if (
      typeof input.native_ticket_price !== "number" ||
      !Number.isFinite(input.native_ticket_price) ||
      input.native_ticket_price < 0
    ) {
      return fail("invalid_ticket_price");
    }
    if (
      typeof input.native_ticket_capacity !== "number" ||
      !Number.isInteger(input.native_ticket_capacity) ||
      input.native_ticket_capacity < 1
    ) {
      return fail("invalid_ticket_capacity");
    }
    nativeTicketPrice = input.native_ticket_price;
    nativeTicketCapacity = input.native_ticket_capacity;
  }

  const ticketUrl = input.ticket_url;
  if (ticketUrl !== undefined && ticketUrl !== null && typeof ticketUrl !== "string") {
    return fail("invalid_ticketing");
  }

  // PR 22 additive fields: the geocoded point (optional — legacy clients
  // may omit it) and the verbatim council-district label. Coordinates use
  // the same bounds rule as live pings; absent stays null so hydration can
  // tell "never geocoded" apart from a real point.
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (input.latitude !== undefined && input.latitude !== null) {
    if (
      !isFiniteNumber(input.latitude) ||
      input.latitude < -90 ||
      input.latitude > 90
    ) {
      return fail("invalid_coords");
    }
    latitude = input.latitude;
  }
  if (input.longitude !== undefined && input.longitude !== null) {
    if (
      !isFiniteNumber(input.longitude) ||
      input.longitude < -180 ||
      input.longitude > 180
    ) {
      return fail("invalid_coords");
    }
    longitude = input.longitude;
  }
  const councilDistrict =
    typeof input.council_district === "string"
      ? input.council_district.trim()
      : "";

  return {
    ok: true,
    value: {
      artist_id: input.artist_id.trim(),
      artist_name: input.artist_name.trim(),
      venue_name: input.venue_name.trim(),
      address:
        typeof input.address === "string" ? input.address.trim() : "",
      district: district as District,
      set_time: new Date(input.set_time).toISOString(),
      ticket_url: typeof ticketUrl === "string" ? ticketUrl.trim() : "",
      created_at:
        input.created_at === undefined
          ? new Date().toISOString()
          : new Date(input.created_at).toISOString(),
      ticketing_type: ticketingType,
      native_ticket_price: nativeTicketPrice,
      native_ticket_capacity: nativeTicketCapacity,
      latitude,
      longitude,
      council_district: councilDistrict,
    },
  };
}

/**
 * Pure validator for a POST /api/telemetry/live-ping body. Mirrors the
 * SDK's ping rules: finite coordinates within geographic bounds and the
 * ON_STAGE status the pasted SDK always sends.
 */
export function validateLivePingPayload(
  input: unknown,
): ValidationResult<ValidLivePingPayload> {
  if (!isRecord(input)) {
    return fail("malformed_body");
  }

  if (!isNonEmptyString(input.artist_id)) {
    return fail("missing_artist_id");
  }

  const latitude = input.latitude;
  const longitude = input.longitude;
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return fail("invalid_coords");
  }

  if (
    input.timestamp === undefined ||
    input.timestamp === null ||
    input.timestamp === ""
  ) {
    return fail("missing_timestamp");
  }
  if (typeof input.timestamp !== "string" || !isParseableDate(input.timestamp)) {
    return fail("invalid_timestamp");
  }

  if (input.status !== "ON_STAGE") {
    return fail("invalid_status");
  }

  return {
    ok: true,
    value: {
      artist_id: input.artist_id.trim(),
      latitude,
      longitude,
      timestamp: new Date(input.timestamp).toISOString(),
      status: "ON_STAGE",
    },
  };
}
