import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processControlNetBuffers } from "./controlNetMaps";

describe("generateControlNetMaps", () => {
  it("emits PNG lineart and depth buffers from a keyframe", async () => {
    const input = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 40, g: 80, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const maps = await processControlNetBuffers(input);
    expect(maps.mimeType).toBe("image/png");
    expect(maps.lineartBuffer.length).toBeGreaterThan(32);
    expect(maps.depthBuffer.length).toBeGreaterThan(32);
    expect(maps.lineartBuffer.subarray(0, 8).toString("ascii")).toContain("PNG");
  });
});
