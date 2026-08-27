/**
 * Deterministic Festival Finder dataset. There is no backend: every event,
 * stage, and set time below is a static, hand-authored Austin lineup.
 *
 * Set times are exact display strings ("7:00 PM - 7:45 PM") because they are
 * schedule copy, not computed values. The only derived piece is the live
 * status badge, which comes from the event's nightly live window.
 */

/** One artist's slot on a stage. `setTime` is display copy, never parsed. */
export type FestivalSet = {
  artist: string;
  setTime: string;
};

/** A named stage and its lineup, in running order. */
export type FestivalStage = {
  /** Rendered uppercase in the UI; stored uppercase so the data matches. */
  name: string;
  sets: FestivalSet[];
};

/**
 * The nightly window an event is live, as wall-clock times in 24h "HH:MM"
 * form. Stored as clock times rather than fixed calendar timestamps so the
 * demo dataset stays live every evening instead of expiring on one date;
 * `resolveLiveWindow` turns them into concrete timestamps for a given now.
 */
export type LiveWindow = {
  startClock: string;
  endClock: string;
};

export type FestivalEvent = {
  id: string;
  name: string;
  /** Short cross-street or block tag shown under the event name. */
  locationTag: string;
  liveWindow: LiveWindow;
  stages: FestivalStage[];
};

export const FESTIVAL_EVENTS: FestivalEvent[] = [
  {
    id: "red-river-revival",
    name: "Red River Revival",
    locationTag: "6th Street & Red River",
    liveWindow: { startClock: "18:00", endClock: "23:45" },
    stages: [
      {
        name: "MAIN STAGE",
        sets: [
          { artist: "Rosewater Union", setTime: "6:15 PM - 7:00 PM" },
          { artist: "Marisol Vega", setTime: "7:00 PM - 7:45 PM" },
          { artist: "The Rundberg Kings", setTime: "8:00 PM - 9:00 PM" },
          { artist: "Cactus Bloom", setTime: "9:30 PM - 10:45 PM" },
        ],
      },
      {
        name: "ALLEY STAGE",
        sets: [
          { artist: "Ivory Pines", setTime: "6:30 PM - 7:10 PM" },
          { artist: "DJ Cinco Ocho", setTime: "7:30 PM - 8:30 PM" },
          { artist: "Sabine & the Static", setTime: "9:00 PM - 10:00 PM" },
        ],
      },
    ],
  },
  {
    id: "south-congress-soundwalk",
    name: "South Congress Soundwalk",
    locationTag: "S Congress Ave & Elizabeth St",
    liveWindow: { startClock: "17:30", endClock: "22:30" },
    stages: [
      {
        name: "PORCH STAGE",
        sets: [
          { artist: "Hattie Lowell", setTime: "5:45 PM - 6:30 PM" },
          { artist: "The Barton Creek Trio", setTime: "6:45 PM - 7:30 PM" },
          { artist: "Nico Salinas", setTime: "8:00 PM - 9:00 PM" },
        ],
      },
      {
        name: "COURTYARD STAGE",
        sets: [
          { artist: "Fiesta Garage", setTime: "6:00 PM - 6:50 PM" },
          { artist: "Luz del Este", setTime: "7:15 PM - 8:15 PM" },
          { artist: "Armadillo Revue", setTime: "8:45 PM - 10:00 PM" },
        ],
      },
    ],
  },
  {
    id: "east-side-block-party",
    name: "East Side Block Party",
    locationTag: "E 6th Street & Waller Street",
    liveWindow: { startClock: "19:00", endClock: "01:00" },
    stages: [
      {
        name: "WAREHOUSE STAGE",
        sets: [
          { artist: "Chaparral Sound System", setTime: "7:15 PM - 8:15 PM" },
          { artist: "Odessa Grey", setTime: "8:30 PM - 9:30 PM" },
          { artist: "Blackland Prairie", setTime: "10:00 PM - 11:30 PM" },
        ],
      },
      {
        name: "PATIO STAGE",
        sets: [
          { artist: "Mesquite Radio", setTime: "7:45 PM - 8:45 PM" },
          { artist: "Juniper Fell", setTime: "9:15 PM - 10:15 PM" },
        ],
      },
    ],
  },
];

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;

/**
 * Minutes past midnight for an "HH:MM" clock string. Throws on malformed
 * input rather than silently coercing to NaN, which would poison every
 * downstream countdown with an unreadable badge.
 */
export function clockToMinutes(clock: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) {
    throw new Error(`Invalid clock time: ${clock}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Concrete start/end timestamps for an event's nightly window, relative to
 * `now`. A window whose end clock is at or before its start clock (an
 * after-midnight close like 19:00 - 01:00) ends the following day. If `now`
 * falls in the tail of a window that began yesterday, the window is anchored
 * to yesterday so the event still reads as live.
 */
export function resolveLiveWindow(
  window: LiveWindow,
  now: Date,
): { start: Date; end: Date } {
  const startMinutes = clockToMinutes(window.startClock);
  const endMinutes = clockToMinutes(window.endClock);
  const durationMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : endMinutes + MINUTES_PER_DAY - startMinutes;

  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const startedToday = new Date(midnight.getTime() + startMinutes * MS_PER_MINUTE);
  const nowMinutes = (now.getTime() - midnight.getTime()) / MS_PER_MINUTE;

  // Overnight window still running from yesterday evening.
  const start =
    endMinutes <= startMinutes && nowMinutes < endMinutes
      ? new Date(startedToday.getTime() - MINUTES_PER_DAY * MS_PER_MINUTE)
      : startedToday;

  return {
    start,
    end: new Date(start.getTime() + durationMinutes * MS_PER_MINUTE),
  };
}

/** Whole minutes, floored, never negative. */
function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_MINUTE));
}

/** "1h 59m" for 119 minutes, "45m" for 45 — hours are dropped when zero. */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * The live status badge copy for an event window at a given moment:
 * "Live for 1h 59m" while running (time remaining), "Starts in 2h 30m"
 * before the doors, "Wrapped for tonight" once the window closes.
 *
 * Pure — `now` is always injected so the badge is testable and the page
 * renders one consistent value per request.
 */
export function formatLiveCountdown(window: LiveWindow, now: Date): string {
  const { start, end } = resolveLiveWindow(window, now);

  if (now < start) {
    return `Starts in ${formatDuration(minutesBetween(now, start))}`;
  }
  if (now >= end) {
    return "Wrapped for tonight";
  }
  return `Live for ${formatDuration(minutesBetween(now, end))}`;
}

/** Whether the event is inside its live window at `now`. */
export function isLive(window: LiveWindow, now: Date): boolean {
  const { start, end } = resolveLiveWindow(window, now);
  return now >= start && now < end;
}
