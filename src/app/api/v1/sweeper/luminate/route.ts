import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { clientIdentity } from "@/modules/don/http";
import { getCovenantRegistry } from "@/lib/server/covenantRegistry";
import { CovenantExternalDataIngestionEngine } from "@/covenant-sdk/external-data-connectors";
import type { LuminateConsumptionPayload } from "@/covenant-sdk/external-data-connectors";
import { CovenantMasterEngineFacade } from "@/covenant-sdk/covenant-master-production-sdk";

/**
 * POST /api/v1/sweeper/luminate — normalize Luminate payloads and sweep.
 * Express paste: app.use('/api/v1/sweeper', luminateRoutes)
 * Does not call live Luminate HTTP.
 */

function isPayload(value: unknown): value is LuminateConsumptionPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.luminateId === "string" && typeof row.songTitle === "string";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const verdict = checkRateLimit(
    `covenant-sweeper-luminate:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many Luminate sweeper requests from this address. Try again later.",
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonError(400, "malformed_body", "Request body must be a JSON object.");
  }
  const row = body as Record<string, unknown>;
  if (!Array.isArray(row.payloads)) {
    return jsonError(400, "malformed_body", "payloads must be an array.");
  }
  const payloads = row.payloads.filter(isPayload);
  if (payloads.length === 0) {
    return jsonError(
      400,
      "malformed_body",
      "payloads must include luminateId and songTitle.",
    );
  }

  const rate = row.estimatedPerStreamRateMicros;
  if (
    rate !== undefined &&
    (typeof rate !== "number" || !Number.isSafeInteger(rate) || rate < 0)
  ) {
    return jsonError(
      400,
      "invalid_rate",
      "estimatedPerStreamRateMicros must be a whole number of USD micros.",
    );
  }

  const records = new CovenantExternalDataIngestionEngine().parseLuminateConsumptionData(
    payloads,
    typeof rate === "number" ? rate : undefined,
  );
  const registry = getCovenantRegistry();
  const result = await new CovenantMasterEngineFacade().executeSystemSweep(
    "",
    "",
    registry.listWorks(),
    records,
  );
  registry.recordSweep(result);
  return NextResponse.json({
    ok: true,
    recoveredRevenueCents: result.sweeperSummary.totalRecoveredRevenueCents,
    matchesFound: result.sweeperSummary.matches.length,
    disputes: result.disputesEncountered.length,
    recordsIngested: records.length,
  });
}
