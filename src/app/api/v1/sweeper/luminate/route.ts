import { NextRequest } from "next/server";
import {
  parseJsonRequest,
  rejectIfRateLimited,
  toNextResponse,
} from "@/lib/server/covenantHttp";
import { sweepLuminate } from "@/covenant-sdk/routes/luminate";

/**
 * POST /api/v1/sweeper/luminate — normalize Luminate payloads and sweep.
 * Express paste: app.use('/api/v1/sweeper', luminateRoutes)
 */

export async function POST(request: NextRequest) {
  const limited = rejectIfRateLimited(
    request,
    "covenant-sweeper-luminate",
    "Too many Luminate sweeper requests from this address. Try again later.",
  );
  if (limited) {
    return limited;
  }
  const parsed = await parseJsonRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  return toNextResponse(await sweepLuminate(parsed.body));
}
