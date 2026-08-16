export const LIVE_TTL_MS = 2 * 60 * 60 * 1000;

export function remainingMs(liveUntil: number, now: number): number {
  return Math.max(0, liveUntil - now);
}

export function isPinExpired(liveUntil: number, now: number): boolean {
  return remainingMs(liveUntil, now) <= 0;
}

export function formatLiveCountdown(liveUntil: number, now: number): string {
  const ms = remainingMs(liveUntil, now);
  if (ms <= 0) {
    return "Live ended";
  }

  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `Live for ${minutes}m`;
  }

  return `Live for ${hours}h ${minutes}m`;
}
