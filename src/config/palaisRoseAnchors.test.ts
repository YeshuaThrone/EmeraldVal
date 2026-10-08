import { describe, expect, it } from "vitest";
import {
  PALAIS_ROSE_CHARACTER_ANCHORS,
  compileCharacterPlacement,
} from "./palaisRoseAnchors";

describe("Palais Rose character anchors", () => {
  it("places a sprite on the foyer staircase with chandelier tint", () => {
    expect(PALAIS_ROSE_CHARACTER_ANCHORS).toHaveLength(4);
    const placement = compileCharacterPlacement({
      characterSpriteUrl: "https://cdn.example/maya.png",
      anchorId: "foyer_grand_staircase_top",
      customScaleMultiplier: 1.1,
    });
    expect(placement.targetLocation).toContain("Marble Staircase");
    expect(placement.compositeZDepth).toBe(8.5);
    expect(placement.lightingOverlayColor).toBe("#fef08a");
    expect(placement.transformCss).toContain("translate(50%, 25%)");
    expect(placement.transformCss).toContain("scale(0.825)");
  });

  it("rejects unknown anchors", () => {
    expect(() =>
      compileCharacterPlacement({
        characterSpriteUrl: "https://cdn.example/maya.png",
        anchorId: "garden_hedge",
      }),
    ).toThrow(/Anchor ID garden_hedge not found/);
  });
});
