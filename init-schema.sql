CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(64) PRIMARY KEY,
  channel_number INT UNIQUE NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

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

CREATE TABLE IF NOT EXISTS creator_invites (
  id VARCHAR(64) PRIMARY KEY,
  token VARCHAR(128) UNIQUE NOT NULL,
  creator_name VARCHAR(255) NOT NULL,
  creator_email VARCHAR(255) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS viewer_analytics (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(64) REFERENCES channels(id) ON DELETE SET NULL,
  segment_id VARCHAR(64) REFERENCES segments(id) ON DELETE SET NULL,
  viewer_id VARCHAR(128) NOT NULL,
  watch_time_seconds INT DEFAULT 0,
  switched_from_channel_id VARCHAR(64),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ad Campaigns & Advertisers
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

-- Real-Time Ad Impression Telemetry
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

CREATE TABLE IF NOT EXISTS channel_programs (
  id BIGSERIAL PRIMARY KEY,
  channel_id VARCHAR(64) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  creator_name VARCHAR(255) NOT NULL,
  stream_url TEXT NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
  UNIQUE (channel_id, stream_url)
);

INSERT INTO channels (id, channel_number, channel_name, category, is_active)
VALUES
  ('ch-01', 1, 'WURFI MAIN', 'ATX Live Sessions', true),
  ('ch-02', 2, 'NASA TV', 'Public Domain', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO channel_programs (channel_id, title, creator_name, stream_url, duration_seconds)
VALUES 
  ('ch-01', 'Tears of Steel (4K Sci-Fi)', 'Blender Studio', 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', 734),
  ('ch-01', 'Big Buck Bunny', 'Blender Studio', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 596),
  ('ch-02', 'NASA Live HD Feed', 'NASA / Public Domain', 'https://nasa-vh.akamaihd.net/i/NASA_TV@47068/master.m3u8', 86400)
ON CONFLICT DO NOTHING;

INSERT INTO segments (id, channel_id, title, creator_name, type, video_url, duration_seconds, slot_order)
VALUES
  ('prog-tears', 'ch-01', 'Tears of Steel (4K Sci-Fi)', 'Blender Studio', 'SHOW', 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', 734, 1),
  ('prog-bunny', 'ch-01', 'Big Buck Bunny', 'Blender Studio', 'SHOW', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 596, 2),
  ('prog-nasa', 'ch-02', 'NASA Live HD Feed', 'NASA / Public Domain', 'SHOW', 'https://nasa-vh.akamaihd.net/i/NASA_TV@47068/master.m3u8', 86400, 1)
ON CONFLICT (id) DO NOTHING;
