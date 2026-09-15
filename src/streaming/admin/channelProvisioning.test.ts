import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bridgeActiveChannelGaps,
  buildCustomChannelId,
  provisionCustomChannel,
} from "./channelProvisioning";
import { getStreamingEngine } from "../server/apiRoutes";

const query = vi.fn();
const connect = vi.fn();

vi.mock("../db/dbEngine", () => ({
  dbPool: {
    query: (...args: unknown[]) => query(...args),
    connect: (...args: unknown[]) => connect(...args),
  },
}));

describe("buildCustomChannelId", () => {
  it("slugs the channel number and name", () => {
    expect(buildCustomChannelId(4, "ATX LOCAL NEWS 24/7")).toBe(
      "ch-04-atx-local-news-247",
    );
  });
});

describe("provisionCustomChannel", () => {
  afterEach(() => {
    query.mockReset();
    connect.mockReset();
  });

  it("inserts an active channel and registers it on the engine", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const created = await provisionCustomChannel({
      channelNumber: 4,
      channelName: "ATX LOCAL NEWS",
      category: "LOCAL_NEWS",
    });
    expect(created.channelId).toBe("ch-04-atx-local-news");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO channels"),
      ["ch-04-atx-local-news", 4, "ATX LOCAL NEWS", "LOCAL_NEWS"],
    );
    expect(getStreamingEngine().getChannel(created.channelId)?.channelName).toBe(
      "ATX LOCAL NEWS",
    );
  });

  it("rejects a duplicate channel number", async () => {
    await expect(
      provisionCustomChannel({
        channelNumber: 1,
        channelName: "Duplicate Main",
        category: "CUSTOM",
      }),
    ).rejects.toThrow("Failed to create custom channel");
  });

  it("falls back to in-memory when Postgres is unreachable", async () => {
    query.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    const created = await provisionCustomChannel({
      channelNumber: 9,
      channelName: "Fallback TV",
      category: "CUSTOM",
    });
    expect(created.channelId).toBe("ch-09-fallback-tv");
    expect(getStreamingEngine().getChannel(created.channelId)).toBeTruthy();
  });
});

describe("bridgeActiveChannelGaps", () => {
  afterEach(() => {
    query.mockReset();
    connect.mockReset();
  });

  it("fills a 30-minute remainder on the in-memory grid when DB bridging fails", async () => {
    query.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const before =
      getStreamingEngine().getChannel("ch-atx-01")?.programmingGrid.length ?? 0;
    const result = await bridgeActiveChannelGaps("ch-atx-01");
    expect(result.processed).toBe(1);
    expect(result.inserted).toBe(1);
    expect(
      getStreamingEngine().getChannel("ch-atx-01")?.programmingGrid.length,
    ).toBe(before + 1);
  });
});
