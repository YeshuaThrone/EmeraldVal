import { NextResponse } from "next/server";
import { findValidInvite } from "@/streaming/server/creatorInvites";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const invite = await findValidInvite(token);
    if (!invite) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired invite token" },
        { status: 404 },
      );
    }
    return NextResponse.json({ valid: true, invite });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
