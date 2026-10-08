import { studioStaffFrom, studioUnauthorized } from "@/internal-studio/api/http";
import { getStudioQueue } from "@/sdk/studio-queue";
import { readStudioJobProgress, streamStudioJobEvents } from "@/sdk/studio-progress";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const { jobId } = await context.params;
  if (!jobId?.trim()) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const stream = streamStudioJobEvents({
    jobId,
    readProgress: async () => {
      const job = await getStudioQueue().getJob(jobId);
      return readStudioJobProgress(job ?? null);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
