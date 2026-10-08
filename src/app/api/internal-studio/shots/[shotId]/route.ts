import { NextResponse } from "next/server";
import {
  isUnavailableDb,
  updateStudioShot,
} from "@/internal-studio/api/shotsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { STUDIO_SHOT_STATUSES } from "@/internal-studio/config/studioRoles";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ shotId: string }> },
) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const { shotId } = await context.params;
  const body = (await readJsonBody(request)) as {
    status?: unknown;
    videoUrl?: unknown;
    audioStemUrl?: unknown;
    scriptText?: unknown;
    directorNotes?: unknown;
  };

  const status =
    typeof body.status === "string" &&
    (STUDIO_SHOT_STATUSES as readonly string[]).includes(body.status)
      ? (body.status as (typeof STUDIO_SHOT_STATUSES)[number])
      : undefined;

  try {
    const shot = await updateStudioShot(shotId, {
      status,
      videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : undefined,
      audioStemUrl:
        typeof body.audioStemUrl === "string" ? body.audioStemUrl : undefined,
      scriptText: typeof body.scriptText === "string" ? body.scriptText : undefined,
      directorNotes:
        typeof body.directorNotes === "string" ? body.directorNotes : undefined,
    });
    if (!shot) {
      return NextResponse.json(
        { success: false, error: "Shot not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, shot });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update studio shot" },
      { status: 500 },
    );
  }
}
