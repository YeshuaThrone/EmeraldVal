import { afterEach, describe, expect, it } from "vitest";
import {
  decryptAccessToken,
  encryptAccessToken,
  isEncryptedAccessToken,
  plaidEncryptionKey,
} from "./crypto";

afterEach(() => {
  delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
});

describe("plaid access token encryption", () => {
  it("round-trips a sandbox access token", () => {
    const iv = Buffer.alloc(12, 7);
    const token = encryptAccessToken("access-sandbox-secret", iv);
    expect(isEncryptedAccessToken(token)).toBe(true);
    expect(decryptAccessToken(token)).toBe("access-sandbox-secret");
  });

  it("returns plaintext unchanged when the token is not encrypted", () => {
    expect(decryptAccessToken("access-sandbox-raw")).toBe("access-sandbox-raw");
  });

  it("uses PLAID_TOKEN_ENCRYPTION_KEY when set", () => {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = "custom-key";
    const a = plaidEncryptionKey();
    delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    const b = plaidEncryptionKey();
    expect(a.equals(b)).toBe(false);
  });

  it("treats an empty env key as the sandbox default", () => {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = "  ";
    const a = plaidEncryptionKey();
    delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    expect(a.equals(plaidEncryptionKey())).toBe(true);
  });

  it("encrypts with a random IV by default", () => {
    const token = encryptAccessToken("access-sandbox-secret");
    expect(isEncryptedAccessToken(token)).toBe(true);
    expect(decryptAccessToken(token)).toBe("access-sandbox-secret");
  });
});
