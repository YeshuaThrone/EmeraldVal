import { handleStreamingRequest } from "@/streaming/server/apiRoutes";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleStreamingRequest(request, {});
}
