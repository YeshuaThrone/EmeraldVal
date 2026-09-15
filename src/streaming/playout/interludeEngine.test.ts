import { describe, expect, it } from "vitest";
import { InterludeEngine } from "./interludeEngine";
import type { ProgramSegment } from "./multiChannelEngine";

function show(id: string, title: string): ProgramSegment {
  return {
    id,
    title,
    creatorName: "Maya",
    type: "SHOW",
    videoUrl: "https://example.com/a.mp4",
    durationSeconds: 60,
  };
}

describe("InterludeEngine.fillGaps", () => {
  it("inserts a station ID when the grid is empty", () => {
    const filled = InterludeEngine.fillGaps([], { channelName: "HAVEN TV" });
    expect(filled).toHaveLength(1);
    expect(filled[0]?.type).toBe("STATION_ID");
    expect(filled[0]?.title).toContain("HAVEN TV");
  });

  it("inserts an interlude between back-to-back shows", () => {
    const filled = InterludeEngine.fillGaps(
      [show("a", "Lofts"), show("b", "Night Market")],
      { channelName: "BLOCK TV", bumperSeconds: 12 },
    );
    expect(filled.map((seg) => seg.type)).toEqual([
      "SHOW",
      "INTERLUDE",
      "SHOW",
    ]);
    expect(filled[1]?.durationSeconds).toBe(12);
    expect(filled[1]?.title).toBe("Up Next: Night Market");
  });

  it("does not insert bumpers between a show and an existing promo", () => {
    const promo: ProgramSegment = {
      id: "p",
      title: "Promo",
      creatorName: "Net",
      type: "CREATOR_PROMO",
      videoUrl: "https://example.com/p.mp4",
      durationSeconds: 20,
    };
    const filled = InterludeEngine.fillGaps([show("a", "Lofts"), promo]);
    expect(filled.map((seg) => seg.type)).toEqual(["SHOW", "CREATOR_PROMO"]);
  });
});
