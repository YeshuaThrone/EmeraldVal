import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  API_KEY_PREFIX,
  displayPrefix,
  generateApiKey,
  hashApiKey,
  keyMatchesHash,
} from "@/lib/server/apiKeys";

describe("generateApiKey", () => {
  it("mints atxlive_-prefixed keys with 192 bits of entropy", () => {
    const key = generateApiKey();
    expect(key.key.startsWith(API_KEY_PREFIX)).toBe(true);
    // 24 random bytes → 48 hex chars after the prefix.
    expect(key.key).toMatch(/^atxlive_[0-9a-f]{48}$/);
  });

  it("hashes the key with SHA-256 — the stored hash never contains the raw key", () => {
    const { key, hash } = generateApiKey();
    expect(hash).toBe(createHash("sha256").update(key, "utf8").digest("hex"));
    expect(hash).not.toContain(key);
    expect(key).not.toContain(hash);
  });

  it("produces a display prefix that is short and never the full key", () => {
    const { key, prefix } = generateApiKey();
    expect(prefix).toBe(displayPrefix(key));
    expect(prefix.startsWith("atxlive_")).toBe(true);
    expect(prefix.length).toBeLessThan(key.length);
    expect(key.startsWith(prefix)).toBe(true);
  });

  it("generates distinct keys on every call", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().key));
    expect(keys.size).toBe(50);
  });
});

describe("hashApiKey", () => {
  it("is deterministic for the same key", () => {
    expect(hashApiKey("atxlive_abc")).toBe(hashApiKey("atxlive_abc"));
  });

  it("differs for different keys", () => {
    expect(hashApiKey("atxlive_abc")).not.toBe(hashApiKey("atxlive_abd"));
  });
});

describe("keyMatchesHash", () => {
  it("accepts the key that produced the hash", () => {
    const { key, hash } = generateApiKey();
    expect(keyMatchesHash(key, hash)).toBe(true);
  });

  it("rejects a wrong key", () => {
    const { hash } = generateApiKey();
    const other = generateApiKey();
    expect(keyMatchesHash(other.key, hash)).toBe(false);
  });

  it("rejects a malformed stored hash without throwing", () => {
    const { key } = generateApiKey();
    expect(keyMatchesHash(key, "not-a-hash")).toBe(false);
    expect(keyMatchesHash(key, "")).toBe(false);
  });
});
