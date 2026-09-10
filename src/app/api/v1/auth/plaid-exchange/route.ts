import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validatePlaidExchangePayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { exchangePlaidPublicToken } from "@/modules/plaid/exchange";

/**
 * POST /api/v1/auth/plaid-exchange — swap a sandbox public_token for an
 * encrypted access_token and mint a Column/Unit processor token.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validatePlaidExchangePayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `plaid-exchange:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many Plaid exchange requests from this address. Try again later.",
    );
  }

  try {
    const result = exchangePlaidPublicToken(getStore(), parsed.value);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result.value, { status: 201 });
  } catch (error) {
    console.error("Failed Plaid exchange:", error);
    return jsonError(500, "store_failure", "Failed to exchange the Plaid token.");
  }
}
