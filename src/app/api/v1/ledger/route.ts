import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { clientIdentity } from "@/modules/don/http";
import { immutableLedgerLog } from "@/modules/ledger/audit";

/**
 * GET /api/v1/ledger — append-only hash-chained GL log with
 * debit_account / credit_account pairs.
 */

export async function GET(request: NextRequest) {
  const verdict = checkRateLimit(
    `ledger-log:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many ledger log requests from this address. Try again later.",
    );
  }

  try {
    return NextResponse.json(immutableLedgerLog(getStore()));
  } catch (error) {
    console.error("Failed ledger log:", error);
    return jsonError(500, "store_failure", "Failed to read the general ledger.");
  }
}
