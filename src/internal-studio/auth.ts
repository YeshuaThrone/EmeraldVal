import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isInternalStudioStaff,
  resolveStudioStaff,
} from "./config/staffAllowlist";
import {
  getStudioStaffSecret,
  getSupabaseJwtSecret,
} from "./config/obviousKeys";
import {
  isInternalStudioRole,
  type InternalStudioRole,
} from "./config/studioRoles";

export interface StudioAuthOk {
  ok: true;
  email: string;
  role: InternalStudioRole;
}

export interface StudioAuthDenied {
  ok: false;
  status: 401 | 403;
  error: string;
}

export type StudioAuthResult = StudioAuthOk | StudioAuthDenied;

export const STUDIO_SESSION_COOKIE = "studio_session";
export const STUDIO_SESSION_MAX_AGE_SEC = 60 * 60 * 24;

export function signHs256Jwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function readCookie(headers: Headers, name: string): string | undefined {
  const raw = headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

export function signStudioSession(
  session: { email: string; role: InternalStudioRole },
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = getSupabaseJwtSecret(env) || getStudioStaffSecret(env);
  if (!secret) {
    throw new Error("Studio session secret is not configured");
  }
  return signHs256Jwt(
    {
      email: session.email,
      studio_role: session.role,
      exp: Math.floor(Date.now() / 1000) + STUDIO_SESSION_MAX_AGE_SEC,
    },
    secret,
  );
}

export function studioSessionCookie(token: string, maxAge = STUDIO_SESSION_MAX_AGE_SEC): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STUDIO_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function headerValue(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined;
}

function readClaim(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  if (typeof payload[key] === "string") return payload[key];
  const meta = payload.user_metadata;
  if (meta && typeof meta === "object" && typeof (meta as Record<string, unknown>)[key] === "string") {
    return (meta as Record<string, unknown>)[key] as string;
  }
  const app = payload.app_metadata;
  if (app && typeof app === "object" && typeof (app as Record<string, unknown>)[key] === "string") {
    return (app as Record<string, unknown>)[key] as string;
  }
  return undefined;
}

export function verifyHs256Jwt(
  token: string,
  secret: string,
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !secret) return null;
  const [header, body, signature] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature!, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function assertStudioStaff(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): StudioAuthResult {
  const secret = getStudioStaffSecret(env);
  if (!secret) {
    return {
      ok: false,
      status: 403,
      error: "AnimationStudioOS is locked; staff secret is not configured",
    };
  }

  const email = (
    headerValue(headers, "x-studio-staff-email") ||
    headerValue(headers, "x-staff-email") ||
    ""
  ).trim();
  const key =
    headerValue(headers, "x-studio-staff-key") ??
    headerValue(headers, "authorization")?.replace(/^Bearer\s+/i, "");

  if (!email || !key) {
    return {
      ok: false,
      status: 401,
      error: "Studio staff email and key required",
    };
  }

  if (key !== secret) {
    return { ok: false, status: 403, error: "Invalid studio staff key" };
  }

  const entry = resolveStudioStaff(email, env);
  if (!entry || !isInternalStudioStaff(email, env)) {
    return {
      ok: false,
      status: 403,
      error:
        "AnimationStudioOS is limited to hollywood_editor, director, and studio_admin",
    };
  }

  return {
    ok: true,
    email: entry.email,
    role: entry.role as InternalStudioRole,
  };
}

export function assertStudioJwt(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): StudioAuthResult {
  const authorization = headerValue(headers, "authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Studio JWT required" };
  }
  const token = authorization.slice(7).trim();
  const secret = getSupabaseJwtSecret(env) || getStudioStaffSecret(env);
  const payload = verifyHs256Jwt(token, secret);
  if (!payload) {
    return { ok: false, status: 403, error: "Invalid studio JWT" };
  }
  const role = readClaim(payload, "studio_role") ?? "";
  if (!isInternalStudioRole(role)) {
    return {
      ok: false,
      status: 403,
      error:
        "AnimationStudioOS is limited to hollywood_editor, director, and studio_admin",
    };
  }
  const email = (
    readClaim(payload, "email") ??
    (typeof payload.sub === "string" ? payload.sub : "")
  ).toLowerCase();
  if (!email) {
    return { ok: false, status: 403, error: "Studio JWT is missing email" };
  }
  return { ok: true, email, role };
}

export function assertStudioAccess(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): StudioAuthResult {
  if (
    headerValue(headers, "x-studio-staff-email") ||
    headerValue(headers, "x-staff-email")
  ) {
    return assertStudioStaff(headers, env);
  }
  const cookie = readCookie(headers, STUDIO_SESSION_COOKIE);
  if (cookie && !headerValue(headers, "authorization")) {
    const forged = new Headers(headers);
    forged.set("authorization", `Bearer ${cookie}`);
    return assertStudioJwt(forged, env);
  }
  return assertStudioJwt(headers, env);
}
