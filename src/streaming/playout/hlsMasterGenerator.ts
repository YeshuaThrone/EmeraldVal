export interface ScheduledAsset {
  id: string;
  title: string;
  type: "CONTENT" | "MUSIC_VIDEO" | "AD" | "PROMO";
  streamUrl: string;
  durationSeconds: number;
}

export interface ScheduledSlot {
  asset: ScheduledAsset;
  startTime: Date;
  offsetSeconds: number;
}

export class HLSMasterGenerator {
  private targetSegmentDurationSec: number;

  constructor(targetSegmentDurationSec: number = 6) {
    this.targetSegmentDurationSec = targetSegmentDurationSec;
  }

  /**
   * Generates a live HLS M3U8 manifest with SCTE-35 markers for ad servers
   */
  public generateLiveM3U8(currentlyPlaying: ScheduledSlot): string {
    const asset = currentlyPlaying.asset;
    const elapsedSec = currentlyPlaying.offsetSeconds;

    const currentSegmentIndex = Math.floor(
      elapsedSec / this.targetSegmentDurationSec,
    );
    const totalSegments = Math.ceil(
      asset.durationSeconds / this.targetSegmentDurationSec,
    );

    let m3u8 = `#EXTM3U\n`;
    m3u8 += `#EXT-X-VERSION:3\n`;
    m3u8 += `#EXT-X-TARGETDURATION:${this.targetSegmentDurationSec}\n`;
    m3u8 += `#EXT-X-MEDIA-SEQUENCE:${currentSegmentIndex}\n`;
    m3u8 += `#EXT-X-DISCONTINUITY-SEQUENCE:0\n\n`;

    // SCTE-35 Ad Splice Trigger (For Google Ad Manager / SpringServe)
    if (asset.type === "AD") {
      m3u8 += `#EXT-OETF:SCTE35\n`;
      m3u8 += `#EXT-X-CUE-OUT:DURATION=${asset.durationSeconds}\n`;
    }

    // Sliding window buffer (3 segments ahead)
    for (
      let i = currentSegmentIndex;
      i < Math.min(currentSegmentIndex + 3, totalSegments);
      i++
    ) {
      const segmentUrl = `${asset.streamUrl}/segment_${i}.ts`;
      m3u8 += `#EXTINF:${this.targetSegmentDurationSec}.0,\n`;
      m3u8 += `${segmentUrl}\n`;
    }

    if (asset.type === "AD") {
      m3u8 += `#EXT-X-CUE-IN\n`;
    }

    return m3u8;
  }
}
