import { describe, expect, it } from "vitest";
import { ChannelScheduler } from "./channelScheduler";
import type { ScheduledAsset } from "./hlsMasterGenerator";

const assets: ScheduledAsset[] = [
  {
    id: "a",
    title: "Set A",
    type: "CONTENT",
    streamUrl: "https://cdn.example.com/a",
    durationSeconds: 30,
  },
  {
    id: "b",
    title: "Ad B",
    type: "AD",
    streamUrl: "https://cdn.example.com/b",
    durationSeconds: 10,
  },
];

describe("ChannelScheduler", () => {
  const scheduler = new ChannelScheduler(assets);

  it("returns the first asset at loop start", () => {
    const slot = scheduler.resolveCurrentSlot(new Date(0));
    expect(slot.asset.id).toBe("a");
    expect(slot.offsetSeconds).toBe(0);
  });

  it("returns the second asset after the first duration", () => {
    const slot = scheduler.resolveCurrentSlot(new Date(35 * 1000));
    expect(slot.asset.id).toBe("b");
    expect(slot.offsetSeconds).toBe(5);
  });

  it("throws when the grid is empty", () => {
    expect(() => new ChannelScheduler([]).resolveCurrentSlot()).toThrow(
      /no scheduled assets/,
    );
  });
});
