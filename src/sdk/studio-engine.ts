import { spawn } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertInsideWorkDir,
  concatFileContents,
  studioWorkDir,
} from "@/internal-studio/api/ffmpegStitcher";

export const DEFAULT_BROADCAST_FPS = 29.97;

export type PipelineStage =
  | "QUEUED"
  | "AUDIO_ALIGNMENT"
  | "AUDIO_TRANSCRIBING"
  | "MOTION_DISPATCH"
  | "MOTION_GENERATION"
  | "LIP_SYNC_GENERATION"
  | "LIP_SYNC_PROCESSING"
  | "FFMPEG_STITCHING"
  | "SCENE_STITCHING"
  | "HLS_PACKAGING"
  | "EPG_PUBLISHED"
  | "FAILED";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  phonemes?: string[];
}

export interface ShotCard {
  shotId: string;
  speakerId: string;
  dialogueText: string;
  characterModelId: string;
  motionPrompt: string;
  cameraAngle?: string;
}

export interface StudioRenderJobData {
  episodeId: string;
  showId: string;
  rodecasterAudioPath: string;
  shotCards: ShotCard[];
  outputDir: string;
  requestedBy: string;
  targetFps?: number;
}

export interface JobProgressPayload {
  jobId: string;
  episodeId: string;
  stage: PipelineStage;
  progressPercent: number;
  hlsMasterUrl?: string;
  error?: string;
}

export interface PipelineState {
  jobId: string;
  episodeId: string;
  currentStage: PipelineStage;
  progressPercent: number;
  hlsMasterUrl?: string;
  error?: string;
}

function runFfmpeg(args: string[], bin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`FFmpeg Render Failure: ffmpeg failed (${code}): ${stderr.slice(0, 500)}`),
      );
    });
  });
}

/**
 * Parses raw forced-alignment JSON payloads into validated frame-accurate timestamp structures.
 */
export function parseAudioPhonemes(rawAlignmentJson: string): WordTimestamp[] {
  try {
    const parsed = JSON.parse(rawAlignmentJson) as { segments?: unknown };
    if (!Array.isArray(parsed.segments)) {
      throw new Error("Invalid audio alignment payload: Missing segments array.");
    }

    const timestamps: WordTimestamp[] = [];

    for (const segment of parsed.segments) {
      if (!segment || typeof segment !== "object") continue;
      const words = (segment as { words?: unknown }).words;
      if (!Array.isArray(words)) continue;
      for (const wordObj of words) {
        if (!wordObj || typeof wordObj !== "object") continue;
        const record = wordObj as Record<string, unknown>;
        const word = String(record.word ?? "").trim();
        if (!word) continue;
        timestamps.push({
          word,
          start: Number.parseFloat(String(record.start ?? "0")) || 0,
          end: Number.parseFloat(String(record.end ?? "0")) || 0,
          phonemes: Array.isArray(record.phonemes)
            ? record.phonemes.map((part) => String(part))
            : [],
        });
      }
    }

    return timestamps;
  } catch (err) {
    throw new Error(
      `Failed to parse alignment timestamps: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}

function asWordTimestamp(wordObj: Record<string, unknown>): WordTimestamp | null {
  const word = String(wordObj.word ?? wordObj.punctuated_word ?? "").trim();
  if (!word) return null;
  return {
    word,
    start: Number.parseFloat(String(wordObj.start ?? "0")) || 0,
    end: Number.parseFloat(String(wordObj.end ?? "0")) || 0,
    phonemes: Array.isArray(wordObj.phonemes)
      ? wordObj.phonemes.map((part) => String(part))
      : [],
  };
}

/**
 * Parses WhisperX / Deepgram forced-alignment JSON into word timestamps.
 */
export function parseMasterAudioTrack(rawAlignmentJsonPayload: string): WordTimestamp[] {
  try {
    const data = JSON.parse(rawAlignmentJsonPayload) as Record<string, unknown>;
    if (Array.isArray(data.segments)) {
      return parseAudioPhonemes(rawAlignmentJsonPayload);
    }

    const channels = (data.results as { channels?: unknown } | undefined)?.channels;
    const firstChannel = Array.isArray(channels) ? channels[0] : undefined;
    const alternatives = (firstChannel as { alternatives?: unknown } | undefined)
      ?.alternatives;
    const deepgramWords = Array.isArray(alternatives)
      ? (alternatives[0] as { words?: unknown } | undefined)?.words
      : undefined;

    if (!Array.isArray(deepgramWords)) {
      throw new Error("Invalid audio alignment payload structure.");
    }

    const words: WordTimestamp[] = [];
    for (const item of deepgramWords) {
      if (!item || typeof item !== "object") continue;
      const parsed = asWordTimestamp(item as Record<string, unknown>);
      if (parsed) words.push(parsed);
    }
    return words;
  } catch (err) {
    throw new Error(
      `parseMasterAudioTrack Error: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}

/**
 * Dispatches shot prompts to SeeDance when configured; otherwise returns the target GPU upload path.
 */
export async function generateSceneMotion(
  shot: ShotCard,
  outputDir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  mkdirSync(outputDir, { recursive: true });
  const targetMp4 = path.join(outputDir, `motion_${shot.shotId}.mp4`);
  const url = (
    env.SEEDANCE_API_URL ??
    env.ANIMATION_STUDIO_OS_SEEDANCE_URL ??
    ""
  ).trim();
  if (url) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        engine: "SeeDance",
        shotId: shot.shotId,
        prompt: shot.motionPrompt,
        dialogueText: shot.dialogueText,
        characterModelId: shot.characterModelId,
        cameraAngle: shot.cameraAngle,
        outputPath: targetMp4,
      }),
    });
    if (!response.ok) {
      throw new Error(`SeeDance motion dispatch failed (${response.status})`);
    }
  }
  console.log(
    `[AnimationStudioEngine] Dispatching Motion Generation for Shot: ${shot.shotId}`,
  );
  return targetMp4;
}

