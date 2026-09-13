import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, DON_API_RATE_LIMIT } from "@/lib/server/rateLimit";
import { clientIdentity } from "@/modules/don/http";
import type { RouteResult } from "@/covenant-sdk/routes/result";

export async function parseJsonRequest(
  request: NextRequest,
): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: jsonError(400, "malformed_body", "Request body must be valid JSON."),
    };
  }
}

export function rejectIfRateLimited(
  request: NextRequest,
  bucketKey: string,
  error: string,
): NextResponse | undefined {
  const verdict = checkRateLimit(
    `${bucketKey}:${clientIdentity(request)}`,
    DON_API_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(429, "rate_limited", error);
  }
  return undefined;
}

export function toNextResponse<T>(result: RouteResult<T>): NextResponse {
  if (!result.ok) {
    return jsonError(result.status, result.code, result.error);
  }
  return NextResponse.json(result.body, { status: result.status });
}
