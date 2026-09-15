CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  channel_number INTEGER NOT NULL,
  channel_name TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  type TEXT NOT NULL,
  video_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  slot_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS viewer_analytics (
  id SERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  watch_time_seconds INTEGER NOT NULL,
  switched_from_channel_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
