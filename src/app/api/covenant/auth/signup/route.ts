import { NextRequest, NextResponse } from "next/server";
import { validateCovenantSignupPayload } from "@/lib/covenant/signupValidation";
import { registerCovenantCreator } from "@/lib/server/covenantSignup";
import { jsonError } from "@/lib/server/http";
import { checkRateLimit, REGISTER_RATE_LIMIT } from "@/lib/server/rateLimit";
import {
  createAdminClient,
  createAuthClient,
  readSupabaseEnv,
} from "@/lib/server/supabase";

/**
 * POST /api/covenant/auth/signup — Covnant creator registration.
 *
 * 1. Validate the JSON body (stage/legal name, email, optional E.164 phone,
 *    industry, title, password ≥ 8, udr_terms_accepted === true).
 * 2. supabase.auth.signUp hashes the password into auth.users and sends
 *    the native confirmation email.
 * 3. Insert creator_profiles with phone_verified_at = null. If that write
 *    fails, the Auth user is deleted so credentials are not orphaned.
 * 4. 201 { success, session, user, profile }. session is null when Confirm
 *    email is enabled (the usual production setting).
 */

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "malformed_body", "Request body must be valid JSON.");
  }

  const parsed = validateCovenantSignupPayload(body);
  if (!parsed.ok) {
    const status = parsed.code === "malformed_body" ? 400 : 422;
    return jsonError(status, parsed.code, parsed.message);
  }

  const identity =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const verdict = checkRateLimit(
    `covenant-signup:${identity}`,
    REGISTER_RATE_LIMIT,
  );
  if (!verdict.ok) {
    return jsonError(
      429,
      "rate_limited",
      "Too many registrations from this address. Try again later.",
    );
  }

  const env = readSupabaseEnv();
  if (env === null) {
    return jsonError(
      503,
      "supabase_not_configured",
      "Supabase credentials are not configured.",
    );
  }

  const result = await registerCovenantCreator(parsed.value, {
    auth: createAuthClient(env),
    admin: createAdminClient(env),
  });

  if (!result.ok) {
    return jsonError(result.status, result.code, result.message);
  }

  return NextResponse.json(result.value, { status: 201 });
}
