import { NextResponse } from "next/server";
import {
  isUnavailableDb,
  updateCharacterModel,
} from "@/internal-studio/api/characterModelsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { isUuid, optionalTrimmed, asRecord } from "@/internal-studio/api/ids";

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
    const record = asRecord(await readJsonBody(request), "character model patch");
    const characterName = optionalTrimmed(record, "characterName");
    const loraCheckpointUrl = optionalTrimmed(record, "loraCheckpointUrl");
    const turnaroundSheetUrl = optionalTrimmed(record, "turnaroundSheetUrl");
    const faceEmbeddingId = optionalTrimmed(record, "faceEmbeddingId");
    if (characterName && characterName.length > 100) {
      throw new Error("characterName must be 100 characters or fewer");
    }
    if (faceEmbeddingId && faceEmbeddingId.length > 128) {
      throw new Error("faceEmbeddingId must be 128 characters or fewer");
    }

    const character = await updateCharacterModel(id, {
      characterName: characterName ?? undefined,
      loraCheckpointUrl: loraCheckpointUrl ?? undefined,
      turnaroundSheetUrl: turnaroundSheetUrl ?? undefined,
      faceEmbeddingId: faceEmbeddingId,
    });
    if (!character) {
      return NextResponse.json(
        { success: false, error: "Character model not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, character });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to update character model";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("must") ? 400 : 500 },
    );
  }
}
