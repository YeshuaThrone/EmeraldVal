import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { clientIdentity } from "@/modules/don/http";
import { auditLedger } from "@/modules/ledger/audit";

/**
 * GET /api/v1/ledger/audit — double-entry invariant plus FBO vs vault
 * balance sheet.
 */

export async function GET(request: NextRequest) {
  const verdict = checkRateLimit(
    `ledger-audit:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many ledger audit requests from this address. Try again later.",
    );
  }

  try {
    return NextResponse.json(auditLedger(getStore()));
  } catch (error) {
    console.error("Failed ledger audit:", error);
    return jsonError(500, "store_failure", "Failed to audit the general ledger.");
  }
}
