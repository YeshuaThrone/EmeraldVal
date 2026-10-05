import { NextResponse } from "next/server";
import {
  parseObviousWebhook,
  verifyObviousSignature,
} from "@/internal-studio/api/obviousWebhooks";
import {
  insertStudioShot,
  isUnavailableDb,
  updateStudioShot,
} from "@/internal-studio/api/shotsRepository";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (
    !verifyObviousSignature(rawBody, request.headers.get("x-obvious-signature"))
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid Obvious webhook signature" },
      { status: 403 },
    );
  }

  let parsed: unknown = {};
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { success: false, error: "Obvious webhook body is invalid" },
      { status: 400 },
    );
  }

  try {
    const event = parseObviousWebhook(parsed);
    if (!event.shotId) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const status =
      event.event === "review.approved"
        ? "approved"
        : event.event === "review.rejected" || event.event === "shot.failed"
          ? "rejected"
          : event.event === "shot.ready" || event.event === "stitch.complete"
            ? "pending_review"
            : "generating";

    const row = await updateStudioShot(event.shotId, {
      status,
      videoUrl: event.videoUrl,
      audioStemUrl: event.audioStemUrl,
      directorNotes: event.notes,
    });

    if (row) {
      return NextResponse.json({ success: true, shot: row, event: event.event });
    }

    const created = await insertStudioShot({
      projectId: event.projectId ?? "studio-default",
      shotId: event.shotId,
      status,
      videoUrl: event.videoUrl,
      audioStemUrl: event.audioStemUrl,
      directorNotes: event.notes,
    });
    return NextResponse.json({ success: true, shot: created, event: event.event });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Obvious webhook failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
