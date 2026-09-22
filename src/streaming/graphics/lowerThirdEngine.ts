import type { ProgramSegment } from "../playout/multiChannelEngine";

export interface LowerThirdState {
  visible: boolean;
  line1: string;
  line2: string;
  socialHandle?: string;
}

export class LowerThirdEngine {
  public static readonly INTRO_SECONDS = 8;

  /**
   * Shows a creator lower-third for the opening seconds of a main show.
   */
  public static evaluate(
    activeSegment: ProgramSegment,
    elapsedSeconds: number,
  ): LowerThirdState {
    const visible =
      activeSegment.type === "SHOW" &&
      elapsedSeconds >= 0 &&
      elapsedSeconds < LowerThirdEngine.INTRO_SECONDS;

    return {
      visible,
      line1: activeSegment.creatorName,
      line2: activeSegment.metadata?.episodeTitle ?? activeSegment.title,
      socialHandle: activeSegment.metadata?.socialHandle,
    };
  }
}
