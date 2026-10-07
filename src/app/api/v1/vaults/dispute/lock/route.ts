import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateDisputeLockPayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { applyDisputeLock } from "@/modules/vaults/dispute";

/**
 * POST /api/v1/vaults/dispute/lock — freeze payouts, lock a catalog
 * work_id so incoming auto-splits credit reserve_balance, and move
 * line-item funds into reserve for an active split dispute.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateDisputeLockPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `dispute-lock:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many dispute lock requests from this address. Try again later.",
    );
  }

  try {
    const result = applyDisputeLock(getStore(), parsed.value);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed dispute lock:", error);
    return jsonError(500, "store_failure", "Failed to toggle the dispute lock.");
  }
}
