import { NextResponse } from "next/server";
import {
  compileAnimationPrompt,
  shotCardsFromCompiledShots,
} from "@/internal-studio/api/compilePrompt";
import { insertStudioShot, isUnavailableDb } from "@/internal-studio/api/shotsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const body = (await readJsonBody(request)) as {
    projectId?: unknown;
    artStyle?: unknown;
    sceneSetting?: unknown;
    shots?: unknown;
    script?: unknown;
    durationSecondsPerShot?: unknown;
    primaryHost?: unknown;
    secondaryHost?: unknown;
  };

  try {
    const compiled = compileAnimationPrompt({
      artStyle: typeof body.artStyle === "string" ? body.artStyle : undefined,
      sceneSetting:
        typeof body.sceneSetting === "string" ? body.sceneSetting : undefined,
      script: typeof body.script === "string" ? body.script : undefined,
      shots: Array.isArray(body.shots) ? (body.shots as never) : undefined,
      durationSecondsPerShot:
        typeof body.durationSecondsPerShot === "number"
          ? body.durationSecondsPerShot
          : undefined,
    });

    const projectId =
      typeof body.projectId === "string" && body.projectId.trim()
        ? body.projectId.trim()
        : "studio-default";

    const saved = [];
    for (const shot of compiled.shots) {
      saved.push(
        await insertStudioShot({
          projectId,
          shotId: `${projectId}-shot-${shot.index}`,
          status: "generating",
          scriptText: compiled.prompt,
        }),
      );
    }

    const primaryHost =
      typeof body.primaryHost === "string" ? body.primaryHost.trim() : "HOST_01";
    const secondaryHost =
      typeof body.secondaryHost === "string" ? body.secondaryHost.trim() : "GUEST_01";

    return NextResponse.json({
      success: true,
      prompt: compiled.prompt,
      shots: compiled.shots,
      shotCards: shotCardsFromCompiledShots(compiled.shots, {
        primary: primaryHost,
        secondary: secondaryHost,
      }),
      records: saved,
    });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to compile studio prompt";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
