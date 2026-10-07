import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateSplitReversePayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { reverseSplitRun } from "@/modules/ledger/reversal";

/**
 * POST /api/v1/splits/reverse — invert a posted royalty split run.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateSplitReversePayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `split-reverse:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many split reversal requests from this address. Try again later.",
    );
  }

  try {
    const result = reverseSplitRun(getStore(), parsed.value.split_run_id);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    console.error("Failed split reversal:", error);
    return jsonError(500, "store_failure", "Failed to reverse the split run.");
  }
}
