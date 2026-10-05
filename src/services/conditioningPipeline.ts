export interface MotionVectorConfig {
  type: "pan" | "zoom" | "tilt" | "orbit" | "camera_only";
  speed: number;
  videoUrl?: string;
}

export interface CharacterReferenceConfig {
  characterId: string;
  turnaroundSheetUrl: string;
  faceEmbeddingUrl?: string;
  weight: number;
}

export interface ControlNetMapConfig {
  depthMapUrl?: string;
  lineartUrl?: string;
  poseMapUrl?: string;
  weight: number;
}

export interface AdvancedShotConditioningPayload {
  shotId: string;
  projectId: string;
  prompt: string;
  negativePrompt: string;
  characterRef: CharacterReferenceConfig;
  controlNet?: ControlNetMapConfig;
  motionVector: MotionVectorConfig;
  seed: number;
}

const MOTION_TYPES = new Set<MotionVectorConfig["type"]>([
  "pan",
  "zoom",
  "tilt",
  "orbit",
  "camera_only",
]);

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function compileConditioningPayload(
  config: AdvancedShotConditioningPayload,
) {
  const structuredPrompt = [
    `[CHARACTER_LOCK: ${config.characterRef.characterId}]`,
    `[CAMERA_MOTION: ${config.motionVector.type} SPEED=${config.motionVector.speed}]`,
    config.prompt,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    shot_id: config.shotId,
    project_id: config.projectId,
    generation_params: {
      prompt: structuredPrompt,
      negative_prompt: config.negativePrompt,
      seed: config.seed,
    },
    conditioning_layers: {
      ip_adapter: {
        image_url: config.characterRef.turnaroundSheetUrl,
        face_embedding: config.characterRef.faceEmbeddingUrl || null,
        weight: clamp01(config.characterRef.weight),
      },
      controlnet: config.controlNet
        ? {
            depth_map: config.controlNet.depthMapUrl || null,
            lineart_map: config.controlNet.lineartUrl || null,
            pose_map: config.controlNet.poseMapUrl || null,
            weight: clamp01(config.controlNet.weight),
          }
        : null,
      motion_vector: {
        type: config.motionVector.type,
        speed: config.motionVector.speed,
        reference_video: config.motionVector.videoUrl || null,
      },
    },
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

export function parseAdvancedShotConditioningPayload(
  raw: unknown,
): AdvancedShotConditioningPayload {
  const record = asRecord(raw, "conditioning payload");
  const characterRef = asRecord(record.characterRef, "characterRef");
  const motionVector = asRecord(record.motionVector, "motionVector");
  const motionType = requiredString(motionVector, "type");
  if (!MOTION_TYPES.has(motionType as MotionVectorConfig["type"])) {
    throw new Error("motionVector.type is invalid");
  }

  const controlRaw = record.controlNet;
  const controlNet = controlRaw
    ? (() => {
        const control = asRecord(controlRaw, "controlNet");
        return {
          depthMapUrl:
            typeof control.depthMapUrl === "string"
              ? control.depthMapUrl
              : undefined,
          lineartUrl:
            typeof control.lineartUrl === "string"
              ? control.lineartUrl
              : undefined,
          poseMapUrl:
            typeof control.poseMapUrl === "string"
              ? control.poseMapUrl
              : undefined,
          weight: requiredNumber(control, "weight"),
        };
      })()
    : undefined;

  return {
    shotId: requiredString(record, "shotId"),
    projectId: requiredString(record, "projectId"),
    prompt: requiredString(record, "prompt"),
    negativePrompt:
      typeof record.negativePrompt === "string" ? record.negativePrompt : "",
    characterRef: {
      characterId: requiredString(characterRef, "characterId"),
      turnaroundSheetUrl: requiredString(characterRef, "turnaroundSheetUrl"),
      faceEmbeddingUrl:
        typeof characterRef.faceEmbeddingUrl === "string"
          ? characterRef.faceEmbeddingUrl
          : undefined,
      weight: requiredNumber(characterRef, "weight"),
    },
    controlNet,
    motionVector: {
      type: motionType as MotionVectorConfig["type"],
      speed: requiredNumber(motionVector, "speed"),
      videoUrl:
        typeof motionVector.videoUrl === "string"
          ? motionVector.videoUrl
          : undefined,
    },
    seed: requiredNumber(record, "seed"),
  };
}
