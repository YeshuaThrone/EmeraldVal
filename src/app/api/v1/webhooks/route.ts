import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { validateUnifiedWebhookPayload } from "@/lib/don/validation";
import { clientIdentity } from "@/modules/don/http";
import { ingestBaasWebhook } from "@/modules/webhooks/baas";
import { ingestDspWebhook } from "@/modules/webhooks/dsp";

/**
 * POST /api/v1/webhooks — dispatcher for BaaS payout callbacks and
 * DSP royalty reports.
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateUnifiedWebhookPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `webhooks:${clientIdentity(request)}`,
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
    if (parsed.value.kind === "baas") {
      const result = ingestBaasWebhook(getStore(), parsed.value.value);
      if (!result.ok) {
        return jsonError(result.status, result.code, result.message);
      }
      return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
    }
    const result = await ingestDspWebhook(getStore(), parsed.value.value);
    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    console.error("Failed webhook ingest:", error);
    return jsonError(500, "store_failure", "Failed to ingest webhook.");
  }
}
