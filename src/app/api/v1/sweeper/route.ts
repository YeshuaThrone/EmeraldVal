import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { clientIdentity } from "@/modules/don/http";
import { processSweepJob } from "@/queues/sweepQueue";

/**
 * POST /api/v1/sweeper — direct (synchronous) CWR/DSR black-box sweep.
 * Express paste: app.use('/api/v1/sweeper', sweepDirectRoutes)
 */

function feedOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const verdict = checkRateLimit(
    `covenant-sweeper:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many sweeper requests from this address. Try again later.",
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonError(400, "malformed_body", "Request body must be a JSON object.");
  }
  const row = body as Record<string, unknown>;
  const cwrRawFeed = feedOf(row.cwrRawFeed);
  const dsrRawFeed = feedOf(row.dsrRawFeed);
  if (cwrRawFeed.trim() === "" && dsrRawFeed.trim() === "") {
    return jsonError(
      400,
      "missing_feed",
      "Provide cwrRawFeed and/or dsrRawFeed.",
    );
  }

  const jobId = typeof row.jobId === "string" ? row.jobId : "sweep_direct";
  const processed = await processSweepJob({
    jobId,
    cwrRawFeed,
    dsrRawFeed,
  });
  if (!processed.ok) {
    return jsonError(500, processed.code, processed.message);
  }
  return NextResponse.json({
    ok: true,
    jobId: processed.jobId,
    recoveredRevenueCents: processed.recoveredRevenueCents,
    matchesFound: processed.matchesFound,
    disputes: processed.disputes,
  });
}
