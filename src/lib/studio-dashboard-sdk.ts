import { EventEmitter } from "node:events";
import type { JobProgressPayload } from "@/sdk/studio-engine";
import {
  encodeStudioProgressEvent,
  isTerminalPipelineStage,
} from "@/sdk/studio-progress";

/**
 * In-process progress bus for same-runtime listeners.
 * Cross-process staff SSE still reads BullMQ job.progress.
 */
export const studioStreamer = new EventEmitter();
studioStreamer.setMaxListeners(100);

export function emitStudioJobProgress(
  jobId: string,
  update: JobProgressPayload | Record<string, unknown>,
): void {
  if (!jobId) return;
  studioStreamer.emit(`job:${jobId}`, update);
}

export function streamStudioDashboardEvents(input: {
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
      const closeStream = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        studioStreamer.off(`job:${input.jobId}`, handleProgress);
        try {
          controller.close();
        } catch {
          // The client may have already cancelled the stream.
        }
      };

      const send = (data: object) => {
        if (closed) return;
        const serialized = JSON.stringify(data);
        if (serialized === lastSerialized) return;
        lastSerialized = serialized;
        try {
          controller.enqueue(
            encodeStudioProgressEvent(data as JobProgressPayload),
          );
        } catch {
          closeStream();
        }
      };

      const handleProgress = (update: unknown) => {
        send(update as object);
        const stage = (update as { stage?: string }).stage;
        if (
          stage === "EPG_PUBLISHED" ||
          stage === "FAILED" ||
          isTerminalPipelineStage(stage as JobProgressPayload["stage"])
        ) {
          closeStream();
        }
      };

      send({
        jobId: input.jobId,
        status: "CONNECTED",
        stage: "QUEUED",
        progressPercent: 0,
        message: "Listening for render progress updates...",
      });

      studioStreamer.on(`job:${input.jobId}`, handleProgress);

      const poll = async () => {
        if (closed || inflight) return;
        inflight = true;
        try {
          const payload = await input.readProgress();
          if (!payload) return;
          handleProgress(payload);
        } finally {
          inflight = false;
        }
      };

      void poll();
      timer = setInterval(() => {
        void poll();
      }, intervalMs);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
      studioStreamer.removeAllListeners(`job:${input.jobId}`);
    },
  });
}
