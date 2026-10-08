import { describe, expect, it } from "vitest";
import { CraftingSolverEngine } from "./craftingSolverEngine";

describe("CraftingSolverEngine", () => {
  const solver = new CraftingSolverEngine();

  it("turns one oak log into four sticks via planks", () => {
    const tree = solver.solveCraftingTree("minecraft:stick", 4);
    expect(tree.rawMaterialsNeeded["minecraft:oak_log"]).toBe(1);
    expect(tree.executionSteps.map((step) => step.outputItemId)).toEqual([
      "minecraft:oak_planks",
      "minecraft:stick",
    ]);
  });

  it("resolves a netherite chestplate to debris, gold, diamond armor, and a template", () => {
    const tree = solver.solveCraftingTree("minecraft:netherite_chestplate");
    expect(tree.rawMaterialsNeeded).toEqual({
      "minecraft:ancient_debris": 4,
      "minecraft:gold_ingot": 4,
      "minecraft:diamond_chestplate": 1,
      "minecraft:netherite_upgrade_smithing_template": 1,
    });
    expect(tree.executionSteps.at(-1)?.craftingTableType).toBe("SMITHING_TABLE");
    expect(tree.executionSteps.some((step) => step.craftingTableType === "FURNACE")).toBe(
      true,
    );
  });
});
