import { describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import { createSandboxLinkToken } from "@/lib/server/plaid";
import { isEncryptedAccessToken } from "./crypto";
import { exchangePlaidPublicToken } from "./exchange";

describe("exchangePlaidPublicToken", () => {
  it("encrypts the access_token and mints a Column processor token", () => {
    const store = new SqliteStore(":memory:");
    const minted = createSandboxLinkToken(store, {
      action: "create_link_token",
      creator_id: "creator-1",
      products: ["auth", "identity"],
    });
    const first = exchangePlaidPublicToken(store, {
      creator_id: "creator-1",
      public_token: minted.value.public_token,
      processor: "column",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(isEncryptedAccessToken(first.value.access_token)).toBe(true);
    expect(first.value.processor_token).toMatch(/^processor-sandbox-column-/);
    expect(first.value.account_id).toMatch(/^acc-sandbox-/);

    const second = exchangePlaidPublicToken(store, {
      creator_id: "creator-1",
      public_token: minted.value.public_token,
      processor: "column",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(second.value.processor_token).toBe(first.value.processor_token);
    expect(second.value.access_token).toBe(first.value.access_token);
  });

  it("defaults the processor to Column when omitted", () => {
    const store = new SqliteStore(":memory:");
    const minted = createSandboxLinkToken(store, {
      action: "create_link_token",
      creator_id: "creator-1",
      products: ["identity"],
    });
    const result = exchangePlaidPublicToken(store, {
      creator_id: "creator-1",
      public_token: minted.value.public_token,
      processor: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.processor).toBe("column");
  });

  it("rejects a mismatched creator_id", () => {
    const store = new SqliteStore(":memory:");
    const minted = createSandboxLinkToken(store, {
      action: "create_link_token",
      creator_id: "creator-1",
      products: ["auth"],
    });
    const result = exchangePlaidPublicToken(store, {
      creator_id: "someone-else",
      public_token: minted.value.public_token,
      processor: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("plaid_token_mismatch");
  });

  it("rejects an unknown or expired public_token", () => {
    const store = new SqliteStore(":memory:");
    expect(
      exchangePlaidPublicToken(store, {
        creator_id: "c1",
        public_token: "public-sandbox-missing",
        processor: "unit",
      }).ok,
    ).toBe(false);

    store.insertPlaidLinkToken({
      creator_id: "c1",
      link_token: "link-sandbox-old",
      public_token: "public-sandbox-old",
      access_token: "access-sandbox-old",
      expiration: "2020-01-01T00:00:00.000Z",
      products: "auth",
    });
    const expired = exchangePlaidPublicToken(
      store,
      {
        creator_id: "c1",
        public_token: "public-sandbox-old",
        processor: "unit",
      },
      new Date("2026-09-10T00:00:00.000Z"),
    );
    expect(expired.ok).toBe(false);
    if (expired.ok) {
      return;
    }
    expect(expired.code).toBe("plaid_token_expired");
  });
});
