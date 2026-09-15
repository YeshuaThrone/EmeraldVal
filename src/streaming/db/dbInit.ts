import { dbPool } from "./dbEngine";

export async function initializeDatabase(): Promise<void> {
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    // Enable UUID extension if supported
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Channels table
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(64) PRIMARY KEY,
        channel_number INT UNIQUE NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(
      `ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`,
    );

    // Segments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS segments (
        id VARCHAR(64) PRIMARY KEY,
        channel_id VARCHAR(64) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        creator_name VARCHAR(255) NOT NULL DEFAULT 'Unknown',
        type VARCHAR(32) NOT NULL CHECK (type IN ('SHOW', 'CREATOR_PROMO', 'STATION_ID', 'INTERLUDE')),
        video_url TEXT NOT NULL,
        duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
        slot_order INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Creator Invites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_invites (
        id VARCHAR(64) PRIMARY KEY,
        token VARCHAR(128) UNIQUE NOT NULL,
        creator_name VARCHAR(255) NOT NULL,
        creator_email VARCHAR(255) NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Viewer Analytics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS viewer_analytics (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(64) REFERENCES channels(id) ON DELETE SET NULL,
        segment_id VARCHAR(64) REFERENCES segments(id) ON DELETE SET NULL,
        viewer_id VARCHAR(128) NOT NULL,
        watch_time_seconds INT DEFAULT 0,
        switched_from_channel_id VARCHAR(64),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ad Campaigns & Advertisers
    await client.query(`
      CREATE TABLE IF NOT EXISTS ad_campaigns (
        id VARCHAR(64) PRIMARY KEY,
        advertiser_name VARCHAR(255) NOT NULL,
        campaign_name VARCHAR(255) NOT NULL,
        cpm_rate NUMERIC(10, 2) NOT NULL,
        total_budget NUMERIC(12, 2) NOT NULL,
        spent_budget NUMERIC(12, 2) DEFAULT 0.00,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true
      );
    `);

    // Real-Time Ad Impression Telemetry
    await client.query(`
      CREATE TABLE IF NOT EXISTS ad_impressions (
        id BIGSERIAL PRIMARY KEY,
        campaign_id VARCHAR(64) REFERENCES ad_campaigns(id),
        channel_id VARCHAR(64) REFERENCES channels(id),
        viewer_id VARCHAR(100),
        ad_duration_seconds INT NOT NULL,
        cpm_earned NUMERIC(8, 4) NOT NULL,
        completed_playout BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query("COMMIT");
    console.log("[DB] PostgreSQL schema initialized successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[DB] Schema initialization failed:", error);
    throw error;
  } finally {
    client.release();
  }
}
