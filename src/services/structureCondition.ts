import {
  formatHousingLabel,
  type HousingTier,
} from "@/config/housingMaterials";

export type BuildingConditionState =
  | "PRISTINE_NEW"
  | "WEATHERED_AGED"
  | "BATTLE_DAMAGED"
  | "OVERGROWN_RUINS";

export interface StructureStateConfig {
  baseStructureName: string;
  tier: HousingTier;
  primaryMaterial: string;
  roofMaterial: string;
  condition: BuildingConditionState;
  damageIntensity: number; // 0.0 (intact) to 1.0 (destroyed)
}

const CONDITION_STATES = new Set<BuildingConditionState>([
  "PRISTINE_NEW",
  "WEATHERED_AGED",
  "BATTLE_DAMAGED",
  "OVERGROWN_RUINS",
]);

const STATE_MODIFIERS: Record<
  BuildingConditionState,
  { prompt: string; tags: string[] }
> = {
  PRISTINE_NEW: {
    prompt:
      "immaculate condition, freshly constructed, spotless polished surfaces, pristine structural integrity",
    tags: ["clean", "new", "pristine"],
  },
  WEATHERED_AGED: {
    prompt:
      "subtle environmental weathering, faded paint textures, moss-covered corners, aged marble patina, wind-worn stone",
    tags: ["aged", "weathered", "mossy"],
  },
  BATTLE_DAMAGED: {
    prompt:
      "action scene damage, cracked marble columns, blast marks, scorched facade, broken roof tiles, smoke trails, structural breach",
    tags: ["damaged", "scratched", "scorched", "cracked"],
  },
  OVERGROWN_RUINS: {
    prompt:
      "abandoned architectural ruins, heavy ivy vines covering walls, collapsed roof sections, nature reclaiming structure, atmospheric decay",
    tags: ["ruins", "abandoned", "overgrown", "ivy"],
  },
};

/**
 * Modifies structural prompts with dynamic damage and weathering modifiers.
 */
export function buildConditionedStructurePrompt(config: StructureStateConfig): {
  positivePrompt: string;
  negativePrompt: string;
  activeModifiers: string[];
} {
  const activeState = STATE_MODIFIERS[config.condition];
  const clampedIntensity = Math.min(Math.max(config.damageIntensity, 0), 1);
  const intensityTag = `damage severity level: ${(clampedIntensity * 100).toFixed(0)}%`;

  const positivePrompt = `[CARTOON_STRUCTURE] ${config.baseStructureName} (${formatHousingLabel(config.tier)}). Primary Materials: ${config.primaryMaterial}, ${config.roofMaterial}. State: ${activeState.prompt}. ${intensityTag}. Maintaining clean cartoon line art and cell shading.`;

  const negativePrompt =
    "blurry textures, flat lighting, inconsistent architectural scale, messy composition";

  return {
    positivePrompt,
    negativePrompt,
    activeModifiers: [...activeState.tags, intensityTag],
  };
}

export function parseBuildingConditionState(
  value: unknown,
): BuildingConditionState | undefined {
  if (typeof value !== "string" || !CONDITION_STATES.has(value as BuildingConditionState)) {
    return undefined;
  }
  return value as BuildingConditionState;
}
