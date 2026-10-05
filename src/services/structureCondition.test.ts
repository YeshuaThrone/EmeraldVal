import { describe, expect, it } from "vitest";
import { buildConditionedStructurePrompt } from "./structureCondition";
import {
  compileExtractedArchPrompt,
  extractMaterialsFromFrame,
} from "./extractMaterials";

describe("buildConditionedStructurePrompt", () => {
  it("applies battle damage tags and a Palais Rose label", () => {
    const result = buildConditionedStructurePrompt({
      baseStructureName: "Palais Rose North Wing",
      tier: "PALAIS_ROSE_MANSION",
      primaryMaterial: "Pink Marble & Gold Leaf",
      roofMaterial: "Copper Mansard Roof",
      condition: "BATTLE_DAMAGED",
      damageIntensity: 0.72,
    });
    expect(result.positivePrompt).toContain("[CARTOON_STRUCTURE]");
    expect(result.positivePrompt).toContain("PALAIS ROSE MANSION");
    expect(result.positivePrompt).toContain("cracked marble columns");
    expect(result.positivePrompt).toContain("damage severity level: 72%");
    expect(result.activeModifiers).toContain("scorched");
    expect(result.negativePrompt).toContain("inconsistent architectural scale");
  });
});

describe("extractMaterialsFromFrame", () => {
  it("returns a Palais Rose material read from a non-empty frame", () => {
    const preset = extractMaterialsFromFrame(Buffer.from("frame"));
    expect(preset.architecturalStyle).toBe("Palais Rose Neoclassical");
    expect(preset.confidenceScore).toBeGreaterThan(0.9);
    expect(compileExtractedArchPrompt(preset)).toContain("[EXTRACTED_ARCH]");
    expect(() => extractMaterialsFromFrame(Buffer.alloc(0))).toThrow(/empty/);
  });
});
