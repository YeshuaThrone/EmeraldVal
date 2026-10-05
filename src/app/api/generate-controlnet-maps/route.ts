import { NextRequest, NextResponse } from "next/server";
import { generateControlNetMaps } from "@/services/controlNetMaps";
import { getSupabaseAdmin } from "@/internal-studio/api/supabaseAdmin";

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

    const body = (await req.json()) as { imageUrl?: unknown; shotId?: unknown };
    if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 },
      );
    }

    const maps = await generateControlNetMaps(body.imageUrl.trim());
    const shotId =
      typeof body.shotId === "string" && body.shotId.trim()
        ? body.shotId.trim()
        : `controlnet-${Date.now()}`;
    const bucket = "studio-assets";

    const lineartPath = `${shotId}/lineart.png`;
    const depthPath = `${shotId}/depth.png`;

    const lineartUpload = await supabaseAdmin.storage
      .from(bucket)
      .upload(lineartPath, maps.lineartBuffer, {
        contentType: maps.mimeType,
        upsert: true,
      });
    if (lineartUpload.error) {
      throw new Error(lineartUpload.error.message);
    }

    const depthUpload = await supabaseAdmin.storage
      .from(bucket)
      .upload(depthPath, maps.depthBuffer, {
        contentType: maps.mimeType,
        upsert: true,
      });
    if (depthUpload.error) {
      throw new Error(depthUpload.error.message);
    }

    const lineartUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(lineartPath)
      .data.publicUrl;
    const depthMapUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(depthPath)
      .data.publicUrl;

    return NextResponse.json({
      success: true,
      mimeType: maps.mimeType,
      lineartUrl,
      depthMapUrl,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate ControlNet maps";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
