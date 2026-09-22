import { NextResponse } from "next/server";
import { listLineupChannels } from "@/streaming/admin/channelProvisioning";

export async function GET() {
  try {
    const channels = await listLineupChannels();
    return NextResponse.json({ success: true, channels });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to list channels" },
      { status: 500 },
    );
  }
}
