import { Pool } from "pg";
import type { ChannelNetworkConfig } from "../playout/multiChannelEngine";

/** True when Postgres is missing, unreachable, or missing WORFI tables. */
export function isUnavailableDb(err: unknown): boolean {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "28P01" ||
    code === "3D000" ||
    code === "42P01"
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /ECONNREFUSED|ENOTFOUND|connect ECONNREFUSED|timeout|does not exist|password authentication|the database system is starting/i.test(
    message,
  );
}

let pool: Pool | undefined;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgres://worfi_admin:worfi_dev_password@localhost:5432/worfi_db",
      connectionTimeoutMillis: 2500,
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

  public static async loadViewerAnalytics(): Promise<{
    totalWatchSeconds: number;
    uniqueViewers: number;
    channelSwitches: number;
    byChannel: Array<{ channelId: string; watchSeconds: number; views: number }>;
    bySegment: Array<{ segmentId: string; watchSeconds: number; views: number }>;
  }> {
    const totals = await dbPool.query(
      `SELECT
         COALESCE(SUM(watch_time_seconds), 0)::int AS watch_seconds,
         COUNT(DISTINCT viewer_id)::int AS unique_viewers,
         COUNT(*) FILTER (WHERE switched_from_channel_id IS NOT NULL)::int AS switches
       FROM viewer_analytics`,
    );
    const byChannel = await dbPool.query(
      `SELECT channel_id AS id,
              COALESCE(SUM(watch_time_seconds), 0)::int AS watch_seconds,
              COUNT(*)::int AS views
       FROM viewer_analytics
       GROUP BY channel_id
       ORDER BY watch_seconds DESC`,
    );
    const bySegment = await dbPool.query(
      `SELECT segment_id AS id,
              COALESCE(SUM(watch_time_seconds), 0)::int AS watch_seconds,
              COUNT(*)::int AS views
       FROM viewer_analytics
       GROUP BY segment_id
       ORDER BY watch_seconds DESC`,
    );
    const row = totals.rows[0] ?? {};
    return {
      totalWatchSeconds: Number(row.watch_seconds ?? 0),
      uniqueViewers: Number(row.unique_viewers ?? 0),
      channelSwitches: Number(row.switches ?? 0),
      byChannel: byChannel.rows.map((r) => ({
        channelId: String(r.id ?? "unknown"),
        watchSeconds: Number(r.watch_seconds ?? 0),
        views: Number(r.views ?? 0),
      })),
      bySegment: bySegment.rows.map((r) => ({
        segmentId: String(r.id ?? "unknown"),
        watchSeconds: Number(r.watch_seconds ?? 0),
        views: Number(r.views ?? 0),
      })),
    };
  }

  public static async insertAdCampaign(campaign: {
    id: string;
    advertiserName: string;
    campaignName: string;
    cpmRate: number;
    totalBudget: number;
    startTime?: Date | null;
    endTime?: Date | null;
  }): Promise<void> {
    await dbPool.query(
      `INSERT INTO ad_campaigns (
         id, advertiser_name, campaign_name, cpm_rate, total_budget, spent_budget,
         start_time, end_time, is_active
       ) VALUES ($1, $2, $3, $4, $5, 0.00, $6, $7, true)`,
      [
        campaign.id,
        campaign.advertiserName,
        campaign.campaignName,
        campaign.cpmRate,
        campaign.totalBudget,
        campaign.startTime ?? null,
        campaign.endTime ?? null,
      ],
    );
  }

  /**
   * Records a completed ad playout and increments campaign spend by CPM / 1000.
   */
  public static async recordAdImpression(input: {
    campaignId: string;
    channelId: string;
    viewerId?: string;
    adDurationSeconds: number;
    cpmRate: number;
    completedPlayout?: boolean;
  }): Promise<{ cpmEarned: number }> {
    const cpmEarned = Number((input.cpmRate / 1000).toFixed(4));
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO ad_impressions (
           campaign_id, channel_id, viewer_id, ad_duration_seconds, cpm_earned, completed_playout
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.campaignId,
          input.channelId,
          input.viewerId ?? null,
          input.adDurationSeconds,
          cpmEarned,
          input.completedPlayout ?? true,
        ],
      );
      await client.query(
        `UPDATE ad_campaigns
         SET spent_budget = spent_budget + $1
         WHERE id = $2`,
        [cpmEarned, input.campaignId],
      );
      await client.query("COMMIT");
      return { cpmEarned };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  public static async loadAdCampaigns(): Promise<
    Array<{
      id: string;
      advertiserName: string;
      campaignName: string;
      cpmRate: number;
      totalBudget: number;
      spentBudget: number;
      isActive: boolean;
    }>
  > {
    const res = await dbPool.query(
      `SELECT id, advertiser_name, campaign_name, cpm_rate, total_budget, spent_budget, is_active
       FROM ad_campaigns
       ORDER BY campaign_name ASC`,
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      advertiserName: String(row.advertiser_name),
      campaignName: String(row.campaign_name),
      cpmRate: Number(row.cpm_rate ?? 0),
      totalBudget: Number(row.total_budget ?? 0),
      spentBudget: Number(row.spent_budget ?? 0),
      isActive: Boolean(row.is_active),
    }));
  }
}
