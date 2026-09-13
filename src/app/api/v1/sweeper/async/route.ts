import { NextRequest } from "next/server";
import {
  parseJsonRequest,
  rejectIfRateLimited,
  toNextResponse,
} from "@/lib/server/covenantHttp";
import { sweepAsync } from "@/covenant-sdk/routes/sweep-async";

/**
 * POST /api/v1/sweeper/async — enqueue then drain the sandbox sweep queue.
 * Express paste: app.use('/api/v1/sweeper', sweepAsyncRoutes)
 */

export async function POST(request: NextRequest) {
  const limited = rejectIfRateLimited(
    request,
    "covenant-sweeper-async",
    "Too many async sweeper requests from this address. Try again later.",
  );
  if (limited) {
    return limited;
  }
  const parsed = await parseJsonRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  return toNextResponse(await sweepAsync(parsed.body));
}
