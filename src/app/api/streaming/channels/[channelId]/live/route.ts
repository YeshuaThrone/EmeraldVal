import { handleStreamingRequest } from "@/streaming/server/apiRoutes";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  return handleStreamingRequest(request, { channelId, action: "live" });
}
