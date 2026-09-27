import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateLiveStreamOffset,
  currentScheduledProgram,
  generate24HourSchedule,
  injectScte35AdMarkers,
  utcDayStart,
  type Program,
} from "./wurfi-sdk";

const catalog: Program[] = [
  { id: "a", title: "Set A", durationSeconds: 30 },
  { id: "b", title: "Ad B", durationSeconds: 10 },
];

describe("generate24HourSchedule", () => {
  it("returns an empty grid for an empty catalog", () => {
    expect(generate24HourSchedule([], new Date("2026-09-27T00:00:00Z"))).toEqual(
      [],
    );
  });

  it("fills a gapless 24-hour linear day by looping the catalog", () => {
    const start = new Date("2026-09-27T00:00:00.000Z");
    const schedule = generate24HourSchedule(catalog, start);
    expect(schedule.length).toBeGreaterThan(1);
    expect(schedule[0]).toMatchObject({
      program_id: "a",
      title: "Set A",
      start_time_utc: "2026-09-27T00:00:00.000Z",
      end_time_utc: "2026-09-27T00:00:30.000Z",
      is_live: false,
    });
    expect(schedule[1]).toMatchObject({
      program_id: "b",
      start_time_utc: "2026-09-27T00:00:30.000Z",
      end_time_utc: "2026-09-27T00:00:40.000Z",
    });

    const last = schedule.at(-1)!;
    expect(Date.parse(last.end_time_utc)).toBeGreaterThanOrEqual(
      start.getTime() + 24 * 60 * 60 * 1000,
    );
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i]?.start_time_utc).toBe(schedule[i - 1]?.end_time_utc);
    }
  });

  it("skips zero-duration programs instead of spinning forever", () => {
    expect(
      generate24HourSchedule(
        [{ id: "dead", title: "Dead", durationSeconds: 0 }],
        new Date("2026-09-27T00:00:00Z"),
      ),
    ).toEqual([]);
  });
});

describe("injectScte35AdMarkers", () => {
  const lines = [
    "#EXTM3U",
    "#EXTINF:6.0,",
    "seg0.ts",
    "#EXTINF:6.0,",
    "seg1.ts",
    "#EXTINF:6.0,",
    "seg2.ts",
    "#EXTINF:6.0,",
    "seg3.ts",
  ];

  it("injects CUE-OUT / CUE-IN on the configured segment interval", () => {
    const marked = injectScte35AdMarkers(lines, 2, 15);
    expect(marked).toContain("#EXT-X-CUE-OUT:DURATION=15.000");
    expect(marked).toContain("#EXT-X-CUE-IN");
    const cueOutAt = marked.indexOf("#EXT-X-CUE-OUT:DURATION=15.000");
    expect(marked[cueOutAt + 1]).toBe("#EXTINF:6.0,");
  });

  it("returns a copy when the interval is invalid", () => {
    expect(injectScte35AdMarkers(lines, 0, 15)).toEqual(lines);
    expect(injectScte35AdMarkers([], 2, 15)).toEqual([]);
  });
});

describe("calculateLiveStreamOffset", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns elapsed seconds since the program start, clamped to the duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T00:00:12.000Z"));
    expect(
      calculateLiveStreamOffset("2026-09-27T00:00:00.000Z", 30),
    ).toBe(12);
    expect(
      calculateLiveStreamOffset("2026-09-27T00:00:20.000Z", 30),
    ).toBe(0);
    expect(
      calculateLiveStreamOffset("2026-09-27T00:00:00.000Z", 10),
    ).toBe(10);
  });
});

describe("currentScheduledProgram", () => {
  it("picks the program covering wall-clock now", () => {
    const start = utcDayStart(new Date("2026-09-27T00:00:35Z"));
    const schedule = generate24HourSchedule(catalog, start);
    const current = currentScheduledProgram(
      schedule,
      new Date("2026-09-27T00:00:35Z"),
    );
    expect(current?.program_id).toBe("b");
  });
});
