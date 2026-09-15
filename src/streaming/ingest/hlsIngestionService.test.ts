import { afterEach, describe, expect, it, vi } from "vitest";
import { HlsIngestionPipeline } from "./hlsIngestionService";
import { getStreamingEngine } from "../server/apiRoutes";

describe("HlsIngestionPipeline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("appends an approved source onto an existing channel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "Ignored" }),
      }),
    );

    const before =
      getStreamingEngine().getChannel("ch-atx-01")?.programmingGrid.length ?? 0;
    const result = await HlsIngestionPipeline.processAndIngestVideo({
      title: "ATX Live Sessions: Ep 5",
      creatorName: "Yeshua Throne",
      channelId: "ch-atx-01",
      sourceVideoUrl: "https://cdn.worfi.tv/hls/vid-8831/index.m3u8",
    });

    expect(result.channelId).toBe("ch-atx-01");
    expect(result.hlsPlaylistUrl).toBe(
      "https://cdn.worfi.tv/hls/vid-8831/index.m3u8",
    );
    expect(result.segment.title).toBe("ATX Live Sessions: Ep 5");
    expect(
      getStreamingEngine().getChannel("ch-atx-01")?.programmingGrid.length,
    ).toBe(before + 1);
  });

  it("rejects unknown channels", async () => {
    await expect(
      HlsIngestionPipeline.processAndIngestVideo({
        title: "Ghost",
        creatorName: "Net",
        channelId: "missing",
        sourceVideoUrl: "https://example.com/a.mp4",
      }),
    ).rejects.toThrow(/not found/);
  });
});
