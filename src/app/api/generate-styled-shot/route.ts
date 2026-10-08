import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  COMPLETE_30_ANIMATION_STYLES,
  isAnimationStyleType,
  type AnimationStyleType,
} from "@/config/animationStyles";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, key);
}

interface GenerateStyledShotBody {
  shotId: string;
  projectId: string;
  styleType: AnimationStyleType;
  scriptText: string;
  characterSheetUrl: string;
  startingFrameUrl: string;
  cameraMotionVideoUrl: string;
  propReferenceUrl?: string;
  previousShotId?: string;
}

function parseBody(raw: unknown): GenerateStyledShotBody {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid generate-styled-shot body");
  }
  const record = raw as Record<string, unknown>;
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
  if (typeof record.styleType !== "string") {
    throw new Error("styleType is required");
  }
  return {
    shotId: record.shotId.trim(),
    projectId: record.projectId.trim(),
    styleType: record.styleType as AnimationStyleType,
    scriptText: record.scriptText.trim(),
    characterSheetUrl: record.characterSheetUrl.trim(),
    startingFrameUrl: record.startingFrameUrl.trim(),
    cameraMotionVideoUrl: record.cameraMotionVideoUrl.trim(),
    propReferenceUrl:
      typeof record.propReferenceUrl === "string" && record.propReferenceUrl.trim()
        ? record.propReferenceUrl.trim()
        : undefined,
    previousShotId:
      typeof record.previousShotId === "string" && record.previousShotId.trim()
        ? record.previousShotId.trim()
        : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = parseBody(await req.json());
    const {
      shotId,
      projectId,
      styleType,
      scriptText,
      characterSheetUrl,
      startingFrameUrl,
      cameraMotionVideoUrl,
      propReferenceUrl,
      previousShotId,
    } = body;

    if (!isAnimationStyleType(styleType)) {
      return NextResponse.json(
        {
          error: `Invalid styleType '${styleType}'. Must be one of the 30 valid presets.`,
        },
        { status: 400 },
      );
    }

    const selectedPreset = COMPLETE_30_ANIMATION_STYLES[styleType];
    const fullPrompt = `${selectedPreset.promptDirective} Action: ${scriptText}. Maintain steady camera motion.`;
    const seeDanceUrl =
      process.env.SEEDANCE_API_URL || "https://api.seedance.ai/v2/generate";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const seeDancePayload = {
      model: "seedance-v2-pro",
      duration: 10,
      aspect_ratio: "16:9",
      conditioning: {
        style_and_character: {
          image_url: characterSheetUrl,
          weight: selectedPreset.styleWeight,
          instruction: `Enforce ${selectedPreset.name} visual design.`,
        },
        first_frame: {
          image_url: startingFrameUrl,
          weight: 1.0,
        },
        motion_vector: {
          video_url: cameraMotionVideoUrl,
          type: "camera_only",
          weight: 0.95,
          instruction: "Follow camera trajectory strictly.",
        },
        ...(propReferenceUrl && {
          prop_reference: {
            image_url: propReferenceUrl,
            weight: 0.9,
          },
        }),
      },
      prompt: fullPrompt,
      negative_prompt: selectedPreset.negativePrompt,
      callback_url: `${appUrl}/api/webhooks/obvious`,
      metadata: {
        shot_id: shotId,
        project_id: projectId,
        animation_style: styleType,
        previous_shot_id: previousShotId || null,
      },
    };

    const seeDanceResponse = await fetch(seeDanceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SEEDANCE_API_KEY ?? ""}`,
      },
      body: JSON.stringify(seeDancePayload),
    });

    if (!seeDanceResponse.ok) {
      const errText = await seeDanceResponse.text();
      throw new Error(
        `SeeDance Engine Error (${seeDanceResponse.status}): ${errText}`,
      );
    }

    const generationData = (await seeDanceResponse.json()) as {
      job_id?: string;
    };

    await supabaseAdmin.from("studio_shots").upsert(
      {
        shot_id: shotId,
        project_id: projectId,
        animation_style: styleType,
        status: "generating",
        script_text: scriptText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shot_id" },
    );

    return NextResponse.json({
      success: true,
      jobId: generationData.job_id,
      shotId,
      styleApplied: selectedPreset.name,
      category: selectedPreset.category,
    });
  } catch (err: unknown) {
    console.error("Styled shot generation failed:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
