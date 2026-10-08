import { NextResponse } from "next/server";
import {
  insertStudioShot,
  isUnavailableDb,
  listStudioShots,
} from "@/internal-studio/api/shotsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { STUDIO_SHOT_STATUSES } from "@/internal-studio/config/studioRoles";

export async function GET(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
  try {
    const shots = await listStudioShots(projectId || undefined);
    return NextResponse.json({ success: true, shots });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to list studio shots" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const body = (await readJsonBody(request)) as {
    projectId?: unknown;
    shotId?: unknown;
    status?: unknown;
    videoUrl?: unknown;
    audioStemUrl?: unknown;
    scriptText?: unknown;
    directorNotes?: unknown;
  };

  if (typeof body.projectId !== "string" || typeof body.shotId !== "string") {
    return NextResponse.json(
      { success: false, error: "projectId and shotId are required" },
      { status: 400 },
    );
  }

  const status =
    typeof body.status === "string" &&
    (STUDIO_SHOT_STATUSES as readonly string[]).includes(body.status)
      ? (body.status as (typeof STUDIO_SHOT_STATUSES)[number])
      : "generating";

  try {
    const shot = await insertStudioShot({
      projectId: body.projectId,
      shotId: body.shotId,
      status,
      videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : null,
      audioStemUrl: typeof body.audioStemUrl === "string" ? body.audioStemUrl : null,
      scriptText: typeof body.scriptText === "string" ? body.scriptText : null,
      directorNotes:
        typeof body.directorNotes === "string" ? body.directorNotes : null,
    });
    return NextResponse.json({ success: true, shot });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to save studio shot" },
      { status: 500 },
    );
  }
}
