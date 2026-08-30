import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";
import { validateShowPayload } from "@/lib/validation";

/**
 * Show persistence endpoints.
 *
 * POST /api/shows — create a show from the ATXLiveArtistSDK wire payload,
 *   returns the stored show (with its generated id) as 201. Requires
 *   `Authorization: Bearer <apiKey>` (PR 23): the artist row the key
 *   resolves to is stamped onto the stored show server-side — the
 *   payload's artist_id/artist_name fields are informational only, so a
 *   client can never publish as someone else.
 * GET /api/shows — list shows, newest first, capped at a sane limit.
 *   Public by design: the fan map hydrates from it without credentials.
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
        ? "Publishing requires an artist key — send 'Authorization: Bearer <apiKey>'."
        : "That artist key doesn't match any registered artist.";
    return jsonError(401, auth.code, error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const result = validateShowPayload(body);
  if (!result.ok) {
    return jsonError(422, result.code, result.message);
  }

  try {
    // Server-side identity stamp: the authenticated artist row wins over
    // anything the client asserted in the payload.
    const stored = getStore().insertShow({
      ...result.value,
      artist_id: auth.artist.id,
      artist_name: auth.artist.name,
    });
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    console.error("Failed to store show:", error);
    return jsonError(500, "store_failure", "Failed to store the show.");
  }
}

export async function GET() {
  try {
    const shows = getStore().listShows();
    return NextResponse.json(shows);
  } catch (error) {
    console.error("Failed to list shows:", error);
    return jsonError(500, "store_failure", "Failed to list shows.");
  }
}
