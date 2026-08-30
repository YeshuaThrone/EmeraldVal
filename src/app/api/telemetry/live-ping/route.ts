import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";
import { validateLivePingPayload } from "@/lib/validation";

/**
 * POST /api/telemetry/live-ping — persist an ON_STAGE telemetry ping from
 * the ATXLiveArtistSDK (artist_id, latitude, longitude, timestamp, status).
 * Returns the stored ping (with its generated id) as 201. Requires
 * `Authorization: Bearer <apiKey>` (PR 23): the artist row the key
 * resolves to is stamped onto the stored ping server-side — the payload's
 * artist_id field is informational only, so a client can never go live as
 * someone else.
 * GET /api/telemetry/live-ping — list pings, newest first, capped at the
 * same sane limit as GET /api/shows; the fan map reads this on mount so a
 * GO LIVE ping survives a hard reload. Public by design.
 *
 * Failure paths all return the typed envelope {error, code}:
 * 401 auth (AUTH_REQUIRED without a header, AUTH_INVALID with an unknown
 * key), 400 malformed JSON, 422 validation, 500 store failure.
 */

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request, (hash) =>
    getStore().getArtistByKeyHash(hash),
  );
  if (!auth.ok) {
    const error =
      auth.code === "AUTH_REQUIRED"
        ? "Going live requires an artist key — send 'Authorization: Bearer <apiKey>'."
        : "That artist key doesn't match any registered artist.";
    return jsonError(401, auth.code, error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const result = validateLivePingPayload(body);
  if (!result.ok) {
    return jsonError(422, result.code, result.message);
  }

  try {
    // Server-side identity stamp: the authenticated artist row wins over
    // anything the client asserted in the payload.
    const stored = getStore().insertLivePing({
      ...result.value,
      artist_id: auth.artist.id,
    });
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    console.error("Failed to store live ping:", error);
    return jsonError(500, "store_failure", "Failed to store the live ping.");
  }
}

export async function GET() {
  try {
    const pings = getStore().listLivePings();
    return NextResponse.json(pings);
  } catch (error) {
    console.error("Failed to list live pings:", error);
    return jsonError(500, "store_failure", "Failed to list live pings.");
  }
}
