import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { JobProgressPayload, StudioRenderJobData } from "./studio-engine";

vi.mock("./studio-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./studio-engine")>();
  return {
    ...actual,
    generateSceneMotion: vi.fn(async (shot: { shotId: string }, outputDir: string) => {
      return `${outputDir}/motion_${shot.shotId}.mp4`;
    }),
    applyLipSync: vi.fn(async (motionPath: string, _audio: string, _ts: unknown, outputDir: string) => {
      return `${outputDir}/synced_${motionPath.split("/").pop()}`;
    }),
    packageEpisodeHls: vi.fn(async (_scenes, _audio, outputDir: string) => {
      return `${outputDir}/hls/index.m3u8`;
    }),
  };
});

import { applyLipSync, generateSceneMotion, packageEpisodeHls } from "./studio-engine";
import {
  enqueueStudioPipeline,
  enqueueStudioPipelineJob,
  processStudioRenderJob,
  STUDIO_RENDER_JOB_NAME,
  STUDIO_RENDER_QUEUE,
} from "./studio-queue";

const sampleJob = (): StudioRenderJobData => ({
  episodeId: "ep-42",
  showId: "show-wurfi",
  rodecasterAudioPath: "/tmp/internal-studio/ep-42/master.wav",
  shotCards: [
    {
      shotId: "shot_01",
      speakerId: "hero_01",
      dialogueText: "Hold the city.",
      characterModelId: "hero_01",
      motionPrompt: "push-in",
    },
  ],
  outputDir: "/tmp/internal-studio/ep-42",
  requestedBy: "3bbullion@gmail.com",
  targetFps: 30,
});

describe("enqueueStudioPipeline", () => {
  it("adds RenderEpisodeJob with three exponential attempts", async () => {
    const add = vi.fn(async () => ({ id: "job-99" }));
    const queued = await enqueueStudioPipeline(sampleJob(), { add });
    expect(queued).toEqual({ jobId: "job-99", status: "QUEUED" });
    expect(add).toHaveBeenCalledWith(
      STUDIO_RENDER_JOB_NAME,
      sampleJob(),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }),
    );
  });

  it("rejects callers outside the staff allowlist before enqueue", async () => {
    const add = vi.fn(async () => ({ id: "job-99" }));
    await expect(
      enqueueStudioPipeline({ ...sampleJob(), requestedBy: "fan@example.com" }, { add }),
    ).rejects.toThrow(/Access Denied/);
    expect(add).not.toHaveBeenCalled();
  });

  it("returns a fallback id when BullMQ omits job.id", async () => {
    const add = vi.fn(async () => ({ id: undefined }));
    await expect(enqueueStudioPipelineJob(sampleJob(), { add })).resolves.toBe(
      "job_queued",
    );
  });
});

describe("processStudioRenderJob", () => {
  it("runs motion, lip-sync, and HLS then reports EPG_PUBLISHED internally", async () => {
    const progress: JobProgressPayload[] = [];
    const result = await processStudioRenderJob({
      id: "job-99",
      data: sampleJob(),
      updateProgress: async (value) => {
        progress.push(value as JobProgressPayload);
      },
    });

    expect(generateSceneMotion).toHaveBeenCalled();
    expect(applyLipSync).toHaveBeenCalled();
    expect(packageEpisodeHls).toHaveBeenCalledWith(
      ["/tmp/internal-studio/ep-42/synced_motion_shot_01.mp4"],
      sampleJob().rodecasterAudioPath,
      "/tmp/internal-studio/ep-42",
      30,
    );
    expect(result).toEqual({
      jobId: "job-99",
      episodeId: "ep-42",
      status: "EPG_PUBLISHED",
      hlsUrl: "/tmp/internal-studio/ep-42/hls/index.m3u8",
    });
    expect(progress.map((item) => item.stage)).toEqual([
      "AUDIO_TRANSCRIBING",
      "MOTION_GENERATION",
      "LIP_SYNC_PROCESSING",
      "SCENE_STITCHING",
      "HLS_PACKAGING",
      "EPG_PUBLISHED",
    ]);
    expect(progress.at(-1)?.progressPercent).toBe(100);
  });
});

describe("studio queue constants", () => {
  it("uses an isolated AnimationStudioEngine queue and does not start a worker on import", () => {
    expect(STUDIO_RENDER_QUEUE).toBe("AnimationStudioEngineQueue");
    const src = readFileSync(path.join(import.meta.dirname, "studio-queue.ts"), "utf8");
    expect(src).not.toMatch(/export const studioWorker = new Worker/);
    expect(src).not.toMatch(/export const studioRenderQueue = new Queue/);
  });
});
