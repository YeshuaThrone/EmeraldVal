import {
  getSeeDanceApiKey,
  getSeeDanceApiUrl,
} from "../config/obviousKeys";

export interface GenerateShotInput {
  shotId: string;
  projectId: string;
  scriptText: string;
  characterSheetUrl: string;
  startingFrameUrl: string;
  cameraMotionVideoUrl: string;
  propReferenceUrl?: string;
}

export interface SeeDanceDispatchResult {
  queued: boolean;
  provider: "seedance" | "local";
  payload: Record<string, unknown>;
}

export function buildSeeDancePayload(input: GenerateShotInput) {
  return {
    engine: "SeeDance",
    mode: "3d_conditioned_shot",
    shotId: input.shotId,
    projectId: input.projectId,
    prompt: input.scriptText,
    references: {
      "@image1": input.characterSheetUrl,
      startingFrame: input.startingFrameUrl,
      cameraMotionVideo: input.cameraMotionVideoUrl,
      prop: input.propReferenceUrl,
    },
  };
}

export async function dispatchSeeDanceShot(
  input: GenerateShotInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SeeDanceDispatchResult> {
  const payload = buildSeeDancePayload(input);
  const url = getSeeDanceApiUrl(env);
  if (!url) {
    return { queued: true, provider: "local", payload };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(getSeeDanceApiKey(env)
        ? { authorization: `Bearer ${getSeeDanceApiKey(env)}` }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `SeeDance rejected the shot (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  return { queued: true, provider: "seedance", payload };
}

export function parseGenerateShotBody(body: unknown): GenerateShotInput {
  if (!body || typeof body !== "object") {
    throw new Error("Generate shot body is invalid");
  }
  const record = body as Record<string, unknown>;
  const required = [
    "shotId",
    "projectId",
    "scriptText",
    "characterSheetUrl",
    "startingFrameUrl",
    "cameraMotionVideoUrl",
  ] as const;
  for (const key of required) {
    if (typeof record[key] !== "string" || !record[key].trim()) {
      throw new Error(`${key} is required`);
    }
  }
  return {
    shotId: String(record.shotId).trim(),
    projectId: String(record.projectId).trim(),
    scriptText: String(record.scriptText).trim(),
    characterSheetUrl: String(record.characterSheetUrl).trim(),
    startingFrameUrl: String(record.startingFrameUrl).trim(),
    cameraMotionVideoUrl: String(record.cameraMotionVideoUrl).trim(),
    propReferenceUrl:
      typeof record.propReferenceUrl === "string" && record.propReferenceUrl.trim()
        ? record.propReferenceUrl.trim()
        : undefined,
  };
}
