import { describe, expect, it } from "vitest";
import {
  HOUSING_TIERS,
  TIER_MATERIALS,
  compileCartoonStructurePrompt,
  formatHousingLabel,
} from "./housingMaterials";

describe("housing materials", () => {
  it("ships five architectural tiers including Palais Rose", () => {
    expect(HOUSING_TIERS).toHaveLength(5);
    expect(TIER_MATERIALS.PALAIS_ROSE_MANSION[0]?.facade).toContain("Palais Rose");
    expect(formatHousingLabel("PALAIS_ROSE_MANSION")).toBe("PALAIS ROSE MANSION");
  });

  it("compiles a cell-shaded structure prompt", () => {
    const prompt = compileCartoonStructurePrompt({
      tier: "STONE_COTTAGE",
      style: "GHIBLI_WATERCOLOR",
      materialIndex: 0,
    });
    expect(prompt).toContain("[CARTOON_STRUCTURE]");
    expect(prompt).toContain("River Cobblestone");
    expect(prompt).toContain("GHIBLI WATERCOLOR");
    expect(prompt).toContain("clean cell shading");
  });
});
