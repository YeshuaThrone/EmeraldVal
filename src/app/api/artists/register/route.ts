import { NextRequest, NextResponse } from "next/server";
import { generateApiKey } from "@/lib/server/apiKeys";
import { checkRateLimit, REGISTER_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";

/**
 * POST /api/artists/register — the PR 23 credential mint.
 *
 * Body: `{ artistName }`. Creates a new artist row (names are NOT unique —
 * every registration is a distinct identity with its own key) and returns
 * the full API key exactly once: `{ id, artistName, apiKey, keyPrefix }`.
 * At rest only the SHA-256 hash and the display prefix survive — the raw
 * key cannot be recovered later, which is why the studio shows the
 * "store it now, we show it once" warning.
 *
 * Failure paths all return the typed envelope {error, code}:
 * 400 malformed JSON, 422 invalid name, 429 rate-limited, 500 store failure.
 *
 * Rate limiting is a light in-memory fixed window (10 registrations per
 * 10 minutes per client IP) — it resets on server restart and does not
 * share state across serverless instances (see src/lib/server/rateLimit.ts).
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const artistName =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { artistName?: unknown }).artistName === "string"
      ? (body as { artistName: string }).artistName.trim()
      : "";
  if (artistName === "") {
    return jsonError(
      422,
      "invalid_artist_name",
      "artistName is required and must be a non-empty string.",
    );
  }

  const identity =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const verdict = checkRateLimit(`register:${identity}`, REGISTER_RATE_LIMIT);
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many registrations from this address. Try again later.",
    );
  }

  try {
    const key = generateApiKey();
    const artist = getStore().insertArtist(artistName, key.hash, key.prefix);
    return NextResponse.json(
      {
        id: artist.id,
        artistName: artist.name,
        keyPrefix: artist.key_prefix,
        // The one time the full key leaves the server.
        apiKey: key.key,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to register artist:", error);
    return jsonError(500, "store_failure", "Failed to register the artist.");
  }
}
