import { Pool } from "pg";
import type { ChannelNetworkConfig } from "../playout/multiChannelEngine";

let pool: Pool | undefined;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/cable_network",
    });
  }
  return pool;
}

/** Lazy PostgreSQL pool — connects on first query, not at import time. */
export const dbPool: Pool = new Proxy({} as Pool, {
  get(_target, property, receiver) {
    const real = getDbPool();
    const value = Reflect.get(real, property, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export class CableDatabaseEngine {
  /**
   * Load all channels and their scheduled segments from PostgreSQL
   */
  public static async loadAllNetworks(): Promise<ChannelNetworkConfig[]> {
    const channelRes = await dbPool.query(
      `SELECT id, channel_number, channel_name, category FROM channels ORDER BY channel_number ASC`,
    );

    const networks: ChannelNetworkConfig[] = [];

    for (const ch of channelRes.rows) {
      const segmentRes = await dbPool.query(
        `SELECT id, title, creator_name, type, video_url, duration_seconds 
         FROM segments 
         WHERE channel_id = $1 
         ORDER BY slot_order ASC`,
        [ch.id],
      );

      networks.push({
        channelId: ch.id,
        channelNumber: ch.channel_number,
        channelName: ch.channel_name,
        category: ch.category,
        stationBugLogoUrl: "",
        programmingGrid: segmentRes.rows.map((row) => ({
          id: row.id,
          title: row.title,
          creatorName: row.creator_name,
          type: row.type,
          videoUrl: row.video_url,
          durationSeconds: row.duration_seconds,
        })),
      });
    }

    return networks;
  }

  /**
   * Persist full network configuration back to PostgreSQL
   */
  public static async saveAllNetworks(
    networks: ChannelNetworkConfig[],
  ): Promise<void> {
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");

      for (const net of networks) {
        await client.query(
          `INSERT INTO channels (id, channel_number, channel_name, category)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE 
           SET channel_number = EXCLUDED.channel_number,
               channel_name = EXCLUDED.channel_name,
               category = EXCLUDED.category`,
          [net.channelId, net.channelNumber, net.channelName, net.category],
        );

        await client.query(`DELETE FROM segments WHERE channel_id = $1`, [
          net.channelId,
        ]);

        for (let i = 0; i < net.programmingGrid.length; i++) {
          const seg = net.programmingGrid[i];
          if (!seg) continue;
          await client.query(
            `INSERT INTO segments (id, channel_id, title, creator_name, type, video_url, duration_seconds, slot_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              seg.id,
              net.channelId,
              seg.title,
              seg.creatorName || "Unknown",
              seg.type,
              seg.videoUrl,
              seg.durationSeconds,
              i + 1,
            ],
          );
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Log real-time channel switching and viewer retention telemetry
   */
  public static async logViewerTelemetry(
    channelId: string,
    segmentId: string,
    viewerId: string,
    watchTimeSeconds: number,
    previousChannelId?: string,
  ): Promise<void> {
    await dbPool.query(
      `INSERT INTO viewer_analytics (channel_id, segment_id, viewer_id, watch_time_seconds, switched_from_channel_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        channelId,
        segmentId,
        viewerId,
        watchTimeSeconds,
        previousChannelId || null,
      ],
    );
  }
}
