import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateVaultPayoutPayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { payoutFromVault } from "@/modules/vaults/engine";

/**
 * POST /api/v1/vaults/payout — BaaS settlement from available_balance.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateVaultPayoutPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `vault-payout:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many vault payouts from this address. Try again later.",
    );
  }

  try {
    const store = getStore();
    const vault = store.getVault(parsed.value.payee_id);
    const amountCents =
      parsed.value.amount_cents ?? vault?.available_balance ?? 0;
    const result = await payoutFromVault(store, {
      payee_id: parsed.value.payee_id,
      amount_cents: amountCents,
      rail: parsed.value.rail,
    });
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed vault payout:", error);
    return jsonError(500, "store_failure", "Failed to pay out from the vault.");
  }
}
