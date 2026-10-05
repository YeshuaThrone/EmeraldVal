import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isPillarCutMetadata,
  stitchShotsAtPillarCut,
} from "@/utils/ffmpegStitcher";
import * as path from "path";
import * as fs from "fs";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, key);
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download clip (${response.status})`);
  }
  fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-obvious-signature");
    if (authHeader !== process.env.OBVIOUS_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized webhook signature" },
        { status: 401 },
      );
    }

    const payload = (await req.json()) as {
      projectId?: string;
      shotId?: string;
      videoUrl?: string;
      scriptText?: string;
      metadata?: unknown;
    };
    const { projectId, shotId, videoUrl, scriptText, metadata } = payload;
    if (!projectId || !shotId || !videoUrl) {
      return NextResponse.json(
        { error: "projectId, shotId, and videoUrl are required" },
        { status: 400 },
      );
    }

    let finalVideoUrl = videoUrl;
    const supabaseAdmin = getSupabaseAdmin();

    if (isPillarCutMetadata(metadata)) {
      const { data: previousShot } = await supabaseAdmin
        .from("studio_shots")
        .select("video_url")
        .eq("shot_id", metadata.previous_shot_id)
        .single();

      if (previousShot?.video_url) {
        const tmpDir = path.join(process.cwd(), "tmp");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

        const shotAPath = path.join(tmpDir, `shot_a_${Date.now()}.mp4`);
        const shotBPath = path.join(tmpDir, `shot_b_${Date.now()}.mp4`);
        const outputPath = path.join(tmpDir, `stitched_${Date.now()}.mp4`);

        try {
          await downloadToFile(previousShot.video_url, shotAPath);
          await downloadToFile(videoUrl, shotBPath);

          await stitchShotsAtPillarCut({
            shotAVideoPath: shotAPath,
            shotBVideoPath: shotBPath,
            outputPath,
          });

          const fileBuffer = fs.readFileSync(outputPath);
          const storagePath = `stitched/${projectId}/${shotId}_stitched.mp4`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("studio-assets")
            .upload(storagePath, fileBuffer, {
              contentType: "video/mp4",
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabaseAdmin.storage
              .from("studio-assets")
              .getPublicUrl(storagePath);
            finalVideoUrl = publicUrlData.publicUrl;
          }
        } finally {
          for (const filePath of [shotAPath, shotBPath, outputPath]) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("studio_shots")
      .upsert(
        {
          project_id: projectId,
          shot_id: shotId,
          video_url: finalVideoUrl,
          script_text: scriptText,
          status: "pending_review",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shot_id" },
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: data }, { status: 200 });
  } catch (err: unknown) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 },
    );
  }
}
