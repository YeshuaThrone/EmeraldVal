import { dbPool, isUnavailableDb } from "@/streaming/db/dbEngine";
import { ensureStudioSchema } from "../config/applyStudioSchema";
import {
  compileMotionTrajectory,
  parseMotionTrajectoryPayload,
  type FormattedMotionMatrix,
  type MotionTrajectoryPayload,
} from "@/services/motionTrajectory";
import { requiredTrimmed, requiredUuid, asRecord } from "./ids";

export { isUnavailableDb };

export interface ShotMotionTrajectoryRow {
  id: string;
  shot_id: string;
  project_id: string;
  duration_seconds: number;
  zoom_factor: number;
  trajectory_points: unknown;
  camera_vector_string: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): ShotMotionTrajectoryRow {
  return {
    id: String(row.id),
    shot_id: String(row.shot_id),
    project_id: String(row.project_id),
    duration_seconds: Number(row.duration_seconds),
    zoom_factor: Number(row.zoom_factor),
    trajectory_points: row.trajectory_points,
    camera_vector_string: String(row.camera_vector_string),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function parseMotionTrajectoryBody(body: unknown): {
  projectId: string;
  payload: MotionTrajectoryPayload;
  matrix: FormattedMotionMatrix;
} {
  const record = asRecord(body, "motion trajectory body");
  const projectId = requiredUuid(record, "projectId");
  const payload = parseMotionTrajectoryPayload({
    shotId: requiredTrimmed(record, "shotId"),
    durationSeconds: record.durationSeconds,
    zoomFactor: record.zoomFactor,
    trajectoryPath: record.trajectoryPath,
  });
  return {
    projectId,
    payload,
    matrix: compileMotionTrajectory(payload),
  };
}

export async function insertMotionTrajectory(input: {
  projectId: string;
  payload: MotionTrajectoryPayload;
  matrix: FormattedMotionMatrix;
}): Promise<ShotMotionTrajectoryRow> {
  await ensureStudioSchema();
  const result = await dbPool.query(
    `INSERT INTO public.shot_motion_trajectories (
        shot_id, project_id, duration_seconds, zoom_factor,
        trajectory_points, camera_vector_string
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [
      input.payload.shotId,
      input.projectId,
      input.payload.durationSeconds,
      input.payload.zoomFactor,
      JSON.stringify(input.payload.trajectoryPath),
      input.matrix.camera_vector_string,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function listMotionTrajectories(
  shotId?: string,
): Promise<ShotMotionTrajectoryRow[]> {
  await ensureStudioSchema();
  const result = shotId
    ? await dbPool.query(
        `SELECT * FROM public.shot_motion_trajectories
          WHERE shot_id = $1
          ORDER BY created_at DESC`,
        [shotId],
      )
    : await dbPool.query(
        `SELECT * FROM public.shot_motion_trajectories
          ORDER BY created_at DESC`,
      );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}