/**
 * Returns the lip-synced scene path for a motion clip + Rodecaster segment.
 * External GPU workers write the file; packaging fails if it is missing.
 */
export async function applyLipSync(
  motionMp4Path: string,
  audioSegmentPath: string,
  _timestamps: WordTimestamp[],
  outputDir: string,
): Promise<string> {
  mkdirSync(outputDir, { recursive: true });
  const syncedMp4Path = path.join(outputDir, `synced_${path.basename(motionMp4Path)}`);
  console.log(`[AnimationStudioEngine] Applying Lip-Sync to: ${motionMp4Path}`);
  void _timestamps;
  return syncedMp4Path;
}

/**
 * Normalizes frame rates, merges Rodecaster master audio, and packages HLS.
 * Uses spawn argv (not a shell string). Does not publish to the public WURFI player.
 */
export async function compileAndPackageHls(
  syncedScenePaths: string[],
  masterAudioPath: string,
  outputDir: string,
  targetFps = DEFAULT_BROADCAST_FPS,
  ffmpegBin = "ffmpeg",
): Promise<string> {
  return compileAndPackageEpisode(
    syncedScenePaths,
    masterAudioPath,
    outputDir,
    targetFps,
    ffmpegBin,
  );
}

export async function packageEpisodeHls(
  syncedScenePaths: string[],
  masterAudioPath: string,
  outputDir: string,
  targetFps = DEFAULT_BROADCAST_FPS,
  ffmpegBin = "ffmpeg",
): Promise<string> {
  return compileAndPackageHls(
    syncedScenePaths,
    masterAudioPath,
    outputDir,
    targetFps,
    ffmpegBin,
  );
}

export function buildStudioConcatArgs(input: {
  concatListPath: string;
  masterAudioPath: string;
  stitchedMp4Path: string;
  targetFps: number;
}): string[] {
  return [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    input.concatListPath,
    "-i",
    input.masterAudioPath,
    "-c:v",
    "libx264",
    "-r",
    String(input.targetFps),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    input.stitchedMp4Path,
  ];
}

export function buildStudioHlsArgs(input: {
  stitchedMp4Path: string;
  hlsMasterManifest: string;
}): string[] {
  return [
    "-y",
    "-i",
    input.stitchedMp4Path,
    "-profile:v",
    "main",
    "-level",
    "3.0",
    "-start_number",
    "0",
    "-hls_time",
    "6",
    "-hls_list_size",
    "0",
    "-f",
    "hls",
    input.hlsMasterManifest,
  ];
}

/**
 * Combines generated MP4 scenes with Rodecaster master audio and packages HLS.
 * Uses spawn argv (not a shell string). Does not publish to the public WURFI player.
 */
export async function compileAndPackageEpisode(
  sceneMp4Paths: string[],
  masterAudioPath: string,
  outputDir: string,
  targetFps = 30,
  ffmpegBin = "ffmpeg",
): Promise<string> {
  if (sceneMp4Paths.length < 1) {
    throw new Error("At least one scene MP4 is required");
  }
  if (!Number.isFinite(targetFps) || targetFps < 1 || targetFps > 120) {
    throw new Error("targetFps must be between 1 and 120");
  }

  const workDir = path.resolve(outputDir || studioWorkDir());
  mkdirSync(workDir, { recursive: true });

  const clips = sceneMp4Paths.map((clip) => assertInsideWorkDir(clip, workDir));
  const audio = assertInsideWorkDir(masterAudioPath, workDir);
  const missing = [...clips, audio].find((filePath) => !existsSync(filePath));
  if (missing) {
    throw new Error(`FFmpeg Render Failure: missing input ${missing}`);
  }

  const manifestListPath = path.join(workDir, "concat_list.txt");
  const stitchedMp4Path = path.join(workDir, "master_stitched.mp4");
  const hlsOutputDir = path.join(workDir, "hls");
  const hlsMasterManifest = path.join(hlsOutputDir, "index.m3u8");
  mkdirSync(hlsOutputDir, { recursive: true });

  writeFileSync(manifestListPath, concatFileContents(clips), "utf-8");

  const concatArgs = buildStudioConcatArgs({
    concatListPath: manifestListPath,
    masterAudioPath: audio,
    stitchedMp4Path,
    targetFps,
  });
  const hlsArgs = buildStudioHlsArgs({
    stitchedMp4Path,
    hlsMasterManifest,
  });

  try {
    await runFfmpeg(concatArgs, ffmpegBin);
    await runFfmpeg(hlsArgs, ffmpegBin);
    if (existsSync(manifestListPath)) {
      unlinkSync(manifestListPath);
    }
    return hlsMasterManifest;
  } catch (err) {
    throw new Error(
      `FFmpeg Render Failure: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}
