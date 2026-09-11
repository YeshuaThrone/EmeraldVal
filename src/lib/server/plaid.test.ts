import { describe, expect, it } from "vitest";
import {
  createSandboxLinkToken,
  handlePlaidKyc,
  sandboxKycDecision,
  verifySandboxIdentity,
} from "@/lib/server/plaid";
import { SqliteStore } from "@/lib/server/store";

const IDENTITY = {
  legal_name: "Yeshua Throne",
  date_of_birth: "1990-01-15",
  email: "yeshua@example.com",
  phone: "+15125551234",
  ssn_last_4: "6789",
  address: {
    street: "123 Congress Ave",
    city: "Austin",
    region: "TX",
    postal_code: "78701",
    country: "US",
  },
};

describe("sandboxKycDecision", () => {
  it("verifies a clean identity", () => {
    expect(sandboxKycDecision(IDENTITY)).toEqual({
      status: "verified",
      failure_reason: null,
    });
  });

  it("fails the FAIL name fixture", () => {
    expect(
      sandboxKycDecision({ ...IDENTITY, legal_name: "SANDBOX FAIL" }).status,
    ).toBe("failed");
  });

  it("fails ssn_last_4 0000", () => {
    expect(sandboxKycDecision({ ...IDENTITY, ssn_last_4: "0000" }).status).toBe(
      "failed",
    );
  });
});

describe("handlePlaidKyc", () => {
  it("mints a Link session and verifies against the public_token", () => {
    const store = new SqliteStore(":memory:");
    const minted = createSandboxLinkToken(store, {
      action: "create_link_token",
      creator_id: "creator-1",
      products: ["auth", "identity"],
    });
    expect(minted.value.link_token).toMatch(/^link-sandbox-/);
    expect(minted.value.public_token).toMatch(/^public-sandbox-/);

    const verified = verifySandboxIdentity(store, {
      action: "verify_identity",
      creator_id: "creator-1",
      public_token: minted.value.public_token,
      link_token: null,
      identity: IDENTITY,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      return;
    }
    expect(verified.value.kyc.status).toBe("verified");
    expect(store.listKycVerificationsByCreator("creator-1")).toHaveLength(1);
  });

  it("rejects a public_token for a different creator", () => {
    const store = new SqliteStore(":memory:");
    const minted = createSandboxLinkToken(store, {
      action: "create_link_token",
      creator_id: "creator-1",
      products: ["auth"],
    });
    const result = handlePlaidKyc(store, {
      action: "verify_identity",
      creator_id: "creator-2",
      public_token: minted.value.public_token,
      link_token: null,
      identity: IDENTITY,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("plaid_token_mismatch");
  });

  it("allows verify_identity without a prior Link session", () => {
    const store = new SqliteStore(":memory:");
    const result = verifySandboxIdentity(store, {
      action: "verify_identity",
      creator_id: "creator-1",
      public_token: null,
      link_token: null,
      identity: IDENTITY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.kyc.status).toBe("verified");
  });
});
