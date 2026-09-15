import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoIngestionEngine } from "./ingestionEngine";

describe("VideoIngestionEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes through hosted MP4 URLs", async () => {
    const segment = await VideoIngestionEngine.processIngest({
      creatorName: "Ada",
      sourceUrl: "https://example.com/loft.mp4",
      titleOverride: "Loft Session",
      socialHandle: "@ada",
      customDurationSeconds: 90,
      type: "SHOW",
    });

    expect(segment.creatorName).toBe("Ada");
    expect(segment.title).toBe("Loft Session");
    expect(segment.videoUrl).toBe("https://example.com/loft.mp4");
    expect(segment.durationSeconds).toBe(90);
    expect(segment.metadata?.socialHandle).toBe("@ada");
    expect(segment.id).toMatch(/^asset-/);
  });

  it("normalizes YouTube watch URLs to embed endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "Night Market Set", author_name: "Jordan" }),
      }),
    );
    const segment = await VideoIngestionEngine.processIngest({
      creatorName: "Jordan",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });

    expect(segment.videoUrl).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0&mute=1",
    );
    expect(segment.title).toBe("Night Market Set");
    expect(segment.durationSeconds).toBe(600);
    expect(segment.type).toBe("SHOW");
  });

  it("accepts onboarding aliases (videoUrl / title / durationSeconds)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "Ignored oEmbed Title" }),
      }),
    );
    const segment = await VideoIngestionEngine.processIngest({
      creatorName: "Maya",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      title: "East Side Lofts",
      durationSeconds: 120,
    });

    expect(segment.title).toBe("East Side Lofts");
    expect(segment.videoUrl).toContain("/embed/dQw4w9WgXcQ");
    expect(segment.durationSeconds).toBe(120);
  });

  it("rejects incomplete payloads", async () => {
    await expect(VideoIngestionEngine.processIngest({})).rejects.toThrow(
      /required/,
    );
  });
});
