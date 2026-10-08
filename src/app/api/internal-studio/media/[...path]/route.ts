import { readFile } from "node:fs/promises";
import path from "node:path";
import { studioStaffFrom, studioUnauthorized } from "@/internal-studio/api/http";
import { assertInsideWorkDir, studioWorkDir } from "@/internal-studio/api/ffmpegStitcher";

export const dynamic = "force-dynamic";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".m3u8") return "application/vnd.apple.mpegurl";
  if (ext === ".ts") return "video/MP2T";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const auth = studioStaffFrom(request);
  if (!auth.ok) return studioUnauthorized(auth);

  const { path: parts } = await context.params;
  const relative = (parts ?? []).join("/");
  if (!relative) {
    return Response.json({ error: "Missing media path" }, { status: 400 });
  }

  try {
    const absolute = assertInsideWorkDir(relative, studioWorkDir());
    const body = await readFile(absolute);
    return new Response(body, {
      headers: {
        "Content-Type": contentTypeFor(absolute),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "Media not found" }, { status: 404 });
  }
}
