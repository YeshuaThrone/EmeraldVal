import { NextResponse } from "next/server";
import {
  insertCharacterModel,
  isUnavailableDb,
  listCharacterModels,
  parseCharacterModelBody,
} from "@/internal-studio/api/characterModelsRepository";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { isUuid } from "@/internal-studio/api/ids";

export async function GET(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const projectId =
    new URL(request.url).searchParams.get("projectId") ?? undefined;
  if (projectId && !isUuid(projectId)) {
    return NextResponse.json(
      { success: false, error: "projectId must be a UUID" },
      { status: 400 },
    );
  }

  try {
    const characters = await listCharacterModels(projectId);
    return NextResponse.json({ success: true, characters });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to list character models" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  try {
    const character = await insertCharacterModel(
      parseCharacterModelBody(await readJsonBody(request)),
    );
    return NextResponse.json({ success: true, character });
  } catch (err) {
    if (isUnavailableDb(err)) {
      return NextResponse.json(
        { success: false, error: "Studio database is unavailable" },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to save character model";
    const status = message.includes("required") || message.includes("must")
      ? 400
      : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
