import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InterstitialGenerator,
  bumperTypeToSegmentType,
} from "./interstitialGenerator";

const query = vi.fn();
const connect = vi.fn();

vi.mock("../db/dbEngine", () => ({
  dbPool: {
    connect: (...args: unknown[]) => connect(...args),
    query: (...args: unknown[]) => query(...args),
  },
}));

describe("InterstitialGenerator.getPresetBumper", () => {
  it("uses a station ID for gaps of 15s or less", () => {
    const bumper = InterstitialGenerator.getPresetBumper("WURFI MAIN", 1, 10);
    expect(bumper.type).toBe("STATION_ID");
    expect(bumper.title).toContain("CH 01");
    expect(bumper.durationSeconds).toBe(10);
  });

  it("uses an up-next bumper for gaps up to 60s", () => {
    const bumper = InterstitialGenerator.getPresetBumper("haven tv", 2, 45);
    expect(bumper.type).toBe("UP_NEXT_BUMPER");
    expect(bumper.title).toContain("HAVEN TV");
  });

  it("uses a network promo for longer gaps", () => {
    const bumper = InterstitialGenerator.getPresetBumper("WURFI MAIN", 1, 240);
    expect(bumper.type).toBe("PROMO");
    expect(bumperTypeToSegmentType(bumper.type)).toBe("CREATOR_PROMO");
  });
});

describe("InterstitialGenerator.autoBridgeScheduleGaps", () => {
  afterEach(() => {
    query.mockReset();
    connect.mockReset();
  });

  it("inserts a bumper to fill the 30-minute block remainder", async () => {
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "seg-1", title: "Show", duration_seconds: 1700, slot_order: 1 }],
      })
      .mockResolvedValueOnce({}) // INSERT
      .mockResolvedValueOnce({}); // COMMIT
    const release = vi.fn();
    connect.mockResolvedValue({ query: clientQuery, release });

    const inserted = await InterstitialGenerator.autoBridgeScheduleGaps(
      "ch-atx-01",
      "WURFI MAIN",
      1,
    );

    expect(inserted).toBe(1);
    const insertCall = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO segments"),
    );
    expect(insertCall?.[1]?.[6]).toBe(100); // 1800 - 1700
    expect(insertCall?.[1]?.[7]).toBe(2);
    expect(release).toHaveBeenCalled();
  });

  it("returns 0 when the channel has no segments", async () => {
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    connect.mockResolvedValue({ query: clientQuery, release: vi.fn() });

    await expect(
      InterstitialGenerator.autoBridgeScheduleGaps("ch-empty", "WURFI", 1),
    ).resolves.toBe(0);
  });
});
