export type DungeonsRarity = "COMMON" | "RARE" | "UNIQUE" | "LEGENDARY";

export interface DungeonsDrop {
  itemId: string;
  name: string;
  rarity: DungeonsRarity;
  power: number;
  ancientHunt: boolean;
}

const LOOT_BY_RARITY: Record<DungeonsRarity, { itemId: string; name: string }> = {
  COMMON: { itemId: "dungeons:hunters_promise", name: "Hunter's Promise" },
  RARE: { itemId: "dungeons:whirlwind", name: "Whirlwind" },
  UNIQUE: { itemId: "dungeons:dark_katana", name: "Dark Katana" },
  LEGENDARY: { itemId: "dungeons:obsidian_claymore", name: "Obsidian Claymore" },
};

export class DungeonsLootEngine {
  constructor(private readonly random: () => number = Math.random) {}

  public rollDrop(difficulty = 10, isAncientHunt = false): DungeonsDrop {
    const power = Math.max(1, Math.floor(Number.isFinite(difficulty) ? difficulty : 10));
    const roll = this.random();
    const rarity = isAncientHunt
      ? roll > 0.85
        ? "LEGENDARY"
        : roll > 0.5
          ? "UNIQUE"
          : "RARE"
      : roll > 0.97
        ? "LEGENDARY"
        : roll > 0.85
          ? "UNIQUE"
          : roll > 0.5
            ? "RARE"
            : "COMMON";
    const item = LOOT_BY_RARITY[rarity];
    return {
      ...item,
      rarity,
      power,
      ancientHunt: isAncientHunt,
    };
  }
}
