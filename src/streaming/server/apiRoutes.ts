import { NextRequest, NextResponse } from "next/server";
import { cloneChannelPresets } from "../config/channelPresets";
import { VideoIngestionEngine } from "../ingest/ingestionEngine";
import { MultiChannelEngine } from "../playout/multiChannelEngine";

let sharedEngine: MultiChannelEngine | undefined;

export function getStreamingEngine(): MultiChannelEngine {
  if (!sharedEngine) {
    sharedEngine = new MultiChannelEngine();
    for (const channel of cloneChannelPresets()) {
      sharedEngine.registerChannel(channel);
    }
  }
  return sharedEngine;
}

export function createStreamingHandlers(engine: MultiChannelEngine) {
  return {
    listChannels(): NextResponse {
      return NextResponse.json({
        success: true,
        channels: engine.getChannelList(),
      });
    },

    live(channelId: string): NextResponse {
      if (!engine.getChannel(channelId)) {
        return NextResponse.json(
          { success: false, error: `Channel ${channelId} not found` },
          { status: 404 },
        );
      }
      return NextResponse.json(engine.getCurrentPlayhead(channelId));
    },

    async ingest(channelId: string, body: unknown): Promise<NextResponse> {
      try {
        if (!engine.getChannel(channelId)) {
          return NextResponse.json(
            { success: false, error: "Channel not found" },
            { status: 404 },
          );
        }
        const request = VideoIngestionEngine.parseRequest(body);
        const segment = await VideoIngestionEngine.processIngest(request);
        const network = engine.appendSegment(channelId, segment);
        return NextResponse.json({
          success: true,
          message: `Asset successfully ingested into ${network.channelName}`,
          segment,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ingest failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    },
  };
}

export async function handleStreamingRequest(
  request: NextRequest,
  path: { channelId?: string; action?: "live" | "ingest" },
): Promise<NextResponse> {
  const handlers = createStreamingHandlers(getStreamingEngine());
  if (!path.channelId) {
    return handlers.listChannels();
  }
  if (path.action === "live") {
    return handlers.live(path.channelId);
  }
  if (path.action === "ingest") {
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    return handlers.ingest(path.channelId, body);
  }
  return NextResponse.json(
    { success: false, error: "Unknown streaming route" },
    { status: 404 },
  );
}
