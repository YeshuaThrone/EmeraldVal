import { NextRequest } from "next/server";
import { verifyPhoneOtp } from "@/covenant-sdk/routes/phone";
import {
  parseJsonRequest,
  rejectIfRateLimited,
  toNextResponse,
} from "@/lib/server/covenantHttp";

/**
 * POST /api/v1/auth/phone/verify — sandbox OTP check.
 * Express paste: app.post('/api/v1/auth/phone/verify', phoneRoutes.postVerify)
 *
 * Does not call live WhatsApp Cloud, TextBee, or Supabase.
 */

export async function POST(request: NextRequest) {
  const limited = rejectIfRateLimited(
    request,
    "covenant-phone-verify",
    "Too many OTP verifications from this address. Try again later.",
  );
  if (limited) {
    return limited;
  }
  const parsed = await parseJsonRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  return toNextResponse(await verifyPhoneOtp(parsed.body));
}
