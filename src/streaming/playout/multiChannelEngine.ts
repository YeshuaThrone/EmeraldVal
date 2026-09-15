export interface ProgramSegment {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  type: "SHOW" | "STATION_ID" | "CREATOR_PROMO" | "INTERLUDE";
  videoUrl: string;
  durationSeconds: number;
  metadata?: {
    episodeTitle?: string;
    description?: string;
    socialHandle?: string;
  };
}

export interface ChannelNetworkConfig {
  channelId: string;
  channelNumber: number;
  channelName: string; // e.g., "HAVEN TV" (HGTV style) or "BLOCK TV"
  category: string; // e.g., "Real Estate & Spaces", "Culture & Drama"
  stationBugLogoUrl: string; // On-screen corner logo
  programmingGrid: ProgramSegment[];
}

export interface ChannelListItem {
  id: string;
  number: number;
  name: string;
  category: string;
}

export interface CurrentPlayout {
  channel: ChannelNetworkConfig;
  activeSegment: ProgramSegment;
  offsetSeconds: number;
  nextSegment: ProgramSegment;
}

/** Live playhead wire contract for players and GET /api/streaming/channels/:id/live */
export interface CurrentPlayheadSegment {
  videoId: string;
  title: string;
  streamUrl: string;
  durationSeconds: number;
  positionSeconds: number;
  creatorName: string;
}

export interface CurrentPlayheadNextSegment {
  videoId: string;
  title: string;
  startTime: string;
}

export interface CurrentPlayheadState {
  channelId: string;
  serverTimeMs: number;
  segment: CurrentPlayheadSegment | null;
  nextSegment: CurrentPlayheadNextSegment | null;
}

export class MultiChannelEngine {
  private networks: Map<string, ChannelNetworkConfig> = new Map();

  constructor(initialChannels: ChannelNetworkConfig[] = []) {
    for (const channel of initialChannels) {
      this.registerChannel(channel);
    }
  }

  public registerChannel(config: ChannelNetworkConfig): void {
    this.networks.set(config.channelId, structuredClone(config));
  }

  public getChannel(channelId: string): ChannelNetworkConfig | undefined {
    return this.networks.get(channelId);
  }

  public getChannelList(): ChannelListItem[] {
    return this.getNetworks().map((net) => ({
      id: net.channelId,
      number: net.channelNumber,
      name: net.channelName,
      category: net.category,
    }));
  }

  public getNetworks(): ChannelNetworkConfig[] {
    return Array.from(this.networks.values()).sort(
      (a, b) => a.channelNumber - b.channelNumber,
    );
  }

  public appendSegment(channelId: string, segment: ProgramSegment): ChannelNetworkConfig {
    const network = this.networks.get(channelId);
    if (!network) {
      throw new Error(`Channel ${channelId} not found`);
    }
    network.programmingGrid.push(segment);
    return network;
  }

  public replaceNetworks(channels: ChannelNetworkConfig[]): void {
    this.networks.clear();
    for (const channel of channels) {
      this.registerChannel(channel);
    }
  }

  /**
   * Resolves exact video frame and interlude overlay for any channel at current moment
   */
  public resolveCurrentPlayout(
    channelId: string,
    now: Date = new Date(),
  ): CurrentPlayout {
    const network = this.networks.get(channelId);
    if (!network) throw new Error(`Channel ${channelId} not found`);

    const totalLoopDuration = network.programmingGrid.reduce(
      (acc, item) => acc + item.durationSeconds,
      0,
    );

    if (network.programmingGrid.length === 0 || totalLoopDuration <= 0) {
      throw new Error(`Channel ${channelId} has no programming`);
    }

    const currentEpochSec = Math.floor(now.getTime() / 1000);
    const loopOffsetSec = currentEpochSec % totalLoopDuration;

    let accumulatedSec = 0;

    for (let i = 0; i < network.programmingGrid.length; i++) {
      const segment = network.programmingGrid[i];
      if (!segment) continue;
      const nextAccumulated = accumulatedSec + segment.durationSeconds;

      if (loopOffsetSec >= accumulatedSec && loopOffsetSec < nextAccumulated) {
        const offsetSeconds = loopOffsetSec - accumulatedSec;
        const nextSegment =
          network.programmingGrid[(i + 1) % network.programmingGrid.length] ??
          segment;

        return {
          channel: network,
          activeSegment: segment,
          offsetSeconds,
          nextSegment,
        };
      }
      accumulatedSec = nextAccumulated;
    }

    const first = network.programmingGrid[0];
    const second = network.programmingGrid[1] ?? first;
    if (!first) {
      throw new Error(`Channel ${channelId} has no programming`);
    }

    return {
      channel: network,
      activeSegment: first,
      offsetSeconds: 0,
      nextSegment: second,
    };
  }

  public getCurrentPlayhead(
    channelId: string,
    now: Date = new Date(),
  ): CurrentPlayheadState {
    try {
      const playout = this.resolveCurrentPlayout(channelId, now);
      const remaining =
        playout.activeSegment.durationSeconds - playout.offsetSeconds;
      const nextStart = new Date(now.getTime() + Math.max(0, remaining) * 1000);
      return {
        channelId,
        serverTimeMs: now.getTime(),
        segment: {
          videoId: playout.activeSegment.id,
          title: playout.activeSegment.title,
          streamUrl: playout.activeSegment.videoUrl,
          durationSeconds: playout.activeSegment.durationSeconds,
          positionSeconds: playout.offsetSeconds,
          creatorName: playout.activeSegment.creatorName,
        },
        nextSegment: {
          videoId: playout.nextSegment.id,
          title: playout.nextSegment.title,
          startTime: nextStart.toISOString(),
        },
      };
    } catch {
      return {
        channelId,
        serverTimeMs: now.getTime(),
        segment: null,
        nextSegment: null,
      };
    }
  }
}
