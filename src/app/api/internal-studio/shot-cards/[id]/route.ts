import { NextResponse } from "next/server";
import {
  isUnavailableDb,
  updateShotCard,
} from "@/internal-studio/api/shotCardsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import {
  asRecord,
  isUuid,
  optionalTrimmed,
  optionalUuid,
} from "@/internal-studio/api/ids";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { success: false, error: "id must be a UUID" },
      { status: 400 },
    );
  }

  try {
    const record = asRecord(await readJsonBody(request), "shot card patch");
    const cameraMotion = optionalTrimmed(record, "cameraMotion");
    if (cameraMotion && cameraMotion.length > 50) {
      throw new Error("cameraMotion must be 50 characters or fewer");
    }
    const sceneNumber =
      typeof record.sceneNumber === "number" && Number.isInteger(record.sceneNumber)
        ? record.sceneNumber
        : undefined;
    const shotNumber =
      typeof record.shotNumber === "number" && Number.isInteger(record.shotNumber)
        ? record.shotNumber
        : undefined;

    const card = await updateShotCard(id, {
      scriptText: optionalTrimmed(record, "scriptText") ?? undefined,
      cameraMotion: cameraMotion ?? undefined,
      assignedCharacterId: optionalUuid(record, "assignedCharacterId"),
      promptOverride: optionalTrimmed(record, "promptOverride"),
      sceneNumber,
      shotNumber,
    });
    if (!card) {
      return NextResponse.json(
        { success: false, error: "Shot card not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, card });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to update shot card";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("must") || message.includes("invalid") ? 400 : 500 },
    );
  }
}
