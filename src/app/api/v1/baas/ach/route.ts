import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";
import { processSandboxRail, readBaasProvider } from "@/services/baas";
import { validateBaasPayoutPayload } from "@/lib/don/validation";

/**
 * POST /api/v1/baas/ach — mock ACH rail.
 *
 * Sandbox stand-in for Column/Unit ACH until production API credentials
 * are issued. Always sandbox (never live), so BAAS_MODE=live does not
 * disable this endpoint. RTP counterpart: POST /api/v1/baas/rtp.
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

  const parsed = validateBaasPayoutPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const verdict = checkRateLimit(
    `baas-ach:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many ACH requests from this address. Try again later.",
    );
  }

  try {
    const result = processSandboxRail(getStore(), {
      ...parsed.value,
      provider: parsed.value.provider ?? readBaasProvider(),
      rail: "ach",
    });
    return NextResponse.json(
      {
        mode: result.mode,
        rail: "ach",
        provider: result.transfer.provider,
        transfer: result.transfer,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed sandbox ACH transfer:", error);
    return jsonError(500, "store_failure", "Failed to record the ACH transfer.");
  }
}
