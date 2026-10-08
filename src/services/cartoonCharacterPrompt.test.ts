import { describe, expect, it } from "vitest";
import {
  buildCartoonCharacterPrompt,
  collectCartoonNegativePrompt,
  parseCharacterStateConfig,
} from "./cartoonCharacterPrompt";

describe("buildCartoonCharacterPrompt", () => {
  it("locks props to anchors and maps cartoon expressions", () => {
    const prompt = buildCartoonCharacterPrompt(
      parseCharacterStateConfig({
        characterName: "Maya",
        baseEmbeddingId: "face-maya-01",
        expressionTag: "COMEDIC_SHOCK",
        activeProps: [
          {
            propId: "hammer-1",
            propName: "cartoon mallet",
            anchorPoint: "RIGHT_HAND",
            visualPromptModifier: "oversized rubber mallet with a star impact",
            negativePromptModifier: "realistic steel hammer",
          },
        ],
      }),
    );

    expect(prompt).toContain("[CARTOON_STYLE]");
    expect(prompt).toContain("Character: Maya");
    expect(prompt).toContain("exaggerated cartoon shock expression");
    expect(prompt).toContain("holding cartoon mallet in right_hand");
    expect(prompt).toContain("cell-shaded animation style");
  });

  it("omits equipped props when the character is empty-handed", () => {
    const config = parseCharacterStateConfig({
      characterName: "Maya",
      baseEmbeddingId: "face-maya-01",
      expressionTag: "NEUTRAL",
      activeProps: [],
    });
    const prompt = buildCartoonCharacterPrompt(config);
    expect(prompt).not.toContain("Equipped Props");
    expect(collectCartoonNegativePrompt(config)).toBe("");
  });
});
