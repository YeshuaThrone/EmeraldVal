import { NextResponse } from "next/server";
import {
  assertInsideWorkDir,
  stitchShotsWithFfmpeg,
  studioWorkDir,
} from "@/internal-studio/api/ffmpegStitcher";
import { stitchMultiStyleClips } from "@/internal-studio/api/xfadeStitcher";
import { readJsonBody, studioStaffFrom, studioUnauthorized } from "@/internal-studio/api/http";

export async function POST(request: Request) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const body = (await readJsonBody(request)) as {
    clipPaths?: unknown;
    outputFileName?: unknown;
    transition?: unknown;
    transitionDuration?: unknown;
  };

  const clipPaths = Array.isArray(body.clipPaths)
    ? body.clipPaths.filter((value): value is string => typeof value === "string")
    : [];
  const outputFileName =
    typeof body.outputFileName === "string" ? body.outputFileName : "stitched.mp4";

  try {
    if (body.transition === "xfade") {
      const workDir = studioWorkDir();
      const resolvedClips = clipPaths.map((clip) =>
        assertInsideWorkDir(clip, workDir),
      );
      const outputPath = assertInsideWorkDir(outputFileName, workDir);
      const transitionDuration =
        typeof body.transitionDuration === "number"
          ? body.transitionDuration
          : 0.5;
      const result = await stitchMultiStyleClips(
        resolvedClips,
        outputPath,
        transitionDuration,
      );
      return NextResponse.json({ success: true, ...result });
    }

    const result = await stitchShotsWithFfmpeg({ clipPaths, outputFileName });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "FFmpeg stitch failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
