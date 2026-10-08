export type MinecraftDimension = "OVERWORLD" | "NETHER" | "THE_END";

export type ToolTier = "WOOD" | "STONE" | "IRON" | "GOLD" | "DIAMOND" | "NETHERITE";

export interface BlockDefinition {
  id: string;
  name: string;
  hardness: number;
  blastResistance: number;
  requiresTool: boolean;
  minTier: ToolTier;
  dimension: MinecraftDimension;
  isRedstoneComponent: boolean;
}

export interface MobDefinition {
  id: string;
  name: string;
  category: "PASSIVE" | "NEUTRAL" | "HOSTILE" | "BOSS";
  healthPoints: number;
  attackDamage: number;
  spawnBiomes: string[];
  drops: { itemId: string; chance: number; maxCount: number }[];
}

export interface ChemistryCompound {
  compoundId: string;
  formula: string;
  elements: { elementSymbol: string; count: number }[];
  resultItem: string;
}

export class MinecraftCoreRegistry {
  private blocks = new Map<string, BlockDefinition>();
  private mobs = new Map<string, MobDefinition>();
  private compounds = new Map<string, ChemistryCompound>();

  constructor() {
    this.registerBaseBlocks();
    this.registerBaseMobs();
    this.registerChemistry();
  }

  private registerBaseBlocks() {
    this.blocks.set("minecraft:ancient_debris", {
      id: "minecraft:ancient_debris",
      name: "Ancient Debris",
      hardness: 30.0,
      blastResistance: 1200.0,
      requiresTool: true,
      minTier: "DIAMOND",
      dimension: "NETHER",
      isRedstoneComponent: false,
    });

    this.blocks.set("minecraft:crafter", {
      id: "minecraft:crafter",
      name: "Crafter (Auto Crafter)",
      hardness: 1.5,
      blastResistance: 6.0,
      requiresTool: true,
      minTier: "WOOD",
      dimension: "OVERWORLD",
      isRedstoneComponent: true,
    });
  }

  private registerBaseMobs() {
    this.mobs.set("minecraft:warden", {
      id: "minecraft:warden",
      name: "The Warden",
      category: "HOSTILE",
      healthPoints: 500,
      attackDamage: 30,
      spawnBiomes: ["deep_dark"],
      drops: [{ itemId: "minecraft:sculk_catalyst", chance: 1.0, maxCount: 1 }],
    });

    this.mobs.set("minecraft:breeze", {
      id: "minecraft:breeze",
      name: "The Breeze",
      category: "HOSTILE",
      healthPoints: 30,
      attackDamage: 6,
      spawnBiomes: ["trial_chambers"],
      drops: [{ itemId: "minecraft:breeze_rod", chance: 1.0, maxCount: 2 }],
    });
  }

  private registerChemistry() {
    this.compounds.set("latex", {
      compoundId: "latex",
      formula: "C5H8",
      elements: [
        { elementSymbol: "C", count: 5 },
        { elementSymbol: "H", count: 8 },
      ],
      resultItem: "minecraft:latex_balloon",
    });
  }

  public getBlock(id: string): BlockDefinition | undefined {
    return this.blocks.get(id);
  }

  public getMob(id: string): MobDefinition | undefined {
    return this.mobs.get(id);
  }

  public getCompound(compoundId: string): ChemistryCompound | undefined {
    return this.compounds.get(compoundId);
  }

  public listBlocks(): BlockDefinition[] {
    return [...this.blocks.values()];
  }

  public listMobs(): MobDefinition[] {
    return [...this.mobs.values()];
  }

  public listCompounds(): ChemistryCompound[] {
    return [...this.compounds.values()];
  }
}

export const minecraftCoreRegistry = new MinecraftCoreRegistry();

export function compileMinecraftAssetPrompt(input: {
  blockId?: string;
  mobId?: string;
  compoundId?: string;
}): string {
  const parts: string[] = ["[MINECRAFT_ASSET]"];
  if (input.blockId) {
    const block = minecraftCoreRegistry.getBlock(input.blockId);
    if (!block) throw new Error(`Unknown block ${input.blockId}`);
    parts.push(
      `Block: ${block.name} (${block.dimension}, hardness ${block.hardness}, min tool ${block.minTier}).`,
    );
  }
  if (input.mobId) {
    const mob = minecraftCoreRegistry.getMob(input.mobId);
    if (!mob) throw new Error(`Unknown mob ${input.mobId}`);
    parts.push(
      `Mob: ${mob.name} ${mob.category} ${mob.healthPoints} HP, ${mob.attackDamage} ATK, biomes ${mob.spawnBiomes.join(", ")}.`,
    );
  }
  if (input.compoundId) {
    const compound = minecraftCoreRegistry.getCompound(input.compoundId);
    if (!compound) throw new Error(`Unknown compound ${input.compoundId}`);
    parts.push(
      `Chemistry: ${compound.formula} → ${compound.resultItem}.`,
    );
  }
  if (parts.length === 1) {
    throw new Error("blockId, mobId, or compoundId is required");
  }
  parts.push("Rendered as clean cartoon voxel forms with cell shading.");
  return parts.join(" ");
}
