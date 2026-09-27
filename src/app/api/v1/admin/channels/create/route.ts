import { NextRequest, NextResponse } from "next/server";
import { provisionCustomChannel } from "@/streaming/admin/channelProvisioning";
import { isWorfiAdminKey } from "@/streaming/server/adminIngestApi";

export async function POST(request: NextRequest) {
  if (!isWorfiAdminKey(request.headers.get("x-worfi-admin-key") ?? undefined)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized network access" },
      { status: 403 },
    );
  }

  let body: {
    channelNumber?: unknown;
    channelName?: unknown;
    category?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const created = await provisionCustomChannel(body);
    return NextResponse.json({
      success: true,
      message: `Channel CH ${created.channelNumber} (${created.channelName}) provisioned successfully.`,
      channelId: created.channelId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create custom channel";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: status === 500 ? "Failed to create custom channel" : message,
      },
      { status },
    );
  }
}
