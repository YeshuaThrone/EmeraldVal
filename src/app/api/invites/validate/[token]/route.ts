import { NextResponse } from "next/server";
import { assertCreatorInviteToken } from "@/streaming/server/creatorInvites";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = token?.trim();
  if (!invite) {
    return NextResponse.json(
      { valid: false, error: "Invalid or expired invite token" },
      { status: 404 },
    );
  }
  try {
    const check = await assertCreatorInviteToken(invite);
    if (!check.ok) {
      return NextResponse.json(
        { valid: false, error: check.error },
        { status: 404 },
      );
    }
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Invalid or expired invite token" },
      { status: 404 },
    );
  }
}
