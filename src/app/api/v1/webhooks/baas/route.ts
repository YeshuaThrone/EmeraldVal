import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateBaasWebhookPayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { ingestBaasWebhook } from "@/modules/webhooks/baas";

/**
 * POST /api/v1/webhooks/baas — sandbox payout callbacks
 * (`payout.settled` | `payout.returned` | `payout.failed`).
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateBaasWebhookPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `baas-webhook:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many webhook ingest requests from this address. Try again later.",
    );
  }

  try {
    const result = ingestBaasWebhook(getStore(), parsed.value);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    console.error("Failed BaaS webhook ingest:", error);
    return jsonError(500, "store_failure", "Failed to ingest BaaS webhook.");
  }
}
