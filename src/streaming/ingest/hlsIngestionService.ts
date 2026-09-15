import { getStreamingEngine } from "../server/apiRoutes";
import type { ProgramSegment } from "../playout/multiChannelEngine";
import { VideoIngestionEngine } from "./ingestionEngine";

export interface HlsIngestInput {
  title: string;
  creatorName: string;
  channelId: string;
  sourceVideoUrl: string;
}

export interface HlsIngestResult {
  channelId: string;
  hlsPlaylistUrl: string;
  segment: ProgramSegment;
}

function asHlsPlaylistUrl(sourceVideoUrl: string): string {
  if (sourceVideoUrl.includes(".m3u8")) return sourceVideoUrl;
  return `${sourceVideoUrl.replace(/\/$/, "")}/index.m3u8`;
}

export class HlsIngestionPipeline {
  /**
   * Normalize an approved source into a program segment and append it
   * to the target channel grid.
   */
  public static async processAndIngestVideo(
    input: HlsIngestInput,
  ): Promise<HlsIngestResult> {
    const title = input.title?.trim();
    const creatorName = input.creatorName?.trim();
    const channelId = input.channelId?.trim();
    const sourceVideoUrl = input.sourceVideoUrl?.trim();
    if (!title || !creatorName || !channelId || !sourceVideoUrl) {
      throw new Error(
        "title, creatorName, channelId, and sourceVideoUrl are required",
      );
    }

    const engine = getStreamingEngine();
    if (!engine.getChannel(channelId)) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const segment = await VideoIngestionEngine.processIngest({
      sourceUrl: sourceVideoUrl,
      creatorName,
      titleOverride: title,
      type: "SHOW",
    });

    const hlsPlaylistUrl = asHlsPlaylistUrl(sourceVideoUrl);
    const scheduled: ProgramSegment = {
      ...segment,
      videoUrl: sourceVideoUrl.includes(".m3u8")
        ? sourceVideoUrl
        : segment.videoUrl,
    };
    engine.appendSegment(channelId, scheduled);

    return {
      channelId,
      hlsPlaylistUrl,
      segment: scheduled,
    };
  }
}
