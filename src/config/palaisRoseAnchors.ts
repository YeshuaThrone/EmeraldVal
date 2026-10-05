export interface CharacterAnchorPoint {
  anchorId: string;
  locationName: string;
  depthZ: number; // Multiplane Z-depth index
  normalizedPosition: { x: number; y: number }; // Relative coordinates (0.0 to 1.0)
  recommendedScale: number; // Base scaling factor relative to room focal length
  ambientTintHex: string; // Ambient room light tint applied to character sprite
  maxCharactersAllowed: number;
}

export const PALAIS_ROSE_CHARACTER_ANCHORS: CharacterAnchorPoint[] = [
  {
    anchorId: "foyer_grand_staircase_top",
    locationName: "Grand Foyer - Top of Marble Staircase",
    depthZ: 8.5,
    normalizedPosition: { x: 0.5, y: 0.25 },
    recommendedScale: 0.75,
    ambientTintHex: "#fef08a",
    maxCharactersAllowed: 2,
  },
  {
    anchorId: "foyer_reception_center",
    locationName: "Grand Foyer - Center Reception Floor",
    depthZ: 3.2,
    normalizedPosition: { x: 0.5, y: 0.65 },
    recommendedScale: 1.2,
    ambientTintHex: "#ffffff",
    maxCharactersAllowed: 4,
  },
  {
    anchorId: "cinema_front_recliners",
    locationName: "Private Cinema - Front Recliner Seating",
    depthZ: 2.0,
    normalizedPosition: { x: 0.35, y: 0.7 },
    recommendedScale: 1.4,
    ambientTintHex: "#f43f5e",
    maxCharactersAllowed: 3,
  },
  {
    anchorId: "conservatory_banquette_table",
    locationName: "Glass Conservatory - Dining Table Center",
    depthZ: 4.5,
    normalizedPosition: { x: 0.48, y: 0.55 },
    recommendedScale: 1.0,
    ambientTintHex: "#e2e8f0",
    maxCharactersAllowed: 6,
  },
];

export interface CharacterPlacementRequest {
  characterSpriteUrl: string;
  anchorId: string;
  customScaleMultiplier?: number;
}

export interface CharacterPlacementComposite {
  spriteUrl: string;
  compositeZDepth: number;
  transformCss: string;
  lightingOverlayColor: string;
  targetLocation: string;
}

/**
 * Computes exact composite metadata for rendering a character into a Palais Rose scene.
 */
export function compileCharacterPlacement(
  request: CharacterPlacementRequest,
): CharacterPlacementComposite {
  const anchor = PALAIS_ROSE_CHARACTER_ANCHORS.find(
    (point) => point.anchorId === request.anchorId,
  );
  if (!anchor) {
    throw new Error(`Anchor ID ${request.anchorId} not found.`);
  }
  if (!request.characterSpriteUrl.trim()) {
    throw new Error("characterSpriteUrl is required");
  }

  const finalScale = Number(
    (anchor.recommendedScale * (request.customScaleMultiplier || 1)).toFixed(4),
  );

  return {
    spriteUrl: request.characterSpriteUrl,
    compositeZDepth: anchor.depthZ,
    transformCss: `translate(${anchor.normalizedPosition.x * 100}%, ${anchor.normalizedPosition.y * 100}%) scale(${finalScale})`,
    lightingOverlayColor: anchor.ambientTintHex,
    targetLocation: anchor.locationName,
  };
}

export function resolvePalaisRoseAnchor(
  anchorId: string,
): CharacterAnchorPoint | undefined {
  return PALAIS_ROSE_CHARACTER_ANCHORS.find((point) => point.anchorId === anchorId);
}
