import { NextResponse } from "next/server";
import { studioStaffFrom, studioUnauthorized } from "@/internal-studio/api/http";
import { getStudioQueue } from "@/sdk/studio-queue";
import { readStudioJobProgress } from "@/sdk/studio-progress";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const { jobId } = await context.params;
  if (!jobId?.trim()) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const job = await getStudioQueue().getJob(jobId);
    const payload = await readStudioJobProgress(job ?? null);
    if (!payload) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to read job";
    return NextResponse.json(
      { error: "Failed to read studio job", details: message },
      { status: 500 },
    );
  }
}
