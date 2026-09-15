import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoMetadataExtractor } from "./videoMetadataExtractor";

describe("VideoMetadataExtractor.parseVideoUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates YouTube metadata from oEmbed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          title: "East Side Lofts",
          author_name: "Maya Ellison",
        }),
      }),
    );

    const meta = await VideoMetadataExtractor.parseVideoUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "Network",
    );

    expect(meta.title).toBe("East Side Lofts");
    expect(meta.creatorName).toBe("Maya Ellison");
    expect(meta.cleanStreamUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(meta.thumbnailUrl).toContain("dQw4w9WgXcQ");
    expect(meta.isEmbeddable).toBe(true);
    expect(meta.durationSeconds).toBe(600);
  });

  it("falls back when oEmbed fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const meta = await VideoMetadataExtractor.parseVideoUrl(
      "https://youtu.be/dQw4w9WgXcQ",
      "Haven",
    );

    expect(meta.title).toBe("Network Video Feature");
    expect(meta.creatorName).toBe("Haven");
    expect(meta.durationSeconds).toBe(300);
  });

  it("passes through direct MP4 URLs", async () => {
    const meta = await VideoMetadataExtractor.parseVideoUrl(
      "https://cdn.example.com/show.mp4",
      "Ada",
    );
    expect(meta.title).toBe("Direct Stream Asset");
    expect(meta.cleanStreamUrl).toBe("https://cdn.example.com/show.mp4");
    expect(meta.creatorName).toBe("Ada");
  });
});
