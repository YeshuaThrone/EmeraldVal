import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { applyCelShadingPass, parseLightingPassConfig } from "./celShadingPass";

describe("applyCelShadingPass", () => {
  it("returns a PNG with directional multiply lighting", async () => {
    const input = await sharp({
      create: {
        width: 24,
        height: 16,
        channels: 3,
        background: { r: 240, g: 180, b: 90 },
      },
    })
      .png()
      .toBuffer();

    const output = await applyCelShadingPass(input, {
      sunAngleDegrees: 45,
      shadowIntensity: 0.6,
      ambientColorHex: "#fef3c7",
      celSteps: 2,
    });

    expect(output.subarray(0, 8).toString("ascii")).toContain("PNG");
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(24);
    expect(meta.height).toBe(16);
  });

  it("rejects a bad ambient tint", () => {
    expect(() =>
      parseLightingPassConfig({
        sunAngleDegrees: 90,
        shadowIntensity: 0.4,
        ambientColorHex: "navy-blue",
        celSteps: 2,
      }),
    ).toThrow(/ambientColorHex/);
  });
});
