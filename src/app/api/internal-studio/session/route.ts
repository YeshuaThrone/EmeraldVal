import { NextResponse } from "next/server";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import {
  assertStudioStaff,
  signStudioSession,
  studioSessionCookie,
  STUDIO_SESSION_COOKIE,
} from "@/internal-studio/auth";

export async function GET(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);
  return NextResponse.json({
    success: true,
    email: auth.email,
    role: auth.role,
  });
}

export async function POST(request: Request) {
  const body = (await readJsonBody(request)) as {
    email?: unknown;
    key?: unknown;
  };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const key = typeof body.key === "string" ? body.key : "";
  const headers = new Headers({
    "x-studio-staff-email": email,
    "x-studio-staff-key": key,
  });
  const auth = assertStudioStaff(headers);
  if (!auth.ok) return studioUnauthorized(auth);

  const token = signStudioSession({ email: auth.email, role: auth.role });
  const response = NextResponse.json({
    success: true,
    email: auth.email,
    role: auth.role,
  });
  response.headers.set("Set-Cookie", studioSessionCookie(token));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    `${STUDIO_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return response;
}
