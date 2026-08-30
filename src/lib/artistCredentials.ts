import { requestJson } from "@/lib/transport";

/**
 * Client-side artist credential persistence (PR 23 — studio sign-in).
 *
 * The studio's credential model: the API key is minted once at
 * registration, shown exactly once, and then lives in localStorage so the
 * artist stays signed in across reloads. Only the SDK and these helpers
 * touch it; the server never sees it except inside the Bearer header.
 *
 * Every read is validated against GET /api/artists/verify by the caller
 * (the widget's mount effect) — a stale or revoked key is cleared instead
 * of silently failing on the next publish.
 *
 * Framework-agnostic: no React imports; SSR-safe (storage access guarded).
 */

const STORAGE_KEY = "atxlive.artistCredentials";

/** What the studio persists after register/sign-in. */
export type ArtistCredentials = {
  /** The registered artist row id (server-assigned). */
  artistId: string;
  /** Display name from registration. */
  artistName: string;
  /** The full API key — the only copy outside the artist's hands. */
  apiKey: string;
  /** Display prefix, e.g. `atxlive_abc12345` — shown in the UI. */
  keyPrefix: string;
};

/** Runtime guard for whatever JSON sits in localStorage. */
function isArtistCredentials(value: unknown): value is ArtistCredentials {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.artistId === "string" &&
    record.artistId !== "" &&
    typeof record.artistName === "string" &&
    record.artistName !== "" &&
    typeof record.apiKey === "string" &&
    record.apiKey !== "" &&
    typeof record.keyPrefix === "string"
  );
}

/** Reads the stored credential, or null when absent/corrupt. */
export function loadArtistCredentials(): ArtistCredentials | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isArtistCredentials(parsed) ? parsed : null;
  } catch {
    // Corrupt JSON or a blocked storage area is a signed-out state, not a
    // crash — the artist just signs in again.
    return null;
  }
}

/** Persists the credential (called right after register or sign-in). */
export function saveArtistCredentials(credentials: ArtistCredentials): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

/** Clears the stored credential (sign-out, or a failed re-validation). */
export function clearArtistCredentials(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

/** The safe profile GET /api/artists/verify returns for a valid key. */
export type ArtistProfile = {
  id: string;
  artistName: string;
  keyPrefix: string;
};

/**
 * Validates a key against GET /api/artists/verify. Resolves the profile on
 * success and null on any failure (unknown key, network trouble) — the
 * caller renders the distinction; this stays a thin typed wrapper.
 */
export async function verifyArtistKey(
  apiKey: string,
): Promise<ArtistProfile | null> {
  const result = await requestJson("/api/artists/verify", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!result.ok || typeof result.body !== "object" || result.body === null) {
    return null;
  }
  const body = result.body as Record<string, unknown>;
  if (
    typeof body.id !== "string" ||
    typeof body.artistName !== "string" ||
    typeof body.keyPrefix !== "string"
  ) {
    return null;
  }
  return { id: body.id, artistName: body.artistName, keyPrefix: body.keyPrefix };
}

/** Registers a new artist; resolves the one-time key response or null. */
export async function registerArtist(
  artistName: string,
): Promise<ArtistCredentials | null> {
  const result = await requestJson("/api/artists/register", {
    method: "POST",
    body: { artistName },
  });
  if (!result.ok || typeof result.body !== "object" || result.body === null) {
    return null;
  }
  const body = result.body as Record<string, unknown>;
  const candidate = {
    artistId: body.id,
    artistName: body.artistName,
    apiKey: body.apiKey,
    keyPrefix: body.keyPrefix,
  };
  return isArtistCredentials(candidate) ? candidate : null;
}
