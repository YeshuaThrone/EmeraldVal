import type { ScheduledAsset, ScheduledSlot } from "./hlsMasterGenerator";

export type { ScheduledAsset, ScheduledSlot };

/**
 * Linear looping scheduler for HLS media playlists. Walks a sequence of
 * assets the same way MultiChannelEngine walks a programming grid.
 */
export class ChannelScheduler {
  private assets: ScheduledAsset[];

  constructor(assets: ScheduledAsset[] = []) {
    this.assets = assets;
  }

  public setAssets(assets: ScheduledAsset[]): void {
    this.assets = assets;
  }

  public resolveCurrentSlot(now: Date = new Date()): ScheduledSlot {
    const totalLoopDuration = this.assets.reduce(
      (acc, asset) => acc + asset.durationSeconds,
      0,
    );
    if (this.assets.length === 0 || totalLoopDuration <= 0) {
      throw new Error("Channel has no scheduled assets");
    }

    const loopOffsetSec = Math.floor(now.getTime() / 1000) % totalLoopDuration;
    let accumulatedSec = 0;
    const epochStartMs =
      now.getTime() - loopOffsetSec * 1000;

    for (const asset of this.assets) {
      const nextAccumulated = accumulatedSec + asset.durationSeconds;
      if (loopOffsetSec >= accumulatedSec && loopOffsetSec < nextAccumulated) {
        return {
          asset,
          startTime: new Date(epochStartMs + accumulatedSec * 1000),
          offsetSeconds: loopOffsetSec - accumulatedSec,
        };
      }
      accumulatedSec = nextAccumulated;
    }

    const first = this.assets[0];
    if (!first) {
      throw new Error("Channel has no scheduled assets");
    }
    return {
      asset: first,
      startTime: new Date(epochStartMs),
      offsetSeconds: 0,
    };
  }
}
