import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";
import { validateShowPayload } from "@/lib/validation";

/**
 * Show persistence endpoints.
 *
 * POST /api/shows — create a show from the ATXLiveArtistSDK wire payload,
 *   returns the stored show (with its generated id) as 201.
 * GET /api/shows — list shows, newest first, capped at a sane limit.
 *
 * Failure paths all return the typed envelope {error, code}:
 * 400 malformed JSON, 422 validation, 500 store failure.
 *
 * NOTE: no auth this PR — PR 23 adds Bearer API-key auth on writes. Until
 * then these endpoints are intentionally open.
 */

export async function POST(request: NextRequest) {
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
    const stored = getStore().insertShow(result.value);
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
