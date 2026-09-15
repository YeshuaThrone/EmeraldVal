import { describe, expect, it } from "vitest";
import { VideoIngestionEngine } from "./ingestionEngine";

describe("VideoIngestionEngine", () => {
  it("builds a program segment from an ingest payload", async () => {
    const segment = await VideoIngestionEngine.processIngest({
      creatorName: "Ada",
      title: "Loft Session",
      videoUrl: "https://example.com/loft.mp4",
      socialHandle: "@ada",
      durationSeconds: 90,
      type: "SHOW",
    });

    expect(segment.creatorName).toBe("Ada");
    expect(segment.title).toBe("Loft Session");
    expect(segment.videoUrl).toBe("https://example.com/loft.mp4");
    expect(segment.durationSeconds).toBe(90);
    expect(segment.metadata?.socialHandle).toBe("@ada");
    expect(segment.id).toMatch(/^seg-/);
  });

  it("rejects incomplete payloads", async () => {
    await expect(VideoIngestionEngine.processIngest({})).rejects.toThrow(
      /required/,
    );
  });
});
