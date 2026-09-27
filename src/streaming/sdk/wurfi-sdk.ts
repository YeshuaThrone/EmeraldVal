// ============================================================================
// WURFI BROADCAST ENGINE SDK
// Core Types, EPG Generator, SCTE-35 Manifest Injector & Wall-Clock Sync
// ============================================================================

export interface Program {
  id: string;
  title: string;
  durationSeconds: number;
}

export interface ScheduledProgram {
  program_id: string;
  title: string;
  start_time_utc: string;
  end_time_utc: string;
  is_live: boolean;
}

export interface TickerProps {
  sseEndpoint: string;
  initialText?: string;
}

/**
 * Generates a seamless, gapless 24-hour linear schedule array from a video catalog.
 */
export function generate24HourSchedule(
  catalog: Program[],
  startTimeUtc: Date,
): ScheduledProgram[] {
  if (!catalog || catalog.length === 0) {
    return [];
  }

  const usable = catalog.filter((program) => program.durationSeconds > 0);
  if (usable.length === 0) {
    return [];
  }

  let currentTime = new Date(startTimeUtc).getTime();
  if (!Number.isFinite(currentTime)) {
    return [];
  }

  const schedule: ScheduledProgram[] = [];
  let index = 0;
  const targetEndTime = currentTime + 24 * 60 * 60 * 1000;

  while (currentTime < targetEndTime) {
    const program = usable[index % usable.length]!;
    const startIso = new Date(currentTime).toISOString();
    const endMs = currentTime + program.durationSeconds * 1000;
    const endIso = new Date(endMs).toISOString();

    schedule.push({
      program_id: program.id,
      title: program.title,
      start_time_utc: startIso,
      end_time_utc: endIso,
      is_live: false,
    });

    currentTime = endMs;
    index++;
  }

  return schedule;
}

/**
 * Injects SCTE-35 ad placement tags (#EXT-X-CUE-OUT / #EXT-X-CUE-IN) into HLS playlist manifest lines.
 */
export function injectScte35AdMarkers(
  manifestLines: string[],
  adIntervalSegments: number,
  adDurationSec: number,
): string[] {
  if (!manifestLines || manifestLines.length === 0) {
    return [];
  }
  if (!(adIntervalSegments > 0) || !(adDurationSec >= 0)) {
    return [...manifestLines];
  }

  const updatedManifest: string[] = [];
  let segmentCounter = 0;

  for (const line of manifestLines) {
    if (line.startsWith("#EXTINF:")) {
      segmentCounter++;
      if (segmentCounter % adIntervalSegments === 0) {
        updatedManifest.push(
          `#EXT-X-CUE-OUT:DURATION=${adDurationSec}.000`,
        );
        updatedManifest.push(line);
      } else if (
        segmentCounter % adIntervalSegments === 1 &&
        segmentCounter > 1
      ) {
        updatedManifest.push("#EXT-X-CUE-IN");
        updatedManifest.push(line);
      } else {
        updatedManifest.push(line);
      }
    } else {
      updatedManifest.push(line);
    }
  }

  return updatedManifest;
}

/**
 * Calculates the exact current playback position in seconds based on absolute UTC wall-clock time.
 */
export function calculateLiveStreamOffset(
  programStartTimeUtc: string,
  durationSeconds: number,
  nowMs: number = Date.now(),
): number {
  const startMs = new Date(programStartTimeUtc).getTime();
  if (!Number.isFinite(startMs) || !(durationSeconds > 0)) {
    return 0;
  }

  const elapsedSeconds = (nowMs - startMs) / 1000;
  if (elapsedSeconds < 0) return 0;
  if (elapsedSeconds >= durationSeconds) return durationSeconds;
  return elapsedSeconds;
}

export function utcDayStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function currentScheduledProgram(
  schedule: ScheduledProgram[],
  now: Date = new Date(),
): ScheduledProgram | null {
  const nowMs = now.getTime();
  return (
    schedule.find((program) => {
      const start = Date.parse(program.start_time_utc);
      const end = Date.parse(program.end_time_utc);
      return nowMs >= start && nowMs < end;
    }) ?? null
  );
}
