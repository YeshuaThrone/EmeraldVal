import path from "node:path";
import { studioWorkDir } from "@/internal-studio/api/ffmpegStitcher";
import {
  DEFAULT_BROADCAST_FPS,
  type ShotCard,
  type StudioRenderJobData,
} from "./studio-engine";

export const DEFAULT_STUDIO_SHOW_ID = "wurfi-default-show";

function parseShotCard(value: unknown): ShotCard | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const shotId = typeof record.shotId === "string" ? record.shotId.trim() : "";
  const speakerId =
    typeof record.speakerId === "string" ? record.speakerId.trim() : "";
  const dialogueText =
    typeof record.dialogueText === "string" ? record.dialogueText.trim() : "";
  const characterModelId =
    typeof record.characterModelId === "string"
      ? record.characterModelId.trim()
      : "";
  const motionPrompt =
    typeof record.motionPrompt === "string" ? record.motionPrompt.trim() : "";
  if (!shotId || !speakerId || !dialogueText || !characterModelId || !motionPrompt) {
    return null;
  }
  const cameraAngle =
    typeof record.cameraAngle === "string" && record.cameraAngle.trim()
      ? record.cameraAngle.trim()
      : undefined;
  return {
    shotId,
    speakerId,
    dialogueText,
    characterModelId,
    motionPrompt,
    ...(cameraAngle ? { cameraAngle } : {}),
  };
}

export function parseStudioRenderJobBody(
  body: unknown,
  requestedBy: string,
  options: { defaultShowId?: string } = {},
): StudioRenderJobData | { error: string } {
  if (!body || typeof body !== "object") {
    return {
      error: "Bad Request: Missing required episode metadata or shot cards.",
    };
  }
  const record = body as Record<string, unknown>;
  const episodeId = typeof record.episodeId === "string" ? record.episodeId.trim() : "";
  const showId =
    typeof record.showId === "string" && record.showId.trim()
      ? record.showId.trim()
      : options.defaultShowId || "";
  const rodecasterAudioPath =
    typeof record.rodecasterAudioPath === "string"
      ? record.rodecasterAudioPath.trim()
      : "";
  const shotCards = Array.isArray(record.shotCards)
    ? record.shotCards.map(parseShotCard).filter((card): card is ShotCard => card !== null)
    : [];
  if (!episodeId || !showId || !rodecasterAudioPath || shotCards.length === 0) {
    return {
      error: "Bad Request: Missing required episode metadata or shot cards.",
    };
  }
  const outputDir =
    typeof record.outputDir === "string" && record.outputDir.trim()
      ? record.outputDir.trim()
      : path.join(studioWorkDir(), episodeId);
  const targetFps =
    typeof record.targetFps === "number" && Number.isFinite(record.targetFps)
      ? record.targetFps
      : DEFAULT_BROADCAST_FPS;

  return {
    episodeId,
    showId,
    rodecasterAudioPath,
    shotCards,
    outputDir,
    requestedBy,
    targetFps,
  };
}
