import { dbPool } from "../db/dbEngine";
import type { ProgramSegment } from "./multiChannelEngine";

export interface StationBumper {
  id: string;
  title: string;
  creatorName: string;
  type: "STATION_ID" | "PROMO" | "UP_NEXT_BUMPER" | "STATIC_FILL";
  videoUrl: string;
  durationSeconds: number;
}

const TARGET_SLOT_BLOCK_SECONDS = 1800; // Standard 30-minute broadcast block

export function bumperTypeToSegmentType(
  type: StationBumper["type"],
): ProgramSegment["type"] {
  if (type === "STATION_ID") return "STATION_ID";
  if (type === "PROMO") return "CREATOR_PROMO";
  return "INTERLUDE";
}

export class InterstitialGenerator {
  /**
   * Generates dynamic SVG-based retro bumper video overlays or selects pre-rendered station ID clips
   */
  public static getPresetBumper(
    channelName: string,
    channelNumber: number,
    durationSeconds: number,
  ): StationBumper {
    const bumperId = `bmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (durationSeconds <= 15) {
      return {
        id: bumperId,
        title: `STATION IDENT • CH ${String(channelNumber).padStart(2, "0")}`,
        creatorName: "WORFI NETWORK",
        type: "STATION_ID",
        videoUrl: "https://cdn.worfi.tv/bumpers/short_station_id_10s.mp4",
        durationSeconds,
      };
    }

    if (durationSeconds <= 60) {
      return {
        id: bumperId,
        title: `STAY TUNED TO ${channelName.toUpperCase()}`,
        creatorName: "WORFI NETWORK",
        type: "UP_NEXT_BUMPER",
        videoUrl: "https://cdn.worfi.tv/bumpers/up_next_promo_30s.mp4",
        durationSeconds,
      };
    }

    return {
      id: bumperId,
      title: "WORFI BROADCAST INTERSTITIAL",
      creatorName: "WORFI NETWORK",
      type: "PROMO",
      videoUrl: "https://cdn.worfi.tv/bumpers/network_promo_60s.mp4",
      durationSeconds,
    };
  }

  /**
   * Scans a channel schedule grid for timing gaps and auto-fills them with bumpers
   */
  public static async autoBridgeScheduleGaps(
    channelId: string,
    channelName: string,
    channelNumber: number,
  ): Promise<number> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query(
        `SELECT id, title, duration_seconds, slot_order 
         FROM segments 
         WHERE channel_id = $1 
         ORDER BY slot_order ASC`,
        [channelId],
      );

      const segments = res.rows as Array<{
        id: string;
        title: string;
        duration_seconds: number;
        slot_order: number;
      }>;
      if (segments.length === 0) {
        await client.query("COMMIT");
        return 0;
      }

      let insertedCount = 0;
      const currentBlockTime = segments.reduce(
        (sum, seg) => sum + Number(seg.duration_seconds),
        0,
      );

      const gapSeconds =
        TARGET_SLOT_BLOCK_SECONDS -
        (currentBlockTime % TARGET_SLOT_BLOCK_SECONDS);

      if (gapSeconds > 5 && gapSeconds < TARGET_SLOT_BLOCK_SECONDS) {
        const bumper = this.getPresetBumper(
          channelName,
          channelNumber,
          gapSeconds,
        );
        const last = segments[segments.length - 1];
        if (!last) {
          await client.query("COMMIT");
          return 0;
        }
        const nextSlotOrder = last.slot_order + 1;

        await client.query(
          `INSERT INTO segments (id, channel_id, title, creator_name, type, video_url, duration_seconds, slot_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            bumper.id,
            channelId,
            bumper.title,
            bumper.creatorName,
            bumperTypeToSegmentType(bumper.type),
            bumper.videoUrl,
            bumper.durationSeconds,
            nextSlotOrder,
          ],
        );

        insertedCount += 1;
        console.log(
          `[Bumper Engine] Bridged ${gapSeconds}s gap on ${channelId} with ${bumper.title}`,
        );
      }

      await client.query("COMMIT");
      return insertedCount;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[Bumper Engine] Error bridging schedule gaps:", err);
      throw err;
    } finally {
      client.release();
    }
  }
}
