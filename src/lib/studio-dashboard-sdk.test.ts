import { describe, expect, it } from "vitest";
import {
  emitStudioJobProgress,
  streamStudioDashboardEvents,
  studioStreamer,
} from "./studio-dashboard-sdk";

describe("studioStreamer", () => {
  it("emits job-scoped progress for same-process listeners", async () => {
    const seen: unknown[] = [];
    studioStreamer.on("job:job-live", (update) => {
      seen.push(update);
    });
    emitStudioJobProgress("job-live", {
      jobId: "job-live",
      episodeId: "ep-42",
      stage: "MOTION_GENERATION",
      progressPercent: 40,
    });
    expect(seen).toHaveLength(1);
    studioStreamer.removeAllListeners("job:job-live");
  });

  it("streams CONNECTED then a terminal BullMQ payload", async () => {
    const stream = streamStudioDashboardEvents({
      jobId: "job-1",
      intervalMs: 10,
      readProgress: async () => ({
        jobId: "job-1",
        episodeId: "ep-42",
        stage: "EPG_PUBLISHED",
        progressPercent: 100,
      }),
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
    expect(text).toContain("CONNECTED");
    expect(text).toContain("EPG_PUBLISHED");
  });
});
