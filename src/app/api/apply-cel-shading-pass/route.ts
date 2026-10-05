import { NextRequest, NextResponse } from "next/server";
import {
  applyCelShadingPassFromUrl,
  parseLightingPassConfig,
} from "@/services/celShadingPass";
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

    const body = (await req.json()) as {
      imageUrl?: unknown;
      shotId?: unknown;
      lighting?: unknown;
    };
    if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 },
      );
    }

    const lighting = parseLightingPassConfig(body.lighting);
    const shaded = await applyCelShadingPassFromUrl(body.imageUrl.trim(), lighting);
    const shotId =
      typeof body.shotId === "string" && body.shotId.trim()
        ? body.shotId.trim()
        : `cel-${Date.now()}`;
    const bucket = "studio-assets";
    const objectPath = `${shotId}/cel-shaded.png`;

    const upload = await supabaseAdmin.storage.from(bucket).upload(objectPath, shaded, {
      contentType: "image/png",
      upsert: true,
    });
    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const shadedUrl = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(objectPath).data.publicUrl;

    return NextResponse.json({
      success: true,
      mimeType: "image/png",
      shadedUrl,
      lighting,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to apply cel shading pass";
    const status =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("invalid")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
