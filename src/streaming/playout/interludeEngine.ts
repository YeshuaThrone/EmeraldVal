import type { ProgramSegment } from "./multiChannelEngine";

const DEFAULT_BUMPER_SECONDS = 15;
const EMPTY_GRID_STATION_ID_SECONDS = 30;

const DEFAULT_STATION_ID_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
const DEFAULT_INTERLUDE_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

/**
 * Inserts station IDs / creator interludes so the grid never has
 * back-to-back main shows or an empty loop.
 */
export class InterludeEngine {
  public static fillGaps(
    grid: ProgramSegment[],
    options: { channelName?: string; bumperSeconds?: number } = {},
  ): ProgramSegment[] {
    const bumperSeconds = options.bumperSeconds ?? DEFAULT_BUMPER_SECONDS;
    const channelName = options.channelName ?? "Network";

    if (grid.length === 0) {
      return [
        InterludeEngine.stationId(channelName, EMPTY_GRID_STATION_ID_SECONDS),
      ];
    }

    const filled: ProgramSegment[] = [];
    for (let i = 0; i < grid.length; i++) {
      const current = grid[i];
      if (!current) continue;
      filled.push(current);

      const next = grid[i + 1];
      if (
        current.type === "SHOW" &&
        next?.type === "SHOW"
      ) {
        filled.push(
          InterludeEngine.interlude(channelName, next, bumperSeconds),
        );
      }
    }
    return filled;
  }

  private static stationId(
    channelName: string,
    durationSeconds: number,
  ): ProgramSegment {
    return {
      id: `id-${crypto.randomUUID()}`,
      title: `${channelName} Station ID`,
      creatorName: channelName,
      type: "STATION_ID",
      videoUrl: DEFAULT_STATION_ID_URL,
      durationSeconds,
    };
  }

  private static interlude(
    channelName: string,
    upcoming: ProgramSegment,
    durationSeconds: number,
  ): ProgramSegment {
    return {
      id: `int-${crypto.randomUUID()}`,
      title: `Up Next: ${upcoming.title}`,
      creatorName: upcoming.creatorName,
      creatorAvatarUrl: upcoming.creatorAvatarUrl,
      type: "INTERLUDE",
      videoUrl: DEFAULT_INTERLUDE_URL,
      durationSeconds,
      metadata: {
        socialHandle: upcoming.metadata?.socialHandle,
        episodeTitle: upcoming.title,
      },
    };
  }
}
