import { handleStreamingRequest } from "@/streaming/server/apiRoutes";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  return handleStreamingRequest(request, { channelId, action: "ingest" });
}
