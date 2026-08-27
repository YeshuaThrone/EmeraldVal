import { describe, expect, it } from "vitest";
import {
  FESTIVAL_EVENTS,
  clockToMinutes,
  formatDuration,
  formatLiveCountdown,
  isLive,
  resolveLiveWindow,
} from "@/lib/festivalEvents";

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SET_TIME_PATTERN = /^\d{1,2}:\d{2} (AM|PM) - \d{1,2}:\d{2} (AM|PM)$/;

describe("FESTIVAL_EVENTS dataset", () => {
  it("ships at least three Austin events", () => {
    expect(FESTIVAL_EVENTS.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every event a unique id", () => {
    const ids = FESTIVAL_EVENTS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every event a name and a location tag", () => {
    for (const event of FESTIVAL_EVENTS) {
      expect(event.name.length).toBeGreaterThan(0);
      expect(event.locationTag.length).toBeGreaterThan(0);
    }
  });

  it("stores every live window as a valid 24h clock range", () => {
    for (const event of FESTIVAL_EVENTS) {
      expect(event.liveWindow.startClock).toMatch(CLOCK_PATTERN);
      expect(event.liveWindow.endClock).toMatch(CLOCK_PATTERN);
    }
  });

  it("gives every event at least two stages with uppercase names", () => {
    for (const event of FESTIVAL_EVENTS) {
      expect(event.stages.length).toBeGreaterThanOrEqual(2);
      for (const stage of event.stages) {
        expect(stage.name).toBe(stage.name.toUpperCase());
      }
    }
  });

  it("gives every stage an ordered lineup of exact set-time strings", () => {
    for (const event of FESTIVAL_EVENTS) {
      for (const stage of event.stages) {
        expect(stage.sets.length).toBeGreaterThan(0);
        for (const set of stage.sets) {
          expect(set.artist.length).toBeGreaterThan(0);
          expect(set.setTime).toMatch(SET_TIME_PATTERN);
        }
      }
    }
  });

  it("keeps the Red River Revival lineup exactly as authored", () => {
    const event = FESTIVAL_EVENTS.find((it) => it.id === "red-river-revival");
    expect(event?.name).toBe("Red River Revival");
    expect(event?.locationTag).toBe("6th Street & Red River");
    expect(event?.stages.map((stage) => stage.name)).toEqual([
      "MAIN STAGE",
      "ALLEY STAGE",
    ]);
    expect(event?.stages[0].sets[1]).toEqual({
      artist: "Marisol Vega",
      setTime: "7:00 PM - 7:45 PM",
    });
  });
});

describe("clockToMinutes", () => {
  it("counts minutes past midnight", () => {
    // 18 * 60 = 1080, computed independently of the implementation.
    expect(clockToMinutes("18:00")).toBe(1080);
    expect(clockToMinutes("00:00")).toBe(0);
    expect(clockToMinutes("23:45")).toBe(23 * 60 + 45);
  });

  it("rejects malformed clock strings instead of returning NaN", () => {
    expect(() => clockToMinutes("7:00 PM")).toThrow(/Invalid clock time/);
    expect(() => clockToMinutes("24:00")).toThrow(/Invalid clock time/);
  });
});

describe("formatDuration", () => {
  it("renders hours and minutes when there is at least an hour", () => {
    expect(formatDuration(119)).toBe("1h 59m");
    expect(formatDuration(120)).toBe("2h 0m");
  });

  it("drops the hour segment under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(0)).toBe("0m");
  });
});

describe("resolveLiveWindow", () => {
  it("anchors a same-day window to the current day", () => {
    const now = new Date(2026, 7, 27, 20, 0);
    const { start, end } = resolveLiveWindow(
      { startClock: "18:00", endClock: "23:45" },
      now,
    );
    expect(start).toEqual(new Date(2026, 7, 27, 18, 0));
    expect(end).toEqual(new Date(2026, 7, 27, 23, 45));
  });

  it("rolls an overnight window's end into the next day", () => {
    const now = new Date(2026, 7, 27, 21, 0);
    const { start, end } = resolveLiveWindow(
      { startClock: "19:00", endClock: "01:00" },
      now,
    );
    expect(start).toEqual(new Date(2026, 7, 27, 19, 0));
    expect(end).toEqual(new Date(2026, 7, 28, 1, 0));
  });

  it("anchors to yesterday when now is in an overnight window's tail", () => {
    const now = new Date(2026, 7, 28, 0, 15);
    const { start, end } = resolveLiveWindow(
      { startClock: "19:00", endClock: "01:00" },
      now,
    );
    expect(start).toEqual(new Date(2026, 7, 27, 19, 0));
    expect(end).toEqual(new Date(2026, 7, 28, 1, 0));
  });
});

describe("formatLiveCountdown", () => {
  const eveningWindow = { startClock: "18:00", endClock: "23:45" };

  it("counts down the time left while the event is running", () => {
    // 23:45 minus 21:46 is 1 hour 59 minutes.
    const now = new Date(2026, 7, 27, 21, 46);
    expect(formatLiveCountdown(eveningWindow, now)).toBe("Live for 1h 59m");
  });

  it("floors partial minutes rather than rounding up", () => {
    // 23:45 minus 23:00:30 is 44 minutes and 30 seconds.
    const now = new Date(2026, 7, 27, 23, 0, 30);
    expect(formatLiveCountdown(eveningWindow, now)).toBe("Live for 44m");
  });

  it("counts up to doors before the window opens", () => {
    // 18:00 minus 16:00 is exactly 2 hours.
    const now = new Date(2026, 7, 27, 16, 0);
    expect(formatLiveCountdown(eveningWindow, now)).toBe("Starts in 2h 0m");
  });

  it("reports a closed window once the event is over", () => {
    const now = new Date(2026, 7, 27, 23, 50);
    expect(formatLiveCountdown(eveningWindow, now)).toBe("Wrapped for tonight");
  });

  it("stays live past midnight for an overnight window", () => {
    // 01:00 minus 00:15 is 45 minutes.
    const now = new Date(2026, 7, 28, 0, 15);
    expect(
      formatLiveCountdown({ startClock: "19:00", endClock: "01:00" }, now),
    ).toBe("Live for 45m");
  });
});

describe("isLive", () => {
  const eveningWindow = { startClock: "18:00", endClock: "23:45" };

  it("is true inside the window and at its start", () => {
    expect(isLive(eveningWindow, new Date(2026, 7, 27, 18, 0))).toBe(true);
    expect(isLive(eveningWindow, new Date(2026, 7, 27, 20, 30))).toBe(true);
  });

  it("is false before the start and at or after the end", () => {
    expect(isLive(eveningWindow, new Date(2026, 7, 27, 17, 59))).toBe(false);
    expect(isLive(eveningWindow, new Date(2026, 7, 27, 23, 45))).toBe(false);
  });
});
