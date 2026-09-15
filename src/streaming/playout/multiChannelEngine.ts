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
    return Array.from(this.networks.values()).map((net) => ({
      id: net.channelId,
      number: net.channelNumber,
      name: net.channelName,
      category: net.category,
    }));
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
}
