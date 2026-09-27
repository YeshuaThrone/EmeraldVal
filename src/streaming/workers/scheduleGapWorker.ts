import { dbPool } from "../db/dbEngine";
import { InterstitialGenerator } from "../playout/interstitialGenerator";

const POLL_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

let pollTimer: ReturnType<typeof setInterval> | undefined;

export async function runScheduleGapPass(): Promise<number> {
  const channelsRes = await dbPool.query(
    `SELECT id, channel_name, channel_number FROM channels WHERE is_active = true`,
  );

  let insertedTotal = 0;
  for (const ch of channelsRes.rows as Array<{
    id: string;
    channel_name: string;
    channel_number: number;
  }>) {
    const inserted = await InterstitialGenerator.autoBridgeScheduleGaps(
      ch.id,
      ch.channel_name,
      ch.channel_number,
    );
    if (inserted > 0) {
      console.log(
        `[Worker] Auto-bridged ${inserted} gap(s) on Channel ${ch.channel_number}`,
      );
      insertedTotal += inserted;
    }
  }
  return insertedTotal;
}

export function startScheduleGapWorker(): void {
  if (pollTimer) return;

  console.log("[Worker] Schedule Alignment Worker started...");

  pollTimer = setInterval(() => {
    void (async () => {
      try {
        await runScheduleGapPass();
      } catch (err) {
        console.error("[Worker] Error during schedule gap poll:", err);
      }
    })();
  }, POLL_INTERVAL_MS);
}

export function stopScheduleGapWorker(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = undefined;
}
