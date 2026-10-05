import { NextResponse } from "next/server";
import {
  isUnavailableDb,
  listShotCards,
  parseShotCardBody,
  upsertShotCard,
} from "@/internal-studio/api/shotCardsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { isUuid } from "@/internal-studio/api/ids";

export async function GET(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId") ?? undefined;
  const sceneRaw = params.get("sceneNumber");
  if (projectId && !isUuid(projectId)) {
    return NextResponse.json(
      { success: false, error: "projectId must be a UUID" },
      { status: 400 },
    );
  }
  let sceneNumber: number | undefined;
  if (sceneRaw != null && sceneRaw !== "") {
    sceneNumber = Number(sceneRaw);
    if (!Number.isInteger(sceneNumber)) {
      return NextResponse.json(
        { success: false, error: "sceneNumber must be an integer" },
        { status: 400 },
      );
    }
  }

  try {
    const cards = await listShotCards({ projectId, sceneNumber });
    return NextResponse.json({ success: true, cards });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to list shot cards" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  try {
    const card = await upsertShotCard(parseShotCardBody(await readJsonBody(request)));
    return NextResponse.json({ success: true, card });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to save shot card";
    const status =
      message.includes("required") || message.includes("must") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
