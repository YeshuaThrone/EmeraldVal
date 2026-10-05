export type CartoonPropAnchor =
  | "LEFT_HAND"
  | "RIGHT_HAND"
  | "HEAD_GEAR"
  | "BACK_SLOT";

export type CartoonExpressionTag =
  | "NEUTRAL"
  | "EXCITED"
  | "COMEDIC_SHOCK"
  | "DETERMINED";

export interface CartoonPropState {
  propId: string;
  propName: string;
  anchorPoint: CartoonPropAnchor;
  visualPromptModifier: string;
  negativePromptModifier?: string;
}

export interface CharacterStateConfig {
  characterName: string;
  baseEmbeddingId: string;
  activeProps: CartoonPropState[];
  expressionTag: CartoonExpressionTag;
}

const EXPRESSION_MAP: Record<CartoonExpressionTag, string> = {
  NEUTRAL: "standard anime expression",
  EXCITED: "vibrant cartoon expression, oversized starry eyes, wide smile",
  COMEDIC_SHOCK: "exaggerated cartoon shock expression, jaw drop, wide pupils",
  DETERMINED: "sharp intense gaze, anime action focus face",
};

const ANCHOR_POINTS = new Set<CartoonPropAnchor>([
  "LEFT_HAND",
  "RIGHT_HAND",
  "HEAD_GEAR",
  "BACK_SLOT",
]);

const EXPRESSION_TAGS = new Set<CartoonExpressionTag>([
  "NEUTRAL",
  "EXCITED",
  "COMEDIC_SHOCK",
  "DETERMINED",
]);

/**
 * Constructs a fully conditioned cartoon character prompt with prop lock-in.
 */
export function buildCartoonCharacterPrompt(config: CharacterStateConfig): string {
  const propModifiers = config.activeProps
    .map(
      (prop) =>
        `holding ${prop.propName} in ${prop.anchorPoint.toLowerCase()} (${prop.visualPromptModifier})`,
    )
    .join(", ");

  const expression =
    EXPRESSION_MAP[config.expressionTag] || EXPRESSION_MAP.NEUTRAL;

  return `[CARTOON_STYLE] Character: ${config.characterName}. Expression: ${expression}. ${
    propModifiers ? `Equipped Props: ${propModifiers}.` : ""
  } Maintaining clean lineart and cell-shaded animation style.`;
}

export function collectCartoonNegativePrompt(config: CharacterStateConfig): string {
  return config.activeProps
    .map((prop) => prop.negativePromptModifier?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

export function parseCharacterStateConfig(raw: unknown): CharacterStateConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("characterState is invalid");
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.characterName !== "string" || !record.characterName.trim()) {
    throw new Error("characterName is required");
  }
  if (typeof record.baseEmbeddingId !== "string" || !record.baseEmbeddingId.trim()) {
    throw new Error("baseEmbeddingId is required");
  }
  const expressionTag = record.expressionTag;
  if (typeof expressionTag !== "string" || !EXPRESSION_TAGS.has(expressionTag as CartoonExpressionTag)) {
    throw new Error("expressionTag is invalid");
  }
  if (!Array.isArray(record.activeProps)) {
    throw new Error("activeProps is required");
  }

  const activeProps = record.activeProps.map((prop, index) => {
    if (!prop || typeof prop !== "object") {
      throw new Error(`activeProps[${index}] is invalid`);
    }
    const entry = prop as Record<string, unknown>;
    const anchorPoint = entry.anchorPoint;
    if (typeof anchorPoint !== "string" || !ANCHOR_POINTS.has(anchorPoint as CartoonPropAnchor)) {
      throw new Error(`activeProps[${index}].anchorPoint is invalid`);
    }
    if (typeof entry.propId !== "string" || !entry.propId.trim()) {
      throw new Error(`activeProps[${index}].propId is required`);
    }
    if (typeof entry.propName !== "string" || !entry.propName.trim()) {
      throw new Error(`activeProps[${index}].propName is required`);
    }
    if (typeof entry.visualPromptModifier !== "string" || !entry.visualPromptModifier.trim()) {
      throw new Error(`activeProps[${index}].visualPromptModifier is required`);
    }
    return {
      propId: entry.propId.trim(),
      propName: entry.propName.trim(),
      anchorPoint: anchorPoint as CartoonPropAnchor,
      visualPromptModifier: entry.visualPromptModifier.trim(),
      negativePromptModifier:
        typeof entry.negativePromptModifier === "string"
          ? entry.negativePromptModifier
          : undefined,
    };
  });

  return {
    characterName: record.characterName.trim(),
    baseEmbeddingId: record.baseEmbeddingId.trim(),
    activeProps,
    expressionTag: expressionTag as CartoonExpressionTag,
  };
}
