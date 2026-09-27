import { describe, expect, it } from "vitest";
import { LowerThirdEngine } from "./lowerThirdEngine";
import { OverlayCanvas } from "./overlayCanvas";
import { CableGraphicsEngine } from "./cableGraphicsEngine";
import type {
  ChannelNetworkConfig,
  ProgramSegment,
} from "../playout/multiChannelEngine";

const show: ProgramSegment = {
  id: "s1",
  title: "East Side Lofts",
  creatorName: "Maya",
  type: "SHOW",
  videoUrl: "https://example.com/a.mp4",
  durationSeconds: 120,
  metadata: { episodeTitle: "Walkthrough", socialHandle: "@mayae" },
};

const channel: ChannelNetworkConfig = {
  channelId: "ch-haven",
  channelNumber: 2,
  channelName: "HAVEN TV",
  category: "Spaces",
  stationBugLogoUrl: "",
  programmingGrid: [],
};

describe("LowerThirdEngine", () => {
  it("is visible for the first 8 seconds of a show", () => {
    const state = LowerThirdEngine.evaluate(show, 3);
    expect(state.visible).toBe(true);
    expect(state.line1).toBe("Maya");
    expect(state.line2).toBe("Walkthrough");
  });

  it("hides after the intro window", () => {
    expect(LowerThirdEngine.evaluate(show, 8).visible).toBe(false);
  });
});

describe("OverlayCanvas", () => {
  it("composites scanlines, bug, and lower-third layers", () => {
    const overlay = CableGraphicsEngine.evaluateCableGraphics(
      channel,
      show,
      show,
      2,
    );
    const layers = OverlayCanvas.layersFromState(
      overlay,
      LowerThirdEngine.evaluate(show, 2),
    );
    expect(layers.map((layer) => layer.kind)).toEqual([
      "scanlines",
      "channel-bug",
      "lower-third",
    ]);
  });
});
