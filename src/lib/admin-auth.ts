import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "atx_admin_jwt";
export const ADMIN_ROLE = "super-admin" as const;
const TOKEN_TTL_SEC = 60 * 60 * 12;

export type AdminClaims = {
  sub: string;
  role: typeof ADMIN_ROLE;
  iat: number;
  exp: number;
};

function getSecret(): string {
  return (process.env.ADMIN_JWT_SECRET ?? "").trim();
}

function getPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? "").trim();
}

export function adminAuthConfigured(): boolean {
  return getSecret().length >= 16 && getPassword().length >= 8;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export function verifyAdminPassword(password: string): boolean {
  if (!adminAuthConfigured()) {
    return false;
  }
  return safeEqual(password, getPassword());
}

function encodePart(value: object | string): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(raw).toString("base64url");
}

export function signAdminToken(subject: string): string {
  const header = encodePart({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = encodePart({
    sub: subject,
    role: ADMIN_ROLE,
    iat: now,
    exp: now + TOKEN_TTL_SEC,
  } satisfies AdminClaims);
  const signature = createHmac("sha256", getSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyAdminToken(token: string): AdminClaims | null {
  try {
    if (!adminAuthConfigured()) {
      return null;
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [header, payload, signature] = parts;
    const expected = createHmac("sha256", getSecret())
      .update(`${header}.${payload}`)
      .digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null;
    }
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminClaims;
    if (claims.role !== ADMIN_ROLE || claims.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SEC,
  };
}
