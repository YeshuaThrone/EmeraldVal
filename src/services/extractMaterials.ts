import type { CartoonHousingStyle, HousingTier } from "@/config/housingMaterials";
import { CARTOON_HOUSING_STYLES, HOUSING_TIERS } from "@/config/housingMaterials";

export interface ExtractedMaterialPreset {
  facadeMaterial: string;
  roofingMaterial: string;
  accentMaterials: string[];
  architecturalStyle: string;
  colorPalette: string[];
  confidenceScore: number;
  tier: HousingTier;
  stylePreset: CartoonHousingStyle;
}

export function compileExtractedArchPrompt(preset: ExtractedMaterialPreset): string {
  return `[EXTRACTED_ARCH] ${preset.architecturalStyle} with ${preset.facadeMaterial} facade and ${preset.roofingMaterial}. Accents: ${preset.accentMaterials.join(", ")}.`;
}

/**
 * Vision extraction stub. Returns a high-confidence Palais Rose material read
 * until a Vision LLM is wired to the uploaded frame buffer.
 */
export function extractMaterialsFromFrame(
  frameBuffer: Buffer,
): ExtractedMaterialPreset {
  if (!frameBuffer.length) {
    throw new Error("image frame is empty");
  }
  return {
    facadeMaterial: "French Rose Limestone & Polished Marble",
    roofingMaterial: "Patina Copper Mansard Roof with Slate Accents",
    accentMaterials: ["Gilded Leaf Detailing", "Wrought Iron Balconies"],
    architecturalStyle: "Palais Rose Neoclassical",
    colorPalette: ["#f43f5e", "#fef08a", "#e2e8f0", "#1e293b"],
    confidenceScore: 0.94,
    tier: "PALAIS_ROSE_MANSION",
    stylePreset: "GHIBLI_WATERCOLOR",
  };
}

export function resolveHousingTier(value: unknown, fallback: HousingTier): HousingTier {
  if (typeof value === "string" && (HOUSING_TIERS as string[]).includes(value)) {
    return value as HousingTier;
  }
  return fallback;
}

export function resolveHousingStyle(
  value: unknown,
  fallback: CartoonHousingStyle,
): CartoonHousingStyle {
  if (
    typeof value === "string" &&
    (CARTOON_HOUSING_STYLES as string[]).includes(value)
  ) {
    return value as CartoonHousingStyle;
  }
  return fallback;
}
