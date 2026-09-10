/**
 * Sandbox Plaid Auth & Identity. Mints Link tokens and verifies identity
 * payloads without PLAID_CLIENT_ID / PLAID_SECRET. Live Plaid is gated the
 * same way checkout gates Stripe: keys present does not fake a live call;
 * this module stays sandbox until an explicit live adapter lands.
 *
 * Sandbox fail fixtures (Plaid-style canned users):
 *  - legal_name matching /FAIL/i
 *  - ssn_last_4 === "0000"
 */

import { randomUUID } from "node:crypto";
import type { Store } from "@/lib/server/store";
import type {
  CreateLinkTokenInput,
  KycIdentityPayload,
  KycVerificationRecord,
  PlaidLinkTokenRecord,
  VerifyIdentityInput,
} from "@/lib/don/types";

export const PLAID_LINK_TTL_MS = 4 * 60 * 60 * 1000;

export type PlaidKycFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type LinkTokenSuccess = {
  ok: true;
  value: {
    mode: "sandbox";
    action: "create_link_token";
    creator_id: string;
    link_token: string;
    public_token: string;
    expiration: string;
    products: string[];
    request_id: string;
  };
};

export type VerifyIdentitySuccess = {
  ok: true;
  value: {
    mode: "sandbox";
    action: "verify_identity";
    kyc: {
      id: string;
      creator_id: string;
      status: KycVerificationRecord["status"];
      failure_reason: string | null;
      identity: KycIdentityPayload;
      verified_at: string | null;
      created_at: string;
    };
    plaid: {
      link_token: string | null;
      item_id: string;
    };
  };
};

export type PlaidKycResult = LinkTokenSuccess | VerifyIdentitySuccess | PlaidKycFailure;

function mintToken(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function sandboxKycDecision(identity: KycIdentityPayload): {
  status: "verified" | "failed";
  failure_reason: string | null;
} {
  if (/fail/i.test(identity.legal_name)) {
    return {
      status: "failed",
      failure_reason: "Sandbox fixture: legal_name requested a failed KYC.",
    };
  }
  if (identity.ssn_last_4 === "0000") {
    return {
      status: "failed",
      failure_reason: "Sandbox fixture: ssn_last_4 0000 is a failed identity.",
    };
  }
  return { status: "verified", failure_reason: null };
}

export function isPlaidLiveConfigured(): boolean {
  const id = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  return (
    typeof id === "string" &&
    id.trim() !== "" &&
    typeof secret === "string" &&
    secret.trim() !== ""
  );
}

export function createSandboxLinkToken(
  store: Store,
  input: CreateLinkTokenInput,
  now: Date = new Date(),
): LinkTokenSuccess {
  const expiration = new Date(now.getTime() + PLAID_LINK_TTL_MS).toISOString();
  const record = store.insertPlaidLinkToken({
    creator_id: input.creator_id,
    link_token: mintToken("link-sandbox"),
    public_token: mintToken("public-sandbox"),
    access_token: mintToken("access-sandbox"),
    expiration,
    products: input.products.join(","),
  });
  return {
    ok: true,
    value: {
      mode: "sandbox",
      action: "create_link_token",
      creator_id: record.creator_id,
      link_token: record.link_token,
      // Sandbox-only: returned so a client can verify without a live Link UI.
      public_token: record.public_token,
      expiration: record.expiration,
      products: input.products,
      request_id: `req_${record.id}`,
    },
  };
}

function resolveLinkSession(
  store: Store,
  input: VerifyIdentityInput,
  now: Date,
): { ok: true; session: PlaidLinkTokenRecord | null } | PlaidKycFailure {
  if (input.public_token) {
    const session = store.getPlaidLinkTokenByPublicToken(input.public_token);
    if (session === undefined) {
      return {
        ok: false,
        status: 422,
        code: "unknown_plaid_token",
        message: "public_token does not match a sandbox Link session.",
      };
    }
    if (session.creator_id !== input.creator_id) {
      return {
        ok: false,
        status: 422,
        code: "plaid_token_mismatch",
        message: "public_token does not belong to this creator_id.",
      };
    }
    if (new Date(session.expiration).getTime() < now.getTime()) {
      return {
        ok: false,
        status: 422,
        code: "plaid_token_expired",
        message: "The Plaid Link token has expired. Create a new one.",
      };
    }
    return { ok: true, session };
  }
  if (input.link_token) {
    const session = store.getPlaidLinkTokenByLinkToken(input.link_token);
    if (session === undefined) {
      return {
        ok: false,
        status: 422,
        code: "unknown_plaid_token",
        message: "link_token does not match a sandbox Link session.",
      };
    }
    if (session.creator_id !== input.creator_id) {
      return {
        ok: false,
        status: 422,
        code: "plaid_token_mismatch",
        message: "link_token does not belong to this creator_id.",
      };
    }
    if (new Date(session.expiration).getTime() < now.getTime()) {
      return {
        ok: false,
        status: 422,
        code: "plaid_token_expired",
        message: "The Plaid Link token has expired. Create a new one.",
      };
    }
    return { ok: true, session };
  }
  return { ok: true, session: null };
}

export function verifySandboxIdentity(
  store: Store,
  input: VerifyIdentityInput,
  now: Date = new Date(),
): VerifyIdentitySuccess | PlaidKycFailure {
  const resolved = resolveLinkSession(store, input, now);
  if (!resolved.ok) {
    return resolved;
  }
  const decision = sandboxKycDecision(input.identity);
  const createdAt = now.toISOString();
  const verifiedAt = decision.status === "verified" ? createdAt : null;
  const stored = store.insertKycVerification({
    creator_id: input.creator_id,
    plaid_link_token: resolved.session?.link_token ?? input.link_token,
    plaid_public_token: resolved.session?.public_token ?? input.public_token,
    status: decision.status,
    identity_json: JSON.stringify(input.identity),
    failure_reason: decision.failure_reason,
    created_at: createdAt,
    verified_at: verifiedAt,
  });
  return {
    ok: true,
    value: {
      mode: "sandbox",
      action: "verify_identity",
      kyc: {
        id: stored.id,
        creator_id: stored.creator_id,
        status: stored.status,
        failure_reason: stored.failure_reason,
        identity: input.identity,
        verified_at: stored.verified_at,
        created_at: stored.created_at,
      },
      plaid: {
        link_token: stored.plaid_link_token,
        item_id: resolved.session?.id ?? `item-sandbox-${stored.id}`,
      },
    },
  };
}

export function handlePlaidKyc(
  store: Store,
  input: CreateLinkTokenInput | VerifyIdentityInput,
  now: Date = new Date(),
): PlaidKycResult {
  if (input.action === "create_link_token") {
    return createSandboxLinkToken(store, input, now);
  }
  return verifySandboxIdentity(store, input, now);
}
