import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
const connect = vi.fn();

vi.mock("pg", () => ({
  Pool: class {
    query = query;
    connect = connect;
  },
}));

describe("CableDatabaseEngine", () => {
  afterEach(() => {
    query.mockReset();
    connect.mockReset();
    vi.resetModules();
  });

  it("hydrates networks from channels and ordered segments", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: "ch-haven",
            channel_number: 2,
            channel_name: "HAVEN TV",
            category: "Real Estate",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "seg-1",
            title: "Lofts",
            creator_name: "Maya",
            type: "SHOW",
            video_url: "https://cdn.example.com/a.mp4",
            duration_seconds: 120,
          },
        ],
      });

    const { CableDatabaseEngine } = await import("./dbEngine");
    const networks = await CableDatabaseEngine.loadAllNetworks();
    expect(networks).toHaveLength(1);
    expect(networks[0]?.channelName).toBe("HAVEN TV");
    expect(networks[0]?.programmingGrid[0]?.creatorName).toBe("Maya");
  });

  it("logs viewer telemetry", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const { CableDatabaseEngine } = await import("./dbEngine");
    await CableDatabaseEngine.logViewerTelemetry(
      "ch-haven",
      "seg-1",
      "viewer-1",
      12,
      "ch-block",
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO viewer_analytics"),
      ["ch-haven", "seg-1", "viewer-1", 12, "ch-block"],
    );
  });

  it("records an ad impression and increments campaign spend", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    connect.mockResolvedValue({ query: clientQuery, release });

    const { CableDatabaseEngine } = await import("./dbEngine");
    const result = await CableDatabaseEngine.recordAdImpression({
      campaignId: "cmp-1",
      channelId: "ch-atx-01",
      viewerId: "viewer-9",
      adDurationSeconds: 15,
      cpmRate: 20,
    });

    expect(result.cpmEarned).toBe(0.02);
    expect(clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(
      clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO ad_impressions"),
      ),
    ).toBe(true);
    expect(
      clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE ad_campaigns"),
      ),
    ).toBe(true);
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();
  });
});
