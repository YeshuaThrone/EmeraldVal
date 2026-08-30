import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Artist API-key generation and verification (PR 23 — artist identity).
 *
 * The credential model (spec, locked decision): register-once API keys that
 * realize the pasted SDK's Bearer-token design. The raw key is shown to the
 * artist exactly once at registration; only a SHA-256 hash and a short
 * display prefix are stored.
 *
 * Why SHA-256 and not scrypt/bcrypt: scrypt-style password hashing exists to
 * slow brute-force against LOW-entropy human passwords. These keys are
 * 192 bits of CSPRNG output (randomBytes) — preimage speed is irrelevant
 * when the keyspace is that large, and a plain fast hash keeps verification
 * a single indexed lookup per request. No new dependencies.
 */

/** Key shape: `atxlive_` + 48 hex chars (192 bits of entropy). */
const KEY_RANDOM_BYTES = 24;
export const API_KEY_PREFIX = "atxlive_";

/** How much of the raw key is safe to keep for display, e.g. `atxlive_abc12345…`. */
const DISPLAY_HEX_CHARS = 8;

/** A freshly generated key plus the values that are safe to persist. */
export type GeneratedApiKey = {
  /** The full key — returned to the artist ONCE, never stored. */
  key: string;
  /** SHA-256 hex digest of the key — the only at-rest credential. */
  hash: string;
  /** Display prefix (first chars of the key), shown in the studio UI. */
  prefix: string;
};

/** Pure: SHA-256 hex digest of a raw key — the at-rest representation. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Generates a new high-entropy key with its hash and display prefix. */
export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString("hex")}`;
  return {
    key,
    hash: hashApiKey(key),
    prefix: displayPrefix(key),
  };
}

/**
 * Pure: the display prefix for a key — `atxlive_` plus the first few random
 * characters, enough for an artist to tell keys apart, useless for auth.
 */
export function displayPrefix(key: string): string {
  return `${API_KEY_PREFIX}${key.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + DISPLAY_HEX_CHARS)}`;
}

/**
 * Constant-time comparison of a presented key against a stored hash.
 * `timingSafeEqual` throws on length mismatch, so lengths are checked first
 * (a length check leaks nothing an attacker cannot already see).
 */
export function keyMatchesHash(key: string, hash: string): boolean {
  const candidate = Buffer.from(hashApiKey(key), "hex");
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(candidate, stored);
}
