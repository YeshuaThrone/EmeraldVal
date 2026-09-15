import { NextRequest, NextResponse } from "next/server";
import { bridgeActiveChannelGaps } from "@/streaming/admin/channelProvisioning";
import { isWorfiAdminKey } from "@/streaming/server/adminIngestApi";

export async function POST(request: NextRequest) {
  if (!isWorfiAdminKey(request.headers.get("x-worfi-admin-key") ?? undefined)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized network access" },
      { status: 403 },
    );
  }

  let channelId: string | undefined;
  try {
    const body = (await request.json()) as { channelId?: unknown };
    if (typeof body.channelId === "string") channelId = body.channelId;
  } catch {
    channelId = undefined;
  }

  try {
    const result = await bridgeActiveChannelGaps(channelId);
    return NextResponse.json({
      success: true,
      message:
        result.inserted > 0
          ? `Bridged ${result.inserted} gap(s) across ${result.processed} channel(s).`
          : "No schedule gaps needed bridging.",
      inserted: result.inserted,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}
