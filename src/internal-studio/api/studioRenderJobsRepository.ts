import { dbPool, isUnavailableDb } from "@/streaming/db/dbEngine";
import { ensureStudioSchema } from "../config/applyStudioSchema";
import type { PipelineStage, StudioRenderJobData } from "@/sdk/studio-engine";

export interface StudioRenderJobRecord {
  id: string;
  shotId: string;
  projectId: string;
  status: string;
  queueJobId: string | null;
  episodeId: string | null;
  hlsMasterUrl: string | null;
  requestedBy: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): StudioRenderJobRecord {
  const payload =
    row.payload && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    shotId: String(row.shot_id),
    projectId: String(row.project_id),
    status: String(row.status),
    queueJobId: row.queue_job_id == null ? null : String(row.queue_job_id),
    episodeId: row.episode_id == null ? null : String(row.episode_id),
    hlsMasterUrl: row.hls_master_url == null ? null : String(row.hls_master_url),
    requestedBy: row.requested_by == null ? null : String(row.requested_by),
    payload,
    createdAt: String(row.created_at),
  };
}

export async function upsertStudioRenderJob(input: {
  queueJobId: string;
  jobData: StudioRenderJobData;
  status: PipelineStage | string;
  hlsMasterUrl?: string;
  error?: string;
}): Promise<StudioRenderJobRecord | null> {
  try {
    await ensureStudioSchema();
    const shotId = input.jobData.shotCards[0]?.shotId || input.jobData.episodeId;
    const payload = {
      episodeId: input.jobData.episodeId,
      showId: input.jobData.showId,
      shotCards: input.jobData.shotCards,
      outputDir: input.jobData.outputDir,
      requestedBy: input.jobData.requestedBy,
      targetFps: input.jobData.targetFps,
      queueJobId: input.queueJobId,
      hlsMasterUrl: input.hlsMasterUrl,
      error: input.error,
    };
    const result = await dbPool.query(
      `INSERT INTO public.shot_render_jobs (
          shot_id, project_id, status, payload, queue_job_id, episode_id, hls_master_url, requested_by
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       ON CONFLICT (queue_job_id) DO UPDATE SET
          status = EXCLUDED.status,
          payload = EXCLUDED.payload,
          hls_master_url = COALESCE(EXCLUDED.hls_master_url, public.shot_render_jobs.hls_master_url),
          episode_id = EXCLUDED.episode_id,
          requested_by = EXCLUDED.requested_by
       RETURNING *`,
      [
        shotId,
        input.jobData.showId,
        input.status,
        JSON.stringify(payload),
        input.queueJobId,
        input.jobData.episodeId,
        input.hlsMasterUrl ?? null,
        input.jobData.requestedBy,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  } catch (error) {
    if (isUnavailableDb(error)) return null;
    const message = error instanceof Error ? error.message : String(error);
    if (/ON CONFLICT|queue_job_id/i.test(message)) {
      return insertStudioRenderJobFallback(input);
    }
    throw error;
  }
}

async function insertStudioRenderJobFallback(input: {
  queueJobId: string;
  jobData: StudioRenderJobData;
  status: PipelineStage | string;
  hlsMasterUrl?: string;
  error?: string;
}): Promise<StudioRenderJobRecord | null> {
  const shotId = input.jobData.shotCards[0]?.shotId || input.jobData.episodeId;
  const payload = {
    episodeId: input.jobData.episodeId,
    queueJobId: input.queueJobId,
    hlsMasterUrl: input.hlsMasterUrl,
    requestedBy: input.jobData.requestedBy,
    error: input.error,
  };
  const result = await dbPool.query(
    `INSERT INTO public.shot_render_jobs (shot_id, project_id, status, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [shotId, input.jobData.showId, input.status, JSON.stringify(payload)],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function listStudioRenderJobs(limit = 25): Promise<StudioRenderJobRecord[]> {
  try {
    await ensureStudioSchema();
    const result = await dbPool.query(
      `SELECT * FROM public.shot_render_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  } catch (error) {
    if (isUnavailableDb(error)) return [];
    throw error;
  }
}

export async function persistStudioRenderJobQuietly(
  input: Parameters<typeof upsertStudioRenderJob>[0],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.STUDIO_PERSIST_RENDER_JOBS === "0") return;
  try {
    await upsertStudioRenderJob(input);
  } catch (error) {
    console.error("[Studio Render Jobs] persist failed:", error);
  }
}

export { isUnavailableDb };
