import { dbPool } from "../db/dbEngine";
import {
  bumperTypeToSegmentType,
  InterstitialGenerator,
} from "../playout/interstitialGenerator";
import type { ChannelNetworkConfig } from "../playout/multiChannelEngine";
import { getStreamingEngine } from "../server/apiRoutes";

export interface LineupChannelRow {
  id: string;
  channel_number: number;
  channel_name: string;
  category: string;
}

export interface ProvisionedChannel {
  channelId: string;
  channelNumber: number;
  channelName: string;
  category: string;
}

export interface GapBridgeResult {
  inserted: number;
  processed: number;
}

const TARGET_SLOT_BLOCK_SECONDS = 1800;

export function buildCustomChannelId(
  channelNumber: number,
  channelName: string,
): string {
  const slug = channelName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "");
  return `ch-${String(channelNumber).padStart(2, "0")}-${slug}`;
}

export async function listLineupChannels(): Promise<LineupChannelRow[]> {
  try {
    const res = await dbPool.query(
      `SELECT id, channel_number, channel_name, category
       FROM channels
       WHERE is_active = true
       ORDER BY channel_number ASC`,
    );
    return (res.rows as LineupChannelRow[]).map((row) => ({
      id: String(row.id),
      channel_number: Number(row.channel_number),
      channel_name: String(row.channel_name),
      category: String(row.category),
    }));
  } catch {
    return getStreamingEngine()
      .getChannelList()
      .map((ch) => ({
        id: ch.id,
        channel_number: ch.number,
        channel_name: ch.name,
        category: ch.category,
      }));
  }
}

export async function provisionCustomChannel(input: {
  channelNumber?: unknown;
  channelName?: unknown;
  category?: unknown;
}): Promise<ProvisionedChannel> {
  const channelNumber = Number(input.channelNumber);
  const channelName = String(input.channelName ?? "").trim();
  const category = String(input.category ?? "CUSTOM").trim() || "CUSTOM";

  if (!Number.isFinite(channelNumber) || channelNumber <= 0) {
    throw new Error("channelNumber is required");
  }
  if (!channelName) {
    throw new Error("channelName is required");
  }

  const channelId = buildCustomChannelId(channelNumber, channelName);

  try {
    await dbPool.query(
      `INSERT INTO channels (id, channel_number, channel_name, category, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [channelId, channelNumber, channelName, category],
    );
  } catch (err) {
    if (!isUnavailableDb(err)) {
      throw new Error("Failed to create custom channel");
    }
  }

  const network: ChannelNetworkConfig = {
    channelId,
    channelNumber,
    channelName,
    category,
    stationBugLogoUrl: "",
    programmingGrid: [],
  };
  getStreamingEngine().registerChannel(network);

  return { channelId, channelNumber, channelName, category };
}

export async function bridgeActiveChannelGaps(
  channelId?: string,
): Promise<GapBridgeResult> {
  const targets = await resolveChannelsToBridge(channelId);
  let inserted = 0;

  for (const ch of targets) {
    try {
      inserted += await InterstitialGenerator.autoBridgeScheduleGaps(
        ch.id,
        ch.channel_name,
        ch.channel_number,
      );
    } catch {
      inserted += bridgeInMemory(ch);
    }
  }

  return { inserted, processed: targets.length };
}

async function resolveChannelsToBridge(
  channelId?: string,
): Promise<LineupChannelRow[]> {
  const channels = await listLineupChannels();
  if (!channelId) return channels;
  return channels.filter((ch) => ch.id === channelId);
}

function bridgeInMemory(channel: LineupChannelRow): number {
  const engine = getStreamingEngine();
  const network = engine.getChannel(channel.id);
  if (!network || network.programmingGrid.length === 0) return 0;

  const currentBlockTime = network.programmingGrid.reduce(
    (sum, seg) => sum + Number(seg.durationSeconds),
    0,
  );
  const gapSeconds =
    TARGET_SLOT_BLOCK_SECONDS - (currentBlockTime % TARGET_SLOT_BLOCK_SECONDS);

  if (gapSeconds <= 5 || gapSeconds >= TARGET_SLOT_BLOCK_SECONDS) {
    return 0;
  }

  const bumper = InterstitialGenerator.getPresetBumper(
    channel.channel_name,
    channel.channel_number,
    gapSeconds,
  );
  engine.appendSegment(channel.id, {
    id: bumper.id,
    title: bumper.title,
    creatorName: bumper.creatorName,
    type: bumperTypeToSegmentType(bumper.type),
    videoUrl: bumper.videoUrl,
    durationSeconds: bumper.durationSeconds,
  });
  return 1;
}

function isUnavailableDb(err: unknown): boolean {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET"
  ) {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /ECONNREFUSED|ENOTFOUND|connect ECONNREFUSED|timeout|the database system is starting/i.test(
    message,
  );
}
