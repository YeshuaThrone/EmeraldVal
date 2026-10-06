import { NextRequest, NextResponse } from "next/server";
import {
  AnimationStudioEngine,
  type RenderPipelineConfig,
} from "@/sdk/AnimationStudioEngine";
import { studioStaffFrom, studioUnauthorized } from "@/internal-studio/api/http";

function isCharacterProfile(value: unknown): value is RenderPipelineConfig["characterVault"][number] {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.seedNumber === "number" &&
    Array.isArray(record.referenceImageUrls) &&
    typeof record.voiceId === "string" &&
    typeof record.defaultPromptPrefix === "string"
  );
}

function parsePipelineBody(body: unknown): RenderPipelineConfig | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Missing required fields: projectId, masterAudioUrl, comicPanelUrls" };
  }
  const record = body as Record<string, unknown>;
  const projectId = typeof record.projectId === "string" ? record.projectId.trim() : "";
  const masterAudioUrl =
    typeof record.masterAudioUrl === "string" ? record.masterAudioUrl.trim() : "";
  const comicPanelUrls = Array.isArray(record.comicPanelUrls)
    ? record.comicPanelUrls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    : [];

  if (!projectId || !masterAudioUrl || comicPanelUrls.length === 0) {
    return {
      error: "Missing required fields: projectId, masterAudioUrl, comicPanelUrls",
    };
  }

  const characterVault = Array.isArray(record.characterVault)
    ? record.characterVault.filter(isCharacterProfile)
    : [];

  const outputResolution =
    record.outputResolution === "1080p" || record.outputResolution === "4K"
      ? record.outputResolution
      : "4K";

  return {
    projectId,
    masterAudioUrl,
    comicPanelUrls,
    characterVault,
    outputResolution,
    autoPublishToNetwork: record.autoPublishToNetwork ?? true,
  };
}

export async function POST(req: NextRequest) {
  const auth = studioStaffFrom(req);
  if (!auth.ok) return studioUnauthorized(auth);

  try {
    const parsed = parsePipelineBody(await req.json());
    if (!("projectId" in parsed)) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed;

    const engine = new AnimationStudioEngine({
      projectId: body.projectId,
      masterAudioUrl: body.masterAudioUrl,
      comicPanelUrls: body.comicPanelUrls,
      characterVault: body.characterVault || [],
      outputResolution: body.outputResolution || "4K",
      autoPublishToNetwork: body.autoPublishToNetwork ?? true,
    });

    const outputStreamUrl = await engine.runFullPipeline();

    return NextResponse.json(
      {
        success: true,
        projectId: body.projectId,
        outputStreamUrl,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("[API Error - AnimationStudioEngine]:", error);
    const message = error instanceof Error ? error.message : "Pipeline execution failed";
    return NextResponse.json(
      { error: "Pipeline execution failed", details: message },
      { status: 500 },
    );
  }
}
