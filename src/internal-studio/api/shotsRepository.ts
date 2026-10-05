import { dbPool, isUnavailableDb } from "@/streaming/db/dbEngine";
import { ensureStudioSchema } from "../config/applyStudioSchema";
import {
  STUDIO_SHOT_STATUSES,
  type StudioShotStatus,
} from "../config/studioRoles";
import type { StudioShotRow } from "../types";

export type { StudioShotRow };

function asStatus(value: string): StudioShotStatus {
  if ((STUDIO_SHOT_STATUSES as readonly string[]).includes(value)) {
    return value as StudioShotStatus;
  }
  return "generating";
}

function mapRow(row: Record<string, unknown>): StudioShotRow {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    shot_id: String(row.shot_id),
    status: asStatus(String(row.status)),
    video_url: row.video_url == null ? null : String(row.video_url),
    audio_stem_url:
      row.audio_stem_url == null ? null : String(row.audio_stem_url),
    script_text: row.script_text == null ? null : String(row.script_text),
    director_notes:
      row.director_notes == null ? null : String(row.director_notes),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function insertStudioShot(input: {
  projectId: string;
  shotId: string;
  status?: StudioShotStatus;
  videoUrl?: string | null;
  audioStemUrl?: string | null;
  scriptText?: string | null;
  directorNotes?: string | null;
}): Promise<StudioShotRow> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `INSERT INTO public.studio_shots (
        project_id, shot_id, status, video_url, audio_stem_url, script_text, director_notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (shot_id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        status = EXCLUDED.status,
        video_url = COALESCE(EXCLUDED.video_url, public.studio_shots.video_url),
        audio_stem_url = COALESCE(EXCLUDED.audio_stem_url, public.studio_shots.audio_stem_url),
        script_text = COALESCE(EXCLUDED.script_text, public.studio_shots.script_text),
        director_notes = COALESCE(EXCLUDED.director_notes, public.studio_shots.director_notes),
        updated_at = NOW()
     RETURNING *`,
    [
      input.projectId,
      input.shotId,
      input.status ?? "generating",
      input.videoUrl ?? null,
      input.audioStemUrl ?? null,
      input.scriptText ?? null,
      input.directorNotes ?? null,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function listStudioShots(
  projectId?: string,
): Promise<StudioShotRow[]> {
  await ensureStudioSchema();
  const result = projectId
    ? await dbPool.query(
        `SELECT * FROM public.studio_shots WHERE project_id = $1 ORDER BY created_at ASC`,
        [projectId],
      )
    : await dbPool.query(
        `SELECT * FROM public.studio_shots ORDER BY created_at ASC`,
      );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function updateStudioShot(
  shotId: string,
  patch: {
    status?: StudioShotStatus;
    videoUrl?: string | null;
    audioStemUrl?: string | null;
    scriptText?: string | null;
    directorNotes?: string | null;
  },
): Promise<StudioShotRow | null> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `UPDATE public.studio_shots SET
        status = COALESCE($2, status),
        video_url = COALESCE($3, video_url),
        audio_stem_url = COALESCE($4, audio_stem_url),
        script_text = COALESCE($5, script_text),
        director_notes = COALESCE($6, director_notes),
        updated_at = NOW()
     WHERE shot_id = $1
     RETURNING *`,
    [
      shotId,
      patch.status ?? null,
      patch.videoUrl ?? null,
      patch.audioStemUrl ?? null,
      patch.scriptText ?? null,
      patch.directorNotes ?? null,
    ],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export { isUnavailableDb };
