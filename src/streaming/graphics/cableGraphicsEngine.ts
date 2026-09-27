import type {
  ChannelNetworkConfig,
  ProgramSegment,
} from "../playout/multiChannelEngine";

export interface CableOverlayState {
  channelBug: {
    visible: boolean;
    logoUrl: string;
    channelName: string;
    channelNumber: number;
  };
  interludePromo: {
    visible: boolean;
    promoType: "UP_NEXT" | "CREATOR_SPOTLIGHT" | "STATION_ID" | "NONE";
    creatorName?: string;
    creatorAvatarUrl?: string;
    showTitle?: string;
    socialHandle?: string;
  };
}

export class CableGraphicsEngine {
  /**
   * Evaluates broadcast overlays (Station Bug + Up Next / Creator Spotlight Promos)
   */
  public static evaluateCableGraphics(
    channel: ChannelNetworkConfig,
    activeSegment: ProgramSegment,
    nextSegment: ProgramSegment,
    elapsedSeconds: number,
  ): CableOverlayState {
    const isInterludeOrPromo =
      activeSegment.type === "CREATOR_PROMO" ||
      activeSegment.type === "STATION_ID";

    // Trigger "UP NEXT" promo in the last 15 seconds of a main show
    const isShowEndingSoon =
      activeSegment.type === "SHOW" &&
      activeSegment.durationSeconds - elapsedSeconds <= 15;

    let promoState: CableOverlayState["interludePromo"] = {
      visible: false,
      promoType: "NONE",
    };

    if (isShowEndingSoon) {
      promoState = {
        visible: true,
        promoType: "UP_NEXT",
        creatorName: nextSegment.creatorName,
        creatorAvatarUrl: nextSegment.creatorAvatarUrl,
        showTitle: nextSegment.title,
        socialHandle: nextSegment.metadata?.socialHandle,
      };
    } else if (isInterludeOrPromo) {
      promoState = {
        visible: true,
        promoType:
          activeSegment.type === "STATION_ID"
            ? "STATION_ID"
            : "CREATOR_SPOTLIGHT",
        creatorName: activeSegment.creatorName,
        creatorAvatarUrl: activeSegment.creatorAvatarUrl,
        showTitle: activeSegment.title,
        socialHandle: activeSegment.metadata?.socialHandle,
      };
    }

    return {
      channelBug: {
        visible: true, // Cable channel logo always present
        logoUrl: channel.stationBugLogoUrl,
        channelName: channel.channelName,
        channelNumber: channel.channelNumber,
      },
      interludePromo: promoState,
    };
  }
}
