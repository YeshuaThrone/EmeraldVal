import type { ProgramSegment } from "../playout/multiChannelEngine";

export interface IngestRequest {
  sourceUrl: string; // YouTube link or directly hosted MP4
  creatorName: string;
  creatorAvatarUrl?: string;
  titleOverride?: string;
  customDurationSeconds?: number;
  type?: "SHOW" | "CREATOR_PROMO" | "STATION_ID";
  socialHandle?: string;
}

const INGEST_TYPES: NonNullable<IngestRequest["type"]>[] = [
  "SHOW",
  "CREATOR_PROMO",
  "STATION_ID",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export class VideoIngestionEngine {
  /**
   * Accepts the typed ingest request or a raw JSON body from the API /
   * onboarding portal (videoUrl/title/durationSeconds aliases).
   */
  public static parseRequest(body: unknown): IngestRequest {
    if (!isRecord(body)) {
      throw new Error("Ingest body must be a JSON object");
    }

    const creatorName = asString(body.creatorName);
    const sourceUrl = asString(body.sourceUrl) ?? asString(body.videoUrl);
    if (!creatorName || !sourceUrl) {
      throw new Error("creatorName and sourceUrl are required");
    }

    const rawType = asString(body.type);
    const type = INGEST_TYPES.includes(rawType as IngestRequest["type"])
      ? (rawType as IngestRequest["type"])
      : "SHOW";

    return {
      sourceUrl,
      creatorName,
      creatorAvatarUrl: asString(body.creatorAvatarUrl),
      titleOverride: asString(body.titleOverride) ?? asString(body.title),
      customDurationSeconds:
        asPositiveNumber(body.customDurationSeconds) ??
        asPositiveNumber(body.durationSeconds),
      type,
      socialHandle: asString(body.socialHandle),
    };
  }

  /**
   * Converts a raw YouTube URL or standard MP4 into a normalized ProgramSegment for channels
   */
  public static async processIngest(
    request: IngestRequest | unknown,
  ): Promise<ProgramSegment> {
    const normalized = VideoIngestionEngine.parseRequest(request);

    const isYouTube =
      normalized.sourceUrl.includes("youtube.com") ||
      normalized.sourceUrl.includes("youtu.be");

    let videoStreamUrl = normalized.sourceUrl;
    let extractedTitle = normalized.titleOverride || "Ingested Content";

    if (isYouTube) {
      const videoId = this.extractYouTubeId(normalized.sourceUrl);
      videoStreamUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&mute=1`;
      extractedTitle =
        normalized.titleOverride || `YouTube Asset (${videoId})`;
    }

    return {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: extractedTitle,
      creatorName: normalized.creatorName,
      creatorAvatarUrl:
        normalized.creatorAvatarUrl ||
        "https://cdn.yourdomain.com/defaults/avatar.png",
      type: normalized.type || "SHOW",
      videoUrl: videoStreamUrl,
      durationSeconds: normalized.customDurationSeconds || 300,
      metadata: {
        socialHandle: normalized.socialHandle,
      },
    };
  }

  private static extractYouTubeId(url: string): string {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const id = match?.[2];
    return id && id.length === 11 ? id : "UNKNOWN_ID";
  }
}
