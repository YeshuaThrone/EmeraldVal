import { NextResponse } from "next/server";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { enqueueStudioPipeline } from "@/sdk/studio-queue";
import type { ShotCard, StudioRenderJobData } from "@/sdk/studio-engine";
import { studioWorkDir } from "@/internal-studio/api/ffmpegStitcher";
import path from "node:path";

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
  return { shotId, speakerId, dialogueText, characterModelId, motionPrompt };
}

function parseJob(
  body: unknown,
  requestedBy: string,
): StudioRenderJobData | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Missing episodeId, showId, rodecasterAudioPath, and shotCards" };
  }
  const record = body as Record<string, unknown>;
  const episodeId = typeof record.episodeId === "string" ? record.episodeId.trim() : "";
  const showId = typeof record.showId === "string" ? record.showId.trim() : "";
  const rodecasterAudioPath =
    typeof record.rodecasterAudioPath === "string"
      ? record.rodecasterAudioPath.trim()
      : "";
  const shotCards = Array.isArray(record.shotCards)
    ? record.shotCards.map(parseShotCard).filter((card): card is ShotCard => card !== null)
    : [];
  if (!episodeId || !showId || !rodecasterAudioPath || shotCards.length === 0) {
    return { error: "Missing episodeId, showId, rodecasterAudioPath, and shotCards" };
  }
  const outputDir =
    typeof record.outputDir === "string" && record.outputDir.trim()
      ? record.outputDir.trim()
      : path.join(studioWorkDir(), episodeId);
  const targetFps =
    typeof record.targetFps === "number" && Number.isFinite(record.targetFps)
      ? record.targetFps
      : 30;

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

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const parsed = parseJob(await readJsonBody(request), auth.email);
  if ("error" in parsed && !("episodeId" in parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const jobData = parsed as StudioRenderJobData;

  try {
    const queued = await enqueueStudioPipeline(jobData);
    return NextResponse.json({
      success: true,
      jobId: queued.jobId,
      episodeId: jobData.episodeId,
      stage: queued.status,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to enqueue studio render";
    return NextResponse.json(
      { error: "Pipeline execution failed", details: message },
      { status: 500 },
    );
  }
}
