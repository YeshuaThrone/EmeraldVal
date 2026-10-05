import { NextResponse } from "next/server";
import {
  dispatchSeeDanceShot,
  parseGenerateShotBody,
} from "@/internal-studio/api/generateShot";
import { readJsonBody } from "@/internal-studio/api/http";
import {
  insertStudioShot,
  isUnavailableDb,
} from "@/internal-studio/api/shotsRepository";
import { assertStudioAccess } from "@/internal-studio/auth";

export async function POST(request: Request) {
  const auth = assertStudioAccess(request.headers);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status },
    );
  }

  try {
    const input = parseGenerateShotBody(await readJsonBody(request));
    const dispatch = await dispatchSeeDanceShot(input);
    const shot = await insertStudioShot({
      projectId: input.projectId,
      shotId: input.shotId,
      status: "generating",
      scriptText: input.scriptText,
      videoUrl: input.startingFrameUrl,
      audioStemUrl: input.cameraMotionVideoUrl,
    });
    return NextResponse.json({
      success: true,
      shot,
      dispatch,
    });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to dispatch generation request";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
