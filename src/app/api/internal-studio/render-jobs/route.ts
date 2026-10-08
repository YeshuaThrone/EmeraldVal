import { NextResponse } from "next/server";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { enqueueStudioPipeline } from "@/sdk/studio-queue";
import type { StudioRenderJobData } from "@/sdk/studio-engine";
import { parseStudioRenderJobBody } from "@/sdk/studio-job-parse";
import { listStudioRenderJobs } from "@/internal-studio/api/studioRenderJobsRepository";

export async function GET(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);
  const jobs = await listStudioRenderJobs();
  return NextResponse.json({ success: true, jobs });
}

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const parsed = parseStudioRenderJobBody(await readJsonBody(request), auth.email);
  if ("error" in parsed && !("episodeId" in parsed)) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const jobData = parsed as StudioRenderJobData;

  try {
    const queued = await enqueueStudioPipeline(jobData);
    return NextResponse.json({
      success: true,
      jobId: queued.jobId,
      episodeId: jobData.episodeId,
      stage: queued.status,
      streamUrl: `/api/internal-studio/pipeline?jobId=${queued.jobId}`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to enqueue studio render";
    return NextResponse.json(
      { error: "Pipeline execution failed", details: message },
      { status: 500 },
    );
  }
}
