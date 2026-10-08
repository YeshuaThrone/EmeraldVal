export type HousingTier =
  | "DIRT_SHELTER"
  | "WOODEN_CABIN"
  | "STONE_COTTAGE"
  | "SUBURBAN_HOUSE"
  | "PALAIS_ROSE_MANSION";

export type CartoonHousingStyle =
  | "GHIBLI_WATERCOLOR"
  | "SHONEN_ACTION"
  | "AMERICAN_TOON"
  | "CHIBI_MINI";

export type CartoonStyle = CartoonHousingStyle;

export interface HousingMaterialPreset {
  primary: string;
  roof: string;
  facade: string;
}

export const HOUSING_TIERS: HousingTier[] = [
  "DIRT_SHELTER",
  "WOODEN_CABIN",
  "STONE_COTTAGE",
  "SUBURBAN_HOUSE",
  "PALAIS_ROSE_MANSION",
];

export const CARTOON_HOUSING_STYLES: CartoonHousingStyle[] = [
  "GHIBLI_WATERCOLOR",
  "SHONEN_ACTION",
  "AMERICAN_TOON",
  "CHIBI_MINI",
];

export const TIER_MATERIALS: Record<HousingTier, HousingMaterialPreset[]> = {
  DIRT_SHELTER: [
    {
      primary: "Packed Red Clay Mud",
      roof: "Thatch & Palm Leaves",
      facade: "Hand-carved Earthen",
    },
    {
      primary: "Dry Dirt & Straw",
      roof: "Woven Twigs",
      facade: "Primitive Shelter",
    },
  ],
  WOODEN_CABIN: [
    {
      primary: "Weathered Oak Logs",
      roof: "Cedar Shingles",
      facade: "Rustic Frontier",
    },
    {
      primary: "Polished Pine Timber",
      roof: "Dark Slate Tiles",
      facade: "Cozy Alpine",
    },
  ],
  STONE_COTTAGE: [
    {
      primary: "River Cobblestone",
      roof: "Mossy Clay Tiles",
      facade: "Medieval Village",
    },
    {
      primary: "Rough-Cut Granite",
      roof: "Slate Shingles",
      facade: "Fantasy Outpost",
    },
  ],
  SUBURBAN_HOUSE: [
    {
      primary: "Painted Vinyl Siding",
      roof: "Asphalt Shingles",
      facade: "Modern Craftsman",
    },
    {
      primary: "Red Brick Masonry",
      roof: "Composite Tile",
      facade: "Classic Suburban",
    },
  ],
  PALAIS_ROSE_MANSION: [
    {
      primary: "Pink Marble & Gold Leaf",
      roof: "Copper Mansard Roof",
      facade: "French Neoclassical Palais Rose",
    },
    {
      primary: "Opalescent Rose Quartz",
      roof: "Polished Onyx Dome",
      facade: "Royal Beaux-Arts Empire",
    },
    {
      primary: "Pink French Marble & Carved Limestone",
      roof: "Copper Mansard & Ornate Stone Balustrades",
      facade: "Grand Trianon Neoclassical",
    },
  ],
};

export function formatHousingLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function resolveHousingMaterial(
  tier: HousingTier,
  materialIndex = 0,
): HousingMaterialPreset {
  const presets = TIER_MATERIALS[tier];
  return presets[materialIndex] ?? presets[0]!;
}

export function compileCartoonStructurePrompt(input: {
  tier: HousingTier;
  style: CartoonHousingStyle;
  materialIndex?: number;
}): string {
  const material = resolveHousingMaterial(input.tier, input.materialIndex ?? 0);
  return `[CARTOON_STRUCTURE] ${formatHousingLabel(input.tier)} featuring ${material.primary} walls with ${material.roof}. Architectural style: ${material.facade}. Art direction: rendered in ${formatHousingLabel(input.style)} animation style with clean cell shading.`;
}
