import { describe, expect, it } from "vitest";
import { cloneChannelPresets } from "../config/channelPresets";
import { MultiChannelEngine } from "./multiChannelEngine";

function seededEngine() {
  const engine = new MultiChannelEngine();
  for (const channel of cloneChannelPresets()) {
    engine.registerChannel(channel);
  }
  return engine;
}

describe("MultiChannelEngine", () => {
  it("lists registered channels by number", () => {
    const list = seededEngine().getChannelList();
    expect(list.map((ch) => ch.id)).toEqual([
      "ch-atx-01",
      "ch-haven",
      "ch-block",
    ]);
    expect(list[0]?.name).toBe("WORFI MAIN");
  });

  it("resolves the active segment from the looping grid", () => {
    const engine = seededEngine();
    const haven = engine.getChannel("ch-haven");
    expect(haven).toBeDefined();
    const total = haven!.programmingGrid.reduce(
      (sum, seg) => sum + seg.durationSeconds,
      0,
    );
    const now = new Date(total * 1000); // offset 0 in the loop
    const playout = engine.resolveCurrentPlayout("ch-haven", now);
    expect(playout.activeSegment.id).toBe("haven-show-1");
    expect(playout.offsetSeconds).toBe(0);
    expect(playout.nextSegment.id).toBe("haven-promo-1");
  });

  it("advances into the next slot mid-loop", () => {
    const engine = seededEngine();
    const now = new Date(125 * 1000); // 120s show + 5s into promo
    const playout = engine.resolveCurrentPlayout("ch-haven", now);
    expect(playout.activeSegment.id).toBe("haven-promo-1");
    expect(playout.offsetSeconds).toBe(5);
    expect(playout.nextSegment.id).toBe("haven-id-1");
  });

  it("throws for an unknown channel", () => {
    expect(() => seededEngine().resolveCurrentPlayout("missing")).toThrow(
      /not found/,
    );
  });

  it("appends ingested segments onto the grid", () => {
    const engine = seededEngine();
    engine.appendSegment("ch-haven", {
      id: "new-seg",
      title: "Late Night Loft",
      creatorName: "Ada",
      type: "SHOW",
      videoUrl: "https://example.com/a.mp4",
      durationSeconds: 60,
    });
    expect(engine.getChannel("ch-haven")?.programmingGrid.at(-1)?.id).toBe(
      "new-seg",
    );
  });

  it("emits the live playhead wire contract", () => {
    const engine = seededEngine();
    const now = new Date(1_726_350_000_000);
    const playhead = engine.getCurrentPlayhead("ch-atx-01", now);
    expect(playhead.channelId).toBe("ch-atx-01");
    expect(playhead.serverTimeMs).toBe(now.getTime());
    expect(playhead.segment).toMatchObject({
      videoId: "vid-8829",
      title: "ATX Live Sessions: Ep 4",
      creatorName: "Yeshua Throne",
      durationSeconds: 1800,
    });
    expect(playhead.segment?.streamUrl).toContain("http");
    expect(playhead.nextSegment).toMatchObject({
      videoId: "vid-8830",
      title: "Midnight Modular Modular",
    });
    expect(playhead.nextSegment?.startTime).toEqual(expect.any(String));
  });
});
