import { NextResponse } from "next/server";
import { assertStudioAccess, type StudioAuthResult } from "@/internal-studio/auth";

export function studioStaffFrom(request: Request): StudioAuthResult {
  return assertStudioAccess(request.headers);
}

export function studioUnauthorized(auth: Extract<StudioAuthResult, { ok: false }>) {
  return NextResponse.json(
    { success: false, error: auth.error },
    { status: auth.status },
  );
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
