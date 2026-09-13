import { NextRequest } from "next/server";
import {
  parseJsonRequest,
  rejectIfRateLimited,
  toNextResponse,
} from "@/lib/server/covenantHttp";
import { listWorks, registerWork } from "@/covenant-sdk/routes/works";

/**
 * POST /api/v1/works — register a Covenant work manifest.
 * Express paste: app.use('/api/v1/works', workRoutes)
 */

export async function POST(request: NextRequest) {
  const limited = rejectIfRateLimited(
    request,
    "covenant-works",
    "Too many work registrations from this address. Try again later.",
  );
  if (limited) {
    return limited;
  }
  const parsed = await parseJsonRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  return toNextResponse(await registerWork(parsed.body));
}

export async function GET() {
  return toNextResponse(listWorks());
}
