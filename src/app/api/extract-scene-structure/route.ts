import { NextRequest, NextResponse } from "next/server";
import {
  compileExtractedArchPrompt,
  extractMaterialsFromFrame,
  resolveHousingStyle,
  resolveHousingTier,
} from "@/services/extractMaterials";
import {
  buildConditionedStructurePrompt,
  parseBuildingConditionState,
} from "@/services/structureCondition";
import { getSupabaseAdmin } from "@/internal-studio/api/supabaseAdmin";

const MAX_FRAME_BYTES = 12 * 1024 * 1024;

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const imageFile = formData.get("frame");
    const projectIdRaw = formData.get("projectId");
    const projectId =
      typeof projectIdRaw === "string" ? projectIdRaw.trim() : "";

    if (!(imageFile instanceof File) || !projectId) {
      return NextResponse.json(
        { error: "Missing image frame or projectId" },
        { status: 400 },
      );
    }
    if (imageFile.size > MAX_FRAME_BYTES) {
      return NextResponse.json(
        { error: "Image frame exceeds 12MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const preset = extractMaterialsFromFrame(buffer);
    const condition = parseBuildingConditionState(formData.get("condition"));
    const damageRaw = formData.get("damageIntensity");
    const damageIntensity =
      typeof damageRaw === "string" && Number.isFinite(Number(damageRaw))
        ? Number(damageRaw)
        : 0;

    const extractedPrompt = compileExtractedArchPrompt(preset);
    const conditioned = condition
      ? buildConditionedStructurePrompt({
          baseStructureName: `Extracted - ${preset.architecturalStyle}`,
          tier: resolveHousingTier(formData.get("tier"), preset.tier),
          primaryMaterial: preset.facadeMaterial,
          roofMaterial: preset.roofingMaterial,
          condition,
          damageIntensity,
        })
      : null;

    const { data, error } = await supabaseAdmin
      .from("scene_structures")
      .insert({
        project_id: projectId,
        structure_name: `Extracted - ${preset.architecturalStyle}`,
        tier: resolveHousingTier(formData.get("tier"), preset.tier),
        style_preset: resolveHousingStyle(
          formData.get("stylePreset"),
          preset.stylePreset,
        ),
        primary_material: preset.facadeMaterial,
        roof_material: preset.roofingMaterial,
        facade_style: preset.architecturalStyle,
        generated_prompt: conditioned?.positivePrompt ?? extractedPrompt,
        negative_prompt: conditioned?.negativePrompt ?? null,
        accent_materials: preset.accentMaterials,
        color_palette: preset.colorPalette,
        confidence_score: preset.confidenceScore,
        condition: condition ?? "PRISTINE_NEW",
        damage_intensity: damageIntensity,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      preset,
      record: data,
      modifiers: conditioned?.activeModifiers ?? [],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to extract materials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
