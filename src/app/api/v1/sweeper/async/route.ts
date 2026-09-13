import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { clientIdentity } from "@/modules/don/http";
import { sweepQueue } from "@/queues/sweepQueue";

/**
 * POST /api/v1/sweeper/async — enqueue then drain the sandbox sweep queue.
 * Express paste: app.use('/api/v1/sweeper', sweepAsyncRoutes)
 * No Redis/BullMQ; drain is process-local.
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
    `covenant-sweeper-async:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many async sweeper requests from this address. Try again later.",
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

  const queued = await sweepQueue.add("blackbox-sweeps", {
    jobId: typeof row.jobId === "string" ? row.jobId : "",
    cwrRawFeed,
    dsrRawFeed,
  });
  const drained = await sweepQueue.drain();
  const processed = drained[0];
  if (!processed || !processed.ok) {
    return jsonError(
      500,
      processed && !processed.ok ? processed.code : "sweep_failed",
      processed && !processed.ok ? processed.message : "Queue drain returned no job.",
    );
  }
  return NextResponse.json(
    {
      ok: true,
      jobId: queued.id,
      status: "drained",
      recoveredRevenueCents: processed.recoveredRevenueCents,
      matchesFound: processed.matchesFound,
      disputes: processed.disputes,
    },
    { status: 202 },
  );
}
