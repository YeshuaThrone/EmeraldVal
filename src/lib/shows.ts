import type { ArtistPinStatus, ArtistShowPin } from "@/lib/artistSdk";
import { districtForPoint } from "@/lib/district";
import type { District, Ticketing } from "@/lib/types";
import { requestJson } from "@/lib/transport";
import type { ValidLivePingPayload, ValidShowPayload } from "@/lib/validation";

/**
 * Server-show hydration for the fan map (PR 22 map persistence).
 *
 * The map mounts with its seed pins; this module fetches what the artists
 * published — GET /api/shows plus GET /api/telemetry/live-ping — and turns
 * the stored records back into artist pins with the exact styling fields
 * the studio's pins carry (electric-blue accent via `source: "artist"`,
 * council-district metadata, ticketing data). Published shows and GO LIVE
 * pings therefore survive a hard reload.
 *
 * The converters are pure and unit-tested; `fetchServerPins` is the only
 * network touchpoint and never throws — the map renders its seed pins and
 * a quiet notice when either endpoint fails.
 *
 * Framework-agnostic: no React imports. LiveMapApp calls `fetchServerPins`
 * on mount and mirrors the result into the pin store.
 */

/** A stored show as GET /api/shows returns it — the payload plus its id. */
export type StoredShow = ValidShowPayload & { id: string };

/** A stored live ping as GET /api/telemetry/live-ping returns it. */
export type StoredLivePing = ValidLivePingPayload & { id: string };

/**
 * Reconstructs the ticketing union from the stored wire fields — the exact
 * inverse of the SDK's payload builder. An external record with an empty
 * URL means "no link" (the field was cleared before publish).
 */
function ticketingFromRecord(record: {
  ticketing_type: "external" | "native" | "";
  ticket_url: string;
  native_ticket_price: number | null;
  native_ticket_capacity: number | null;
}): Ticketing | undefined {
  if (record.ticketing_type === "native") {
    if (
      record.native_ticket_price === null ||
      record.native_ticket_capacity === null
    ) {
      // Native rows always carry both values (validator-enforced); a null
      // here would mean a hand-edited database — treat as no ticketing.
      return undefined;
    }
    return {
      type: "native",
      price: record.native_ticket_price,
      capacity: record.native_ticket_capacity,
    };
  }
  if (record.ticketing_type === "external") {
    return { type: "external", ticketUrl: record.ticket_url };
  }
  return undefined;
}

/**
 * Converts a stored show into the artist pin the studio would have created
 * — same styling fields as PR #18/#20. The pin keeps the server id so a
 * reload restores the identical pin identity. The district is re-classified
 * from the stored point (the same rule the SDK used at upload time), with
 * the user-selected bucket as the out-of-bounds fallback.
 */
export function showRecordToPin(record: StoredShow): ArtistShowPin | null {
  // Shows uploaded before PR 22 carry no coordinates — there is no honest
  // place to put the pin, so hydration skips it rather than guessing.
  if (record.latitude === null || record.longitude === null) {
    return null;
  }

  const ticketing = ticketingFromRecord(record);
  const classified = districtForPoint(record.latitude, record.longitude);

  return {
    id: record.id,
    lat: record.latitude,
    lng: record.longitude,
    performerName: record.artist_name,
    locationName: record.address !== "" ? record.address : record.venue_name,
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "artist",
    district: (classified ?? record.district) as District,
    artistId: record.artist_id,
    status: "SCHEDULED",
    setTime: record.set_time,
    ...(record.ticket_url !== "" ? { ticketUrl: record.ticket_url } : {}),
    artistName: record.artist_name,
    ...(record.council_district !== ""
      ? { councilDistrict: record.council_district }
      : {}),
    ...(ticketing !== undefined ? { ticketing } : {}),
  };
}

/**
 * Converts a stored ping into the ON_STAGE pin the SDK creates when an
 * artist goes live without a published show — same fallback naming and
 * district classification as `triggerLivePing`.
 */
export function pingRecordToPin(record: StoredLivePing): ArtistShowPin {
  return {
    id: record.id,
    lat: record.latitude,
    lng: record.longitude,
    performerName: record.artist_id,
    locationName: `Live position (${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)})`,
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "artist",
    district: districtForPoint(record.latitude, record.longitude),
    artistId: record.artist_id,
    status: "ON_STAGE",
    setTime: record.timestamp,
  };
}

/**
 * Pure hydration merge: shows become SCHEDULED pins, then pings restore the
 * live state. A ping for an artist with a hydrated show flips that artist's
 * most recent show pin ON_STAGE — the same thing `triggerLivePing` did in
 * session — instead of adding a second pin; repeated pings for an artist
 * collapse into one live pin, matching the in-session behavior too.
 *
 * `pings` must be newest first (the API's order) so the most recent show is
 * the one flipped.
 */
export function hydrateServerPins(
  shows: StoredShow[],
  pings: StoredLivePing[],
): ArtistShowPin[] {
  const pins: ArtistShowPin[] = [];
  for (const record of shows) {
    const pin = showRecordToPin(record);
    if (pin !== null) {
      pins.push(pin);
    }
  }

  const liveArtists = new Set<string>();
  for (const ping of pings) {
    if (liveArtists.has(ping.artist_id)) {
      continue;
    }
    liveArtists.add(ping.artist_id);
    const showPin = pins.find((pin) => pin.artistId === ping.artist_id);
    if (showPin) {
      showPin.status = "ON_STAGE" satisfies ArtistPinStatus;
      continue;
    }
    pins.push(pingRecordToPin(ping));
  }

  return pins;
}

export type FetchServerPinsResult =
  | { ok: true; pins: ArtistShowPin[] }
  | { ok: false; error: string };

/**
 * Fetches both show and ping records and hydrates them into artist pins.
 * All-or-nothing: if either endpoint fails, nothing is hydrated and the
 * caller shows its quiet notice — a half-restored map is harder to reason
 * about than a clearly-failed one.
 */
export async function fetchServerPins(): Promise<FetchServerPinsResult> {
  const [showsResult, pingsResult] = await Promise.all([
    requestJson("/api/shows"),
    requestJson("/api/telemetry/live-ping"),
  ]);

  if (!showsResult.ok) {
    return { ok: false, error: showsResult.error };
  }
  if (!pingsResult.ok) {
    return { ok: false, error: pingsResult.error };
  }
  if (!Array.isArray(showsResult.body) || !Array.isArray(pingsResult.body)) {
    return { ok: false, error: "Server returned an unexpected response." };
  }

  // The endpoints return stored records; records missing the id (or with a
  // non-string one) are skipped rather than crashing the map.
  const shows = showsResult.body.filter(
    (record): record is StoredShow =>
      typeof record === "object" &&
      record !== null &&
      typeof (record as { id?: unknown }).id === "string",
  );
  const pings = pingsResult.body.filter(
    (record): record is StoredLivePing =>
      typeof record === "object" &&
      record !== null &&
      typeof (record as { id?: unknown }).id === "string",
  );

  return { ok: true, pins: hydrateServerPins(shows, pings) };
}
