import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { handlePlaidKyc } from "@/lib/server/plaid";
import { getStore } from "@/lib/server/store";
import { validatePlaidKycPayload } from "@/lib/don/validation";

/**
 * POST /api/v1/auth/plaid-kyc — sandbox Plaid Link tokens + identity KYC.
 *
 * `action: "create_link_token"` mints a Link session (link_token +
 * sandbox public_token) without PLAID_CLIENT_ID / PLAID_SECRET.
 * `action: "verify_identity"` validates an identity payload, optionally
 * bound to those tokens, and persists a kyc_verifications row.
 *
 * Failure envelope {error, code}: 400 malformed JSON, 422 validation /
 * unknown token, 429 rate-limited, 500 store failure.
 */

function clientIdentity(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validatePlaidKycPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `plaid-kyc:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many Plaid KYC requests from this address. Try again later.",
    );
  }

  try {
    const result = handlePlaidKyc(getStore(), parsed.value);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    const created = result.value.action === "create_link_token";
    return NextResponse.json(result.value, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("Failed Plaid KYC:", error);
    return jsonError(500, "store_failure", "Failed to process Plaid KYC.");
  }
}
