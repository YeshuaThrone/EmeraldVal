import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import path from "node:path";
import {
  applyLipSync,
  generateSceneMotion,
  packageEpisodeHls,
  type JobProgressPayload,
  type StudioRenderJobData,
} from "./studio-engine";
import { authorizeStaffAccess } from "./studio-staff";
import { emitStudioJobProgress } from "@/lib/studio-dashboard-sdk";
import { studioWorkDir } from "@/internal-studio/api/ffmpegStitcher";

export const STUDIO_RENDER_QUEUE = "AnimationStudioEngineQueue";
export const STUDIO_RENDER_JOB_NAME = "RenderEpisodeJob";

export function studioRedisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number.parseInt(process.env.REDIS_PORT || "6379", 10),
  };
}

let studioQueue: Queue<StudioRenderJobData> | undefined;

export function getStudioQueue(): Queue<StudioRenderJobData> {
  studioQueue ??= new Queue<StudioRenderJobData>(STUDIO_RENDER_QUEUE, {
    connection: studioRedisConnection(),
  });
  return studioQueue;
}

type StudioJobLike = Pick<Job<StudioRenderJobData>, "data" | "updateProgress"> & {
  id?: string | number | null;
};

async function reportProgress(
  job: StudioJobLike,
  patch: Omit<JobProgressPayload, "jobId" | "episodeId"> & { episodeId?: string },
): Promise<void> {
  const payload: JobProgressPayload = {
    jobId: String(job.id ?? ""),
    episodeId: patch.episodeId ?? job.data.episodeId,
    stage: patch.stage,
    progressPercent: patch.progressPercent,
    hlsMasterUrl: patch.hlsMasterUrl,
    error: patch.error,
  };
  await job.updateProgress(payload);
  emitStudioJobProgress(payload.jobId, payload);
}

/**
 * Worker processor: Whisper alignment hook, SeeDance motion, lip-sync, FFmpeg HLS.
 * EPG_PUBLISHED is an internal stage label only — it does not write public WURFI EPG.
 */
export async function processStudioRenderJob(
  job: StudioJobLike,
): Promise<{
  jobId: string;
  episodeId: string;
  status: "EPG_PUBLISHED";
  hlsUrl: string;
}> {
  const {
    episodeId,
    rodecasterAudioPath,
    shotCards,
    outputDir,
    targetFps,
    requestedBy,
  } = job.data;
  authorizeStaffAccess(requestedBy);

  const workDir = path.resolve(outputDir || path.join(studioWorkDir(), episodeId));
  const jobId = String(job.id ?? "");
  console.log(
    `[Studio Engine Worker] Starting Job ${jobId} for Episode: ${episodeId}`,
  );

  try {
    await reportProgress(job, { stage: "AUDIO_TRANSCRIBING", progressPercent: 15 });

    await reportProgress(job, { stage: "MOTION_GENERATION", progressPercent: 40 });
    const renderedScenePaths: string[] = [];
    for (const shot of shotCards) {
      const rawMotion = await generateSceneMotion(shot, workDir);
      await reportProgress(job, { stage: "LIP_SYNC_PROCESSING", progressPercent: 55 });
      const syncedMotion = await applyLipSync(
        rawMotion,
        rodecasterAudioPath,
        [],
        workDir,
      );
      renderedScenePaths.push(syncedMotion);
    }

    await reportProgress(job, { stage: "SCENE_STITCHING", progressPercent: 70 });
    await reportProgress(job, { stage: "HLS_PACKAGING", progressPercent: 80 });
    const hlsUrl = await packageEpisodeHls(
      renderedScenePaths,
      rodecasterAudioPath,
      workDir,
      targetFps || 30,
    );

    await reportProgress(job, {
      stage: "EPG_PUBLISHED",
      progressPercent: 100,
      hlsMasterUrl: hlsUrl,
    });
    console.log(`[Studio Engine] Render Complete. Manifest generated at: ${hlsUrl}`);

    return {
      jobId,
      episodeId,
      status: "EPG_PUBLISHED",
      hlsUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio render failed";
    await reportProgress(job, {
      stage: "FAILED",
      progressPercent: 0,
      error: message,
    });
    throw error;
  }
}

export function createStudioWorker(): Worker<StudioRenderJobData> {
  return new Worker<StudioRenderJobData>(
    STUDIO_RENDER_QUEUE,
    async (job) => processStudioRenderJob(job),
    { connection: studioRedisConnection() },
  );
}

export async function enqueueStudioPipelineJob(
  jobData: StudioRenderJobData,
  queue: Pick<Queue<StudioRenderJobData>, "add"> = getStudioQueue(),
): Promise<string> {
  const job = await queue.add(STUDIO_RENDER_JOB_NAME, jobData, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  });
  return job.id || "job_queued";
}

/**
 * Enqueues a render task and returns jobId without hanging the API.
 */
export async function enqueueStudioPipeline(
  jobData: StudioRenderJobData,
  queue: Pick<Queue<StudioRenderJobData>, "add"> = getStudioQueue(),
): Promise<{ jobId: string; status: "QUEUED" }> {
  authorizeStaffAccess(jobData.requestedBy);
  const jobId = await enqueueStudioPipelineJob(jobData, queue);
  return { jobId, status: "QUEUED" };
}
