import type { ProgramSegment } from "../playout/multiChannelEngine";

export interface IngestPayload {
  creatorName: string;
  title: string;
  videoUrl: string;
  durationSeconds?: number;
  type?: ProgramSegment["type"];
  socialHandle?: string;
  artistBio?: string;
  email?: string;
  creatorAvatarUrl?: string;
}

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

const SEGMENT_TYPES: ProgramSegment["type"][] = [
  "SHOW",
  "STATION_ID",
  "CREATOR_PROMO",
  "INTERLUDE",
];

export class VideoIngestionEngine {
  public static parsePayload(body: unknown): IngestPayload {
    if (!isRecord(body)) {
      throw new Error("Ingest body must be a JSON object");
    }

    const creatorName = asString(body.creatorName);
    const title = asString(body.title);
    const videoUrl = asString(body.videoUrl);
    if (!creatorName || !title || !videoUrl) {
      throw new Error("creatorName, title, and videoUrl are required");
    }

    const rawType = asString(body.type);
    const type = SEGMENT_TYPES.includes(rawType as ProgramSegment["type"])
      ? (rawType as ProgramSegment["type"])
      : "SHOW";

    return {
      creatorName,
      title,
      videoUrl,
      durationSeconds: asPositiveNumber(body.durationSeconds),
      type,
      socialHandle: asString(body.socialHandle),
      artistBio: asString(body.artistBio),
      email: asString(body.email),
      creatorAvatarUrl: asString(body.creatorAvatarUrl),
    };
  }

  public static async processIngest(body: unknown): Promise<ProgramSegment> {
    const payload = VideoIngestionEngine.parsePayload(body);
    return {
      id: `seg-${Date.now()}`,
      title: payload.title,
      creatorName: payload.creatorName,
      creatorAvatarUrl: payload.creatorAvatarUrl,
      type: payload.type ?? "SHOW",
      videoUrl: payload.videoUrl,
      durationSeconds: payload.durationSeconds ?? 300,
      metadata: {
        description: payload.artistBio,
        socialHandle: payload.socialHandle,
      },
    };
  }
}
