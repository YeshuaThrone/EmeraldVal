import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  path.join(import.meta.dirname, "WerfieAppShell.tsx"),
  "utf8",
);

describe("WerfieAppShell", () => {
  it("ships the four-channel WERFIE demo lineup defaulting to CH 04 news", () => {
    expect(src).toContain('station: "WERFIE MAIN"');
    expect(src).toContain('station: "CLASSIC CARTOONS"');
    expect(src).toContain('station: "ATX LOCAL NEWS"');
    expect(src).toContain('station: "NASA TV LIVE"');
    expect(src).toContain('chNumber: "04"');
    expect(src).toContain(
      'WERFIE_DEMO_LINEUP.find((p) => p.chNumber === "04")',
    );
    expect(src).toContain("Night of the Living Dead (1968)");
    expect(src).toContain("night_of_the_living_dead_512kb.mp4");
    expect(src).toContain("tears-of-steel.ism/.m3u8");
  });

  it("gates video behind POWER and rotates the ATX news ticker", () => {
    expect(src).toContain("PRESS TO UNLOCK BROADCAST AUDIO & VIDEO");
    expect(src).toContain("POWER");
    expect(src).toContain("ATX NEWS TICKER");
    expect(src).toContain("AtxNewsService.getLiveAustinHeadlines()");
    expect(src).toContain("6000");
  });
});
