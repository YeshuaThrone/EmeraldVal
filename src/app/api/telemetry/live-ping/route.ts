import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";
import { validateLivePingPayload } from "@/lib/validation";

/**
 * POST /api/telemetry/live-ping — persist an ON_STAGE telemetry ping from
 * the ATXLiveArtistSDK (artist_id, latitude, longitude, timestamp, status).
 * Returns the stored ping (with its generated id) as 201.
 * GET /api/telemetry/live-ping — list pings, newest first, capped at the
 * same sane limit as GET /api/shows; the fan map reads this on mount so a
 * GO LIVE ping survives a hard reload.
 *
 * Failure paths all return the typed envelope {error, code}:
 * 400 malformed JSON, 422 validation, 500 store failure.
 *
 * NOTE: no auth this PR — PR 23 adds Bearer API-key auth on writes. Until
 * then this endpoint is intentionally open.
 */

export async function POST(request: NextRequest) {
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
    const stored = getStore().insertLivePing(result.value);
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
