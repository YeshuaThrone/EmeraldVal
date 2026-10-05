import { NextResponse } from "next/server";
import { stitchShotsWithFfmpeg } from "@/internal-studio/api/ffmpegStitcher";
import { readJsonBody, studioStaffFrom, studioUnauthorized } from "@/internal-studio/api/http";

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const body = (await readJsonBody(request)) as {
    clipPaths?: unknown;
    outputFileName?: unknown;
  };

  const clipPaths = Array.isArray(body.clipPaths)
    ? body.clipPaths.filter((value): value is string => typeof value === "string")
    : [];
  const outputFileName =
    typeof body.outputFileName === "string" ? body.outputFileName : "stitched.mp4";

  try {
    const result = await stitchShotsWithFfmpeg({ clipPaths, outputFileName });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "FFmpeg stitch failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
