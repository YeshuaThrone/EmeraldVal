import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminAuthConfigured,
  adminCookieOptions,
  signAdminToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    if (!adminAuthConfigured()) {
      return NextResponse.json(
        {
          error:
            "Admin auth is not configured. Set ADMIN_PASSWORD (8+ chars) and ADMIN_JWT_SECRET (16+ chars).",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { password?: string };
    const password = body.password ?? "";
    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    const token = signAdminToken("super-admin");
    const response = NextResponse.json({ ok: true, role: "super-admin" });
    response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Could not complete admin sign-in." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions(), maxAge: 0 });
  return response;
}
