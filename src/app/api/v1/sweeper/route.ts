import { NextRequest } from "next/server";
import {
  parseJsonRequest,
  rejectIfRateLimited,
  toNextResponse,
} from "@/lib/server/covenantHttp";
import { sweepDirect } from "@/covenant-sdk/routes/sweep-direct";

/**
 * POST /api/v1/sweeper — direct CWR/DSR black-box sweep.
 * Express paste: app.use('/api/v1/sweeper', sweepDirectRoutes)
 */

export async function POST(request: NextRequest) {
  const limited = rejectIfRateLimited(
    request,
    "covenant-sweeper",
    "Too many sweeper requests from this address. Try again later.",
  );
  if (limited) {
    return limited;
  }
  const parsed = await parseJsonRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  return toNextResponse(await sweepDirect(parsed.body));
}
