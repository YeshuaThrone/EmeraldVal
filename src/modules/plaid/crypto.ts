/**
 * Sandbox encryption for Plaid access tokens. AES-256-GCM with a
 * deterministic sandbox key when PLAID_TOKEN_ENCRYPTION_KEY is unset so
 * exchange works without live credentials.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PLAID_TOKEN_ENC_PREFIX } from "@/modules/don/constants";

const SANDBOX_KEY_MATERIAL = "don-engine-sandbox-plaid-token-key";

export function plaidEncryptionKey(): Buffer {
  const fromEnv = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  const material =
    typeof fromEnv === "string" && fromEnv.trim() !== ""
      ? fromEnv.trim()
      : SANDBOX_KEY_MATERIAL;
  return createHash("sha256").update(material).digest();
}

export function isEncryptedAccessToken(token: string): boolean {
  return token.startsWith(PLAID_TOKEN_ENC_PREFIX);
}

export function encryptAccessToken(
  plaintext: string,
  iv: Buffer = randomBytes(12),
): string {
  const cipher = createCipheriv("aes-256-gcm", plaidEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PLAID_TOKEN_ENC_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptAccessToken(token: string): string {
  if (!isEncryptedAccessToken(token)) {
    return token;
  }
  const payload = token.slice(PLAID_TOKEN_ENC_PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    plaidEncryptionKey(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
