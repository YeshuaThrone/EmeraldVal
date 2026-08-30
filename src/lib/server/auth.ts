import { hashApiKey, keyMatchesHash } from "@/lib/server/apiKeys";
import type { ArtistRecord } from "@/lib/server/store";

/**
 * Bearer API-key auth for the write endpoints (PR 23 — artist identity).
 *
 * The wire contract: `Authorization: Bearer <atxlive_…>` on every write.
 * The presented key is hashed and looked up against the artists table's
 * key_hash column — the raw key is never stored, so verification is
 * hash-and-lookup, not decrypt-and-compare.
 *
 * The two failure modes are distinct envelope codes so the studio UI can
 * tell "you didn't send a key" (AUTH_REQUIRED — sign in first) from "the
 * key you sent is wrong" (AUTH_INVALID — re-paste or re-register):
 * - No/missing/malformed Authorization header → AUTH_REQUIRED
 * - A well-formed header whose key matches no artist → AUTH_INVALID
 */

export type AuthFailureCode = "AUTH_REQUIRED" | "AUTH_INVALID";

export type AuthResult =
  | { ok: true; artist: ArtistRecord }
  | { ok: false; code: AuthFailureCode };

/** Extracts the Bearer token from the Authorization header, or null. */
export function bearerKeyFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match === null ? null : match[1].trim();
}

/** Resolves a request's Bearer key to its artist row, or a typed failure. */
export function authenticateRequest(
  request: Request,
  getArtistByKeyHash: (keyHash: string) => ArtistRecord | undefined,
): AuthResult {
  const key = bearerKeyFrom(request);
  if (key === null || key === "") {
    return { ok: false, code: "AUTH_REQUIRED" };
  }

  const artist = getArtistByKeyHash(hashApiKey(key));
  if (artist === undefined || !keyMatchesHash(key, artist.key_hash)) {
    return { ok: false, code: "AUTH_INVALID" };
  }
  return { ok: true, artist };
}
