import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/internal-studio/media", () => {
  const workDir = mkdtempSync(path.join(os.tmpdir(), "studio-media-"));

  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
    vi.stubEnv("ANIMATION_STUDIO_OS_WORK_DIR", workDir);
    mkdirSync(path.join(workDir, "ep_01", "hls"), { recursive: true });
    writeFileSync(path.join(workDir, "ep_01", "hls", "index.m3u8"), "#EXTM3U\n");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires studio staff", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal-studio/media/ep_01/hls/index.m3u8"),
      { params: Promise.resolve({ path: ["ep_01", "hls", "index.m3u8"] }) },
    );
    expect(response.status).toBe(401);
  });

  it("serves HLS from the studio work directory", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal-studio/media/ep_01/hls/index.m3u8", {
        headers: {
          "x-studio-staff-email": "3bbullion@gmail.com",
          "x-studio-staff-key": "studio-key",
        },
      }),
      { params: Promise.resolve({ path: ["ep_01", "hls", "index.m3u8"] }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("mpegurl");
    expect(await response.text()).toContain("#EXTM3U");
  });
});
