export interface CraftingIngredient {
  itemId: string;
  count: number;
}

export type CraftingTableType =
  | "CRAFTING_TABLE"
  | "FURNACE"
  | "SMITHING_TABLE"
  | "CRAFTER";

export interface RecipeStep {
  outputItemId: string;
  outputCount: number;
  craftingTableType: CraftingTableType;
  ingredients: CraftingIngredient[];
  craftingGridPattern?: (string | null)[][];
}

export interface CraftingTreeResult {
  targetItem: string;
  targetCount: number;
  rawMaterialsNeeded: Record<string, number>;
  executionSteps: RecipeStep[];
}

export class CraftingSolverEngine {
  private recipeBook = new Map<string, RecipeStep>();

  constructor() {
    this.registerDefaultRecipes();
  }

  private registerDefaultRecipes() {
    this.recipeBook.set("minecraft:oak_planks", {
      outputItemId: "minecraft:oak_planks",
      outputCount: 4,
      craftingTableType: "CRAFTING_TABLE",
      ingredients: [{ itemId: "minecraft:oak_log", count: 1 }],
    });

    this.recipeBook.set("minecraft:stick", {
      outputItemId: "minecraft:stick",
      outputCount: 4,
      craftingTableType: "CRAFTING_TABLE",
      ingredients: [{ itemId: "minecraft:oak_planks", count: 2 }],
    });

    this.recipeBook.set("minecraft:netherite_scrap", {
      outputItemId: "minecraft:netherite_scrap",
      outputCount: 1,
      craftingTableType: "FURNACE",
      ingredients: [{ itemId: "minecraft:ancient_debris", count: 1 }],
    });

    this.recipeBook.set("minecraft:netherite_ingot", {
      outputItemId: "minecraft:netherite_ingot",
      outputCount: 1,
      craftingTableType: "CRAFTING_TABLE",
      ingredients: [
        { itemId: "minecraft:netherite_scrap", count: 4 },
        { itemId: "minecraft:gold_ingot", count: 4 },
      ],
    });

    this.recipeBook.set("minecraft:netherite_chestplate", {
      outputItemId: "minecraft:netherite_chestplate",
      outputCount: 1,
      craftingTableType: "SMITHING_TABLE",
      ingredients: [
        { itemId: "minecraft:diamond_chestplate", count: 1 },
        { itemId: "minecraft:netherite_ingot", count: 1 },
        { itemId: "minecraft:netherite_upgrade_smithing_template", count: 1 },
      ],
    });
  }

  public getRecipe(itemId: string): RecipeStep | undefined {
    return this.recipeBook.get(itemId);
  }

  /**
   * Recursively calculates all required raw materials and ordered steps to craft a target item.
   */
  public solveCraftingTree(
    itemId: string,
    desiredCount = 1,
  ): CraftingTreeResult {
    if (!itemId.trim()) {
      throw new Error("itemId is required");
    }
    if (!Number.isFinite(desiredCount) || desiredCount < 1) {
      throw new Error("desiredCount must be at least 1");
    }

    const rawMaterials: Record<string, number> = {};
    const executionSteps: RecipeStep[] = [];

    const resolveNode = (target: string, countNeeded: number) => {
      const recipe = this.recipeBook.get(target);

      if (!recipe) {
        rawMaterials[target] = (rawMaterials[target] || 0) + countNeeded;
        return;
      }

      const craftBatches = Math.ceil(countNeeded / recipe.outputCount);

      for (const ingredient of recipe.ingredients) {
        resolveNode(ingredient.itemId, ingredient.count * craftBatches);
      }

      executionSteps.push({
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) => ({
          ...ingredient,
        })),
        outputCount: recipe.outputCount * craftBatches,
      });
    };

    resolveNode(itemId, desiredCount);

    return {
      targetItem: itemId,
      targetCount: desiredCount,
      rawMaterialsNeeded: rawMaterials,
      executionSteps,
    };
  }
}

export const craftingSolverEngine = new CraftingSolverEngine();
