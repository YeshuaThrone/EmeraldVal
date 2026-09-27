import {
  calculateLiveStreamOffset,
  currentScheduledProgram,
  generate24HourSchedule,
  utcDayStart,
} from "../sdk/wurfi-sdk";
import type { ScheduledAsset, ScheduledSlot } from "./hlsMasterGenerator";

export type { ScheduledAsset, ScheduledSlot };

/**
 * Linear 24-hour EPG scheduler. Loops the catalog into a gapless UTC day,
 * then resolves the live slot from wall-clock time.
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
    const catalog = this.assets.filter((asset) => asset.durationSeconds > 0);
    if (catalog.length === 0) {
      throw new Error("Channel has no scheduled assets");
    }

    const schedule = generate24HourSchedule(
      catalog.map((asset) => ({
        id: asset.id,
        title: asset.title,
        durationSeconds: asset.durationSeconds,
      })),
      utcDayStart(now),
    );
    const current =
      currentScheduledProgram(schedule, now) ?? schedule.at(-1) ?? null;
    if (!current) {
      throw new Error("Channel has no scheduled assets");
    }

    const asset =
      this.assets.find((item) => item.id === current.program_id) ?? catalog[0]!;
    const durationSeconds =
      (Date.parse(current.end_time_utc) - Date.parse(current.start_time_utc)) /
      1000;

    return {
      asset,
      startTime: new Date(current.start_time_utc),
      offsetSeconds: calculateLiveStreamOffset(
        current.start_time_utc,
        durationSeconds,
        now.getTime(),
      ),
    };
  }
}
