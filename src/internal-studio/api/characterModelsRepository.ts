import { dbPool, isUnavailableDb } from "@/streaming/db/dbEngine";
import { ensureStudioSchema } from "../config/applyStudioSchema";
import type { CharacterModelRow } from "../types";
import {
  asRecord,
  optionalTrimmed,
  requiredTrimmed,
  requiredUuid,
} from "./ids";

export type { CharacterModelRow };
export { isUnavailableDb };

export interface CharacterModelInput {
  projectId: string;
  characterName: string;
  loraCheckpointUrl: string;
  turnaroundSheetUrl: string;
  faceEmbeddingId?: string | null;
}

function mapRow(row: Record<string, unknown>): CharacterModelRow {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    character_name: String(row.character_name),
    lora_checkpoint_url: String(row.lora_checkpoint_url),
    face_embedding_id:
      row.face_embedding_id == null ? null : String(row.face_embedding_id),
    turnaround_sheet_url: String(row.turnaround_sheet_url),
    created_at: String(row.created_at),
  };
}

export function parseCharacterModelBody(body: unknown): CharacterModelInput {
  const record = asRecord(body, "character model body");
  const characterName = requiredTrimmed(record, "characterName");
  if (characterName.length > 100) {
    throw new Error("characterName must be 100 characters or fewer");
  }
  const faceEmbeddingId = optionalTrimmed(record, "faceEmbeddingId");
  if (faceEmbeddingId && faceEmbeddingId.length > 128) {
    throw new Error("faceEmbeddingId must be 128 characters or fewer");
  }
  return {
    projectId: requiredUuid(record, "projectId"),
    characterName,
    loraCheckpointUrl: requiredTrimmed(record, "loraCheckpointUrl"),
    turnaroundSheetUrl: requiredTrimmed(record, "turnaroundSheetUrl"),
    faceEmbeddingId,
  };
}

export async function insertCharacterModel(
  input: CharacterModelInput,
): Promise<CharacterModelRow> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `INSERT INTO public.character_models (
        project_id, character_name, lora_checkpoint_url,
        face_embedding_id, turnaround_sheet_url
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.projectId,
      input.characterName,
      input.loraCheckpointUrl,
      input.faceEmbeddingId ?? null,
      input.turnaroundSheetUrl,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function listCharacterModels(
  projectId?: string,
): Promise<CharacterModelRow[]> {
  await ensureStudioSchema();
  const result = projectId
    ? await dbPool.query(
        `SELECT * FROM public.character_models
          WHERE project_id = $1
          ORDER BY created_at ASC`,
        [projectId],
      )
    : await dbPool.query(
        `SELECT * FROM public.character_models ORDER BY created_at ASC`,
      );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function updateCharacterModel(
  id: string,
  patch: Partial<
    Pick<
      CharacterModelInput,
      | "characterName"
      | "loraCheckpointUrl"
      | "turnaroundSheetUrl"
      | "faceEmbeddingId"
    >
  >,
): Promise<CharacterModelRow | null> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `UPDATE public.character_models SET
        character_name = COALESCE($2, character_name),
        lora_checkpoint_url = COALESCE($3, lora_checkpoint_url),
        turnaround_sheet_url = COALESCE($4, turnaround_sheet_url),
        face_embedding_id = COALESCE($5, face_embedding_id)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.characterName ?? null,
      patch.loraCheckpointUrl ?? null,
      patch.turnaroundSheetUrl ?? null,
      patch.faceEmbeddingId === undefined ? null : patch.faceEmbeddingId,
    ],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}
