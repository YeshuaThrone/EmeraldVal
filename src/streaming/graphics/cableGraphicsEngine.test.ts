import { describe, expect, it } from "vitest";
import { CableGraphicsEngine } from "./cableGraphicsEngine";
import type {
  ChannelNetworkConfig,
  ProgramSegment,
} from "../playout/multiChannelEngine";

const channel: ChannelNetworkConfig = {
  channelId: "ch-haven",
  channelNumber: 2,
  channelName: "HAVEN TV",
  category: "Real Estate & Spaces",
  stationBugLogoUrl: "https://cdn.example.com/haven.png",
  programmingGrid: [],
};

const show: ProgramSegment = {
  id: "show-1",
  title: "East Side Lofts",
  creatorName: "Maya",
  type: "SHOW",
  videoUrl: "https://cdn.example.com/show.mp4",
  durationSeconds: 120,
};

const next: ProgramSegment = {
  id: "promo-1",
  title: "Spotlight",
  creatorName: "Jordan",
  creatorAvatarUrl: "https://cdn.example.com/j.png",
  type: "CREATOR_PROMO",
  videoUrl: "https://cdn.example.com/promo.mp4",
  durationSeconds: 30,
  metadata: { socialHandle: "@jordan" },
};

describe("CableGraphicsEngine", () => {
  it("keeps the station bug visible", () => {
    const overlay = CableGraphicsEngine.evaluateCableGraphics(
      channel,
      show,
      next,
      10,
    );
    expect(overlay.channelBug).toEqual({
      visible: true,
      logoUrl: "https://cdn.example.com/haven.png",
      channelName: "HAVEN TV",
      channelNumber: 2,
    });
    expect(overlay.interludePromo.visible).toBe(false);
  });

  it("shows UP NEXT in the last 15 seconds of a show", () => {
    const overlay = CableGraphicsEngine.evaluateCableGraphics(
      channel,
      show,
      next,
      110,
    );
    expect(overlay.interludePromo).toMatchObject({
      visible: true,
      promoType: "UP_NEXT",
      creatorName: "Jordan",
      showTitle: "Spotlight",
      socialHandle: "@jordan",
    });
  });

  it("spotlights the creator during promo interludes", () => {
    const overlay = CableGraphicsEngine.evaluateCableGraphics(
      channel,
      next,
      show,
      2,
    );
    expect(overlay.interludePromo.promoType).toBe("CREATOR_SPOTLIGHT");
    expect(overlay.interludePromo.creatorName).toBe("Jordan");
  });
});
