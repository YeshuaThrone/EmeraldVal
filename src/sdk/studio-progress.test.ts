import { describe, expect, it } from "vitest";
import {
  encodeStudioProgressEvent,
  streamStudioJobEvents,
  toJobProgressPayload,
} from "./studio-progress";
import type { JobProgressPayload, StudioRenderJobData } from "./studio-engine";

const jobData: StudioRenderJobData = {
  episodeId: "ep-42",
  showId: "show-wurfi",
  rodecasterAudioPath: "/tmp/internal-studio/ep-42/master.wav",
  shotCards: [],
  outputDir: "/tmp/internal-studio/ep-42",
  requestedBy: "3bbullion@gmail.com",
};

describe("toJobProgressPayload", () => {
  it("passes through object progress from the worker", () => {
    expect(
      toJobProgressPayload({
        id: "job-1",
        data: jobData,
        progress: {
          jobId: "job-1",
          episodeId: "ep-42",
          stage: "MOTION_GENERATION",
          progressPercent: 40,
        },
      }),
    ).toMatchObject({ stage: "MOTION_GENERATION", progressPercent: 40 });
  });

  it("maps failedReason to FAILED", () => {
    expect(
      toJobProgressPayload({
        id: "job-1",
        data: jobData,
        progress: 15,
        failedReason: "ffmpeg missing",
      }),
    ).toMatchObject({ stage: "FAILED", error: "ffmpeg missing" });
  });
});

describe("streamStudioJobEvents", () => {
  it("emits SSE payloads and closes on a terminal stage", async () => {
    const reads: JobProgressPayload[] = [
      {
        jobId: "job-1",
        episodeId: "ep-42",
        stage: "QUEUED",
        progressPercent: 0,
      },
      {
        jobId: "job-1",
        episodeId: "ep-42",
        stage: "EPG_PUBLISHED",
        progressPercent: 100,
        hlsMasterUrl: "/tmp/internal-studio/ep-42/hls/index.m3u8",
      },
    ];
    const stream = streamStudioJobEvents({
      jobId: "job-1",
      intervalMs: 10,
      readProgress: async () => reads.shift() ?? null,
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }
    const text = chunks.join("");
    expect(text).toContain("QUEUED");
    expect(text).toContain("EPG_PUBLISHED");
    expect(text).toContain("data: ");
  });

  it("encodes data: JSON SSE frames", () => {
    const encoded = encodeStudioProgressEvent({
      jobId: "job-1",
      episodeId: "ep-42",
      stage: "QUEUED",
      progressPercent: 0,
    });
    const text = new TextDecoder().decode(encoded);
    expect(text.startsWith("data: ")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(true);
  });
});
