import { NextRequest, NextResponse } from "next/server";
import {
  authorizeStaffAccess,
  enqueueStudioPipeline,
  type StudioRenderJobData,
} from "@/lib/studio-engine-sdk";
import { streamStudioDashboardEvents } from "@/lib/studio-dashboard-sdk";
import {
  readJsonBody,
  studioStaffFrom,
  studioUnauthorized,
} from "@/internal-studio/api/http";
import { parseStudioRenderJobBody, DEFAULT_STUDIO_SHOW_ID } from "@/sdk/studio-job-parse";
import { getStudioQueue } from "@/sdk/studio-queue";
import { readStudioJobProgress } from "@/sdk/studio-progress";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = studioStaffFrom(req);
    if (!auth.ok) return studioUnauthorized(auth);

    const session = authorizeStaffAccess(auth.email);
    const parsed = parseStudioRenderJobBody(
      await readJsonBody(req),
      session.email,
      { defaultShowId: DEFAULT_STUDIO_SHOW_ID },
    );
    if ("error" in parsed && !("episodeId" in parsed)) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const jobData = parsed as StudioRenderJobData;
    const { jobId, status } = await enqueueStudioPipeline(jobData);

    return NextResponse.json(
      {
        message: "Render job successfully enqueued.",
        jobId,
        status,
        streamUrl: `/api/internal-studio/pipeline?jobId=${jobId}`,
      },
      { status: 202 },
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Pipeline execution failed";
    const isAuthError = errorMsg.includes("Access Denied");
    return NextResponse.json(
      { error: errorMsg },
      { status: isAuthError ? 403 : 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = studioStaffFrom(req);
  if (!auth.ok) return studioUnauthorized(auth);

  const jobId = new URL(req.url).searchParams.get("jobId")?.trim() || "";
  if (!jobId) {
    return NextResponse.json(
      { error: "Missing required query parameter: jobId" },
      { status: 400 },
    );
  }

  const stream = streamStudioDashboardEvents({
    jobId,
    readProgress: async () => {
      const job = await getStudioQueue().getJob(jobId);
      return readStudioJobProgress(job ?? null);
    },
  });

  req.signal.addEventListener("abort", () => {
    void stream.cancel();
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
