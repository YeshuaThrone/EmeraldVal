import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/streaming/server/adminAuth";
import { createCreatorInvite } from "@/streaming/server/creatorInvites";

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid Admin Token" },
      { status: 401 },
    );
  }

  let body: { creatorName?: string; creatorEmail?: string; validDays?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Creator name and email required" },
      { status: 400 },
    );
  }

  if (!body.creatorName || !body.creatorEmail) {
    return NextResponse.json(
      { error: "Creator name and email required" },
      { status: 400 },
    );
  }

  try {
    const invite = await createCreatorInvite({
      creatorName: body.creatorName,
      creatorEmail: body.creatorEmail,
      validDays: body.validDays,
    });
    return NextResponse.json({ success: true, ...invite });
  } catch {
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}
