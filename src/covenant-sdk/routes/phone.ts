import { getCovenantAuthSdk } from "@/lib/server/covenantPhone";
import type {
  SendOtpSuccess,
  VerifyOtpSuccess,
} from "../phone/verification-sdk";
import { fail, ok, type RouteResult } from "./result";

function statusFor(code: string): number {
  if (code === "malformed_body") {
    return 400;
  }
  if (code === "challenge_not_found") {
    return 404;
  }
  if (code === "delivery_failed") {
    return 503;
  }
  return 422;
}

/**
 * Express paste:
 *   app.post('/api/v1/auth/phone/otp', ...)
 *   app.post('/api/v1/auth/phone/verify', ...)
 */
export async function sendPhoneOtp(
  body: unknown,
): Promise<RouteResult<SendOtpSuccess>> {
  const result = await getCovenantAuthSdk().sendOtp(body);
  if (!result.ok) {
    return fail(statusFor(result.code), result.code, result.message);
  }
  return ok(result, 201);
}

export async function verifyPhoneOtp(
  body: unknown,
): Promise<RouteResult<VerifyOtpSuccess>> {
  const result = await getCovenantAuthSdk().verifyOtp(body);
  if (!result.ok) {
    return fail(statusFor(result.code), result.code, result.message);
  }
  return ok(result, 200);
}

const phoneRoutes = {
  postOtp: sendPhoneOtp,
  postVerify: verifyPhoneOtp,
};

export default phoneRoutes;
