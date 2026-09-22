import { NextRequest, NextResponse } from "next/server";
import { HlsIngestionPipeline } from "@/streaming/ingest/hlsIngestionService";
import { isWorfiAdminKey } from "@/streaming/server/adminIngestApi";

export async function POST(request: NextRequest) {
  if (!isWorfiAdminKey(request.headers.get("x-worfi-admin-key") ?? undefined)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized network access" },
      { status: 403 },
    );
  }

  let body: {
    title?: string;
    creatorName?: string;
    channelId?: string;
    sourceVideoUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to schedule programming" },
      { status: 500 },
    );
  }

  try {
    const result = await HlsIngestionPipeline.processAndIngestVideo({
      title: body.title ?? "",
      creatorName: body.creatorName ?? "",
      channelId: body.channelId ?? "",
      sourceVideoUrl: body.sourceVideoUrl ?? "",
    });
    return NextResponse.json({
      success: true,
      message: `Program scheduled successfully on ${body.channelId}`,
      ...result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to schedule programming";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
