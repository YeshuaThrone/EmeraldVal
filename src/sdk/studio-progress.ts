import type { Job } from "bullmq";
import type {
  JobProgressPayload,
  PipelineStage,
  StudioRenderJobData,
} from "./studio-engine";

export const TERMINAL_PIPELINE_STAGES: readonly PipelineStage[] = [
  "EPG_PUBLISHED",
  "FAILED",
];

export function isTerminalPipelineStage(stage: PipelineStage): boolean {
  return TERMINAL_PIPELINE_STAGES.includes(stage);
}

export function encodeStudioProgressEvent(payload: JobProgressPayload): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function stageFromPercent(percent: number): PipelineStage {
  if (percent >= 100) return "EPG_PUBLISHED";
  if (percent >= 85) return "HLS_PACKAGING";
  if (percent >= 70) return "FFMPEG_STITCHING";
  if (percent >= 45) return "LIP_SYNC_GENERATION";
  if (percent >= 40) return "MOTION_DISPATCH";
  if (percent >= 15) return "AUDIO_ALIGNMENT";
  return "QUEUED";
}

export function toJobProgressPayload(input: {
  id?: string | number | null;
  data: StudioRenderJobData;
  progress: unknown;
  returnvalue?: unknown;
  failedReason?: string;
}): JobProgressPayload {
  const jobId = String(input.id ?? "");
  const episodeId = input.data.episodeId;
  const returned = input.returnvalue as
    | { hlsUrl?: string; hlsManifestPath?: string; status?: string }
    | undefined;

  if (input.failedReason) {
    return {
      jobId,
      episodeId,
      stage: "FAILED",
      progressPercent: 0,
      error: input.failedReason,
    };
  }

  if (input.progress && typeof input.progress === "object") {
    const record = input.progress as Partial<JobProgressPayload>;
    const stage = (record.stage as PipelineStage | undefined) ?? "QUEUED";
    return {
      jobId: record.jobId || jobId,
      episodeId: record.episodeId || episodeId,
      stage,
      progressPercent:
        typeof record.progressPercent === "number" ? record.progressPercent : 0,
      hlsMasterUrl: record.hlsMasterUrl ?? returned?.hlsUrl ?? returned?.hlsManifestPath,
      error: record.error,
    };
  }

  const percent =
    typeof input.progress === "number" && Number.isFinite(input.progress)
      ? input.progress
      : 0;
  const hlsMasterUrl = returned?.hlsUrl ?? returned?.hlsManifestPath;
  const stage =
    returned?.status === "EPG_PUBLISHED"
      ? "EPG_PUBLISHED"
      : stageFromPercent(percent);

  return {
    jobId,
    episodeId,
    stage,
    progressPercent: percent,
    hlsMasterUrl,
  };
}

export async function readStudioJobProgress(
  job: Pick<
    Job<StudioRenderJobData>,
    "id" | "data" | "progress" | "returnvalue" | "failedReason" | "getState"
  > | null,
): Promise<JobProgressPayload | null> {
  if (!job) return null;
  const state = await job.getState();
  if (state === "failed") {
    return toJobProgressPayload({
      id: job.id,
      data: job.data,
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason || "Studio render failed",
    });
  }
  return toJobProgressPayload({
    id: job.id,
    data: job.data,
    progress: job.progress,
    returnvalue: job.returnvalue,
  });
}

export function streamStudioJobEvents(input: {
  jobId: string;
  readProgress: () => Promise<JobProgressPayload | null>;
  intervalMs?: number;
}): ReadableStream<Uint8Array> {
  const intervalMs = input.intervalMs ?? 500;
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let inflight = false;
  let lastSerialized = "";

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async () => {
        if (closed || inflight) return;
        inflight = true;
        try {
          const payload = await input.readProgress();
          if (!payload) {
            controller.enqueue(
              encodeStudioProgressEvent({
                jobId: input.jobId,
                episodeId: "",
                stage: "FAILED",
                progressPercent: 0,
                error: "Job not found",
              }),
            );
            closed = true;
            if (timer) clearInterval(timer);
            controller.close();
            return;
          }
          const serialized = JSON.stringify(payload);
          if (serialized === lastSerialized) return;
          lastSerialized = serialized;
          controller.enqueue(encodeStudioProgressEvent(payload));
          if (isTerminalPipelineStage(payload.stage)) {
            closed = true;
            if (timer) clearInterval(timer);
            controller.close();
          }
        } finally {
          inflight = false;
        }
      };
      void send();
      timer = setInterval(() => {
        void send();
      }, intervalMs);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });
}
