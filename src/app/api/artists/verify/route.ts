import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";

/**
 * GET /api/artists/verify — the studio's sign-in check (PR 23).
 *
 * A lightweight "who am I" endpoint: presents `Authorization: Bearer <key>`
 * and, when the key resolves to an artist, returns the safe profile —
 * `{ id, artistName, keyPrefix }`, never the raw key (the server cannot
 * reproduce it anyway). The studio uses this to validate a pasted key at
 * sign-in and to re-validate the localStorage credential on mount.
 *
 * Failure paths return the typed envelope {error, code}:
 * 401 AUTH_REQUIRED (no/malformed header) or AUTH_INVALID (unknown key).
 */
export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request, (hash) =>
    getStore().getArtistByKeyHash(hash),
  );
  if (!auth.ok) {
    const error =
      auth.code === "AUTH_REQUIRED"
        ? "Missing Authorization header — send 'Authorization: Bearer <apiKey>'."
        : "That artist key doesn't match any registered artist.";
    return jsonError(401, auth.code, error);
  }

  return NextResponse.json({
    id: auth.artist.id,
    artistName: auth.artist.name,
    keyPrefix: auth.artist.key_prefix,
  });
}
