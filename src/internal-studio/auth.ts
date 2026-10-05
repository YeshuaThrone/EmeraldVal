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

  const email = (headerValue(headers, "x-studio-staff-email") ?? "").trim();
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
  if (headerValue(headers, "x-studio-staff-email")) {
    return assertStudioStaff(headers, env);
  }
  return assertStudioJwt(headers, env);
}
