import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const connect = vi.fn();
const autoBridge = vi.fn();

vi.mock("../db/dbEngine", () => ({
  dbPool: {
    query: (...args: unknown[]) => query(...args),
    connect: (...args: unknown[]) => connect(...args),
  },
}));

vi.mock("../playout/interstitialGenerator", () => ({
  InterstitialGenerator: {
    autoBridgeScheduleGaps: (...args: unknown[]) => autoBridge(...args),
  },
}));

describe("runScheduleGapPass", () => {
  afterEach(() => {
    query.mockReset();
    connect.mockReset();
    autoBridge.mockReset();
    vi.resetModules();
  });

  it("bridges active channels only", async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: "ch-atx-01", channel_name: "WORFI MAIN", channel_number: 1 },
        { id: "ch-haven", channel_name: "HAVEN TV", channel_number: 2 },
      ],
    });
    autoBridge.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const { runScheduleGapPass } = await import("./scheduleGapWorker");
    await expect(runScheduleGapPass()).resolves.toBe(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE is_active = true"),
    );
    expect(autoBridge).toHaveBeenCalledTimes(2);
  });
});
