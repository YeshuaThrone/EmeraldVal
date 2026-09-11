import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
import { validateSplitCalculatePayload } from "@/lib/don/validation";

/**
 * POST /api/v1/splits/calculate — UDR split engine.
 *
 * Ingests DSP royalty line items, allocates cents across creators/labels
 * (basis points, remainder on the last party), and writes split_runs /
 * royalty_line_items / ledger_transactions. Optional `settle: true` sends
 * each ledger row through the BaaS adapter (sandbox ACH or RTP).
 *
 * Failure envelope {error, code}: 400 malformed JSON, 422 validation,
 * 429 rate-limited, 500 store failure, plus BaaS 501/503 when settle
 * is requested in live mode without credentials.
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

  const parsed = validateSplitCalculatePayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `udr-split:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many split calculations from this address. Try again later.",
    );
  }

  try {
    const result = await calculateUdrSplits(getStore(), parsed.value);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result.value, { status: 201 });
  } catch (error) {
    console.error("Failed UDR split calculate:", error);
    return jsonError(
      500,
      "store_failure",
      "Failed to calculate and persist UDR splits.",
    );
  }
}
