import { describe, expect, it } from "vitest";
import {
  HLSMasterGenerator,
  type ScheduledAsset,
  type ScheduledSlot,
} from "./hlsMasterGenerator";

function slot(overrides: Partial<ScheduledAsset> & { offsetSeconds?: number } = {}): ScheduledSlot {
  const { offsetSeconds = 0, ...assetOverrides } = overrides;
  const asset: ScheduledAsset = {
    id: "asset-1",
    title: "Live Set",
    type: "CONTENT",
    streamUrl: "https://cdn.example.com/live-set",
    durationSeconds: 180,
    ...assetOverrides,
  };
  return {
    asset,
    startTime: new Date("2026-09-14T21:00:00Z"),
    offsetSeconds,
  };
}

describe("HLSMasterGenerator.generateLiveM3U8", () => {
  const generator = new HLSMasterGenerator();

  it("emits a live media playlist with a 3-segment sliding window", () => {
    const m3u8 = generator.generateLiveM3U8(slot({ offsetSeconds: 0 }));

    expect(m3u8).toContain("#EXTM3U");
    expect(m3u8).toContain("#EXT-X-VERSION:3");
    expect(m3u8).toContain("#EXT-X-TARGETDURATION:6");
    expect(m3u8).toContain("#EXT-X-MEDIA-SEQUENCE:0");
    expect(m3u8).toContain("#EXT-X-DISCONTINUITY-SEQUENCE:0");
    expect(m3u8).toContain("#EXTINF:6.0,");
    expect(m3u8).toContain("https://cdn.example.com/live-set/segment_0.ts");
    expect(m3u8).toContain("https://cdn.example.com/live-set/segment_1.ts");
    expect(m3u8).toContain("https://cdn.example.com/live-set/segment_2.ts");
    expect(m3u8).not.toContain("segment_3.ts");
  });

  it("advances MEDIA-SEQUENCE from elapsed offset", () => {
    const m3u8 = generator.generateLiveM3U8(slot({ offsetSeconds: 13 }));

    expect(m3u8).toContain("#EXT-X-MEDIA-SEQUENCE:2");
    expect(m3u8).toContain("segment_2.ts");
    expect(m3u8).toContain("segment_3.ts");
    expect(m3u8).toContain("segment_4.ts");
    expect(m3u8).not.toContain("segment_1.ts");
  });

  it("injects SCTE-35 cue-out/cue-in markers for ad slots", () => {
    const m3u8 = generator.generateLiveM3U8(
      slot({
        type: "AD",
        title: "Pre-roll",
        streamUrl: "https://cdn.example.com/ad",
        durationSeconds: 30,
        offsetSeconds: 0,
      }),
    );

    expect(m3u8).toContain("#EXT-OETF:SCTE35");
    expect(m3u8).toContain("#EXT-X-CUE-OUT:DURATION=30");
    expect(m3u8).toContain("#EXT-X-CUE-IN");
    expect(m3u8).toContain("https://cdn.example.com/ad/segment_0.ts");
  });

  it("omits SCTE-35 markers for content, music video, and promo assets", () => {
    for (const type of ["CONTENT", "MUSIC_VIDEO", "PROMO"] as const) {
      const m3u8 = generator.generateLiveM3U8(slot({ type }));
      expect(m3u8).not.toContain("#EXT-OETF:SCTE35");
      expect(m3u8).not.toContain("#EXT-X-CUE-OUT");
      expect(m3u8).not.toContain("#EXT-X-CUE-IN");
    }
  });

  it("shortens the window when fewer than 3 segments remain", () => {
    const m3u8 = generator.generateLiveM3U8(
      slot({ durationSeconds: 18, offsetSeconds: 12 }),
    );

    expect(m3u8).toContain("#EXT-X-MEDIA-SEQUENCE:2");
    expect(m3u8).toContain("segment_2.ts");
    expect(m3u8).not.toContain("segment_3.ts");
  });

  it("honors a custom target segment duration", () => {
    const custom = new HLSMasterGenerator(10);
    const m3u8 = custom.generateLiveM3U8(slot({ offsetSeconds: 25 }));

    expect(m3u8).toContain("#EXT-X-TARGETDURATION:10");
    expect(m3u8).toContain("#EXT-X-MEDIA-SEQUENCE:2");
    expect(m3u8).toContain("#EXTINF:10.0,");
  });
});
