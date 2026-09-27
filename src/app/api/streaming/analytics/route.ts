import { NextResponse } from "next/server";
import { CableDatabaseEngine } from "@/streaming/db/dbEngine";

export async function GET() {
  try {
    const summary = await CableDatabaseEngine.loadViewerAnalytics();
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analytics store unavailable";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: {
          totalWatchSeconds: 0,
          uniqueViewers: 0,
          channelSwitches: 0,
          byChannel: [],
          bySegment: [],
        },
      },
      { status: 503 },
    );
  }
}
