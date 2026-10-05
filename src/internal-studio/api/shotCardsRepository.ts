import { dbPool, isUnavailableDb } from "@/streaming/db/dbEngine";
import { ensureStudioSchema } from "../config/applyStudioSchema";
import type { ShotCardRow } from "../types";
import {
  asRecord,
  optionalTrimmed,
  optionalUuid,
  requiredInt,
  requiredTrimmed,
  requiredUuid,
} from "./ids";

export type { ShotCardRow };
export { isUnavailableDb };

export interface ShotCardInput {
  projectId: string;
  sceneNumber: number;
  shotNumber: number;
  scriptText: string;
  cameraMotion: string;
  assignedCharacterId?: string | null;
  promptOverride?: string | null;
}

function mapRow(row: Record<string, unknown>): ShotCardRow {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    scene_number: Number(row.scene_number),
    shot_number: Number(row.shot_number),
    script_text: String(row.script_text),
    camera_motion: String(row.camera_motion),
    assigned_character_id:
      row.assigned_character_id == null
        ? null
        : String(row.assigned_character_id),
    prompt_override:
      row.prompt_override == null ? null : String(row.prompt_override),
    created_at: String(row.created_at),
  };
}

export function parseShotCardBody(body: unknown): ShotCardInput {
  const record = asRecord(body, "shot card body");
  const cameraMotion = requiredTrimmed(record, "cameraMotion");
  if (cameraMotion.length > 50) {
    throw new Error("cameraMotion must be 50 characters or fewer");
  }
  return {
    projectId: requiredUuid(record, "projectId"),
    sceneNumber: requiredInt(record, "sceneNumber"),
    shotNumber: requiredInt(record, "shotNumber"),
    scriptText: requiredTrimmed(record, "scriptText"),
    cameraMotion,
    assignedCharacterId: optionalUuid(record, "assignedCharacterId"),
    promptOverride: optionalTrimmed(record, "promptOverride"),
  };
}

export async function upsertShotCard(input: ShotCardInput): Promise<ShotCardRow> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `INSERT INTO public.shot_cards (
        project_id, scene_number, shot_number, script_text,
        camera_motion, assigned_character_id, prompt_override
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (project_id, scene_number, shot_number) DO UPDATE SET
        script_text = EXCLUDED.script_text,
        camera_motion = EXCLUDED.camera_motion,
        assigned_character_id = EXCLUDED.assigned_character_id,
        prompt_override = EXCLUDED.prompt_override
     RETURNING *`,
    [
      input.projectId,
      input.sceneNumber,
      input.shotNumber,
      input.scriptText,
      input.cameraMotion,
      input.assignedCharacterId ?? null,
      input.promptOverride ?? null,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function listShotCards(filter?: {
  projectId?: string;
  sceneNumber?: number;
}): Promise<ShotCardRow[]> {
  await ensureStudioSchema();
  if (filter?.projectId && filter.sceneNumber != null) {
    const result = await dbPool.query(
      `SELECT * FROM public.shot_cards
        WHERE project_id = $1 AND scene_number = $2
        ORDER BY shot_number ASC`,
      [filter.projectId, filter.sceneNumber],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }
  if (filter?.projectId) {
    const result = await dbPool.query(
      `SELECT * FROM public.shot_cards
        WHERE project_id = $1
        ORDER BY scene_number ASC, shot_number ASC`,
      [filter.projectId],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }
  const result = await dbPool.query(
    `SELECT * FROM public.shot_cards
      ORDER BY project_id, scene_number ASC, shot_number ASC`,
  );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function updateShotCard(
  id: string,
  patch: Partial<
    Pick<
      ShotCardInput,
      | "scriptText"
      | "cameraMotion"
      | "assignedCharacterId"
      | "promptOverride"
      | "sceneNumber"
      | "shotNumber"
    >
  >,
): Promise<ShotCardRow | null> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `UPDATE public.shot_cards SET
        script_text = COALESCE($2, script_text),
        camera_motion = COALESCE($3, camera_motion),
        assigned_character_id = COALESCE($4, assigned_character_id),
        prompt_override = COALESCE($5, prompt_override),
        scene_number = COALESCE($6, scene_number),
        shot_number = COALESCE($7, shot_number)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.scriptText ?? null,
      patch.cameraMotion ?? null,
      patch.assignedCharacterId === undefined
        ? null
        : patch.assignedCharacterId,
      patch.promptOverride === undefined ? null : patch.promptOverride,
      patch.sceneNumber ?? null,
      patch.shotNumber ?? null,
    ],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}
