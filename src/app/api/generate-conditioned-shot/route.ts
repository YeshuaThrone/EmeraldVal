import { NextRequest, NextResponse } from "next/server";
import {
  compileConditioningPayload,
  parseAdvancedShotConditioningPayload,
} from "@/services/conditioningPipeline";
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

    const body = parseAdvancedShotConditioningPayload(await req.json());
    const compiledPayload = compileConditioningPayload(body);

    const { error: dbError } = await supabaseAdmin.from("shot_render_jobs").insert({
      shot_id: body.shotId,
      project_id: body.projectId,
      user_id: user.id,
      status: "queued",
      payload: compiledPayload,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Shot dispatched to production queue",
      job: compiledPayload,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Internal server error";
    const status =
      errorMessage.includes("required") || errorMessage.includes("invalid")
        ? 400
        : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
