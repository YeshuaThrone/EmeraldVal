import { NextRequest } from "next/server";
import { sendPhoneOtp } from "@/covenant-sdk/routes/phone";
import {
  parseJsonRequest,
  rejectIfRateLimited,
  toNextResponse,
} from "@/lib/server/covenantHttp";

/**
 * POST /api/v1/auth/phone/otp — sandbox multi-channel OTP dispatch.
 * Express paste: app.post('/api/v1/auth/phone/otp', phoneRoutes.postOtp)
 *
 * Does not call live WhatsApp Cloud, TextBee, or Supabase.
 */

export async function POST(request: NextRequest) {
  const limited = rejectIfRateLimited(
    request,
    "covenant-phone-otp",
    "Too many OTP sends from this address. Try again later.",
  );
  if (limited) {
    return limited;
  }
  const parsed = await parseJsonRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  return toNextResponse(await sendPhoneOtp(parsed.body));
}
