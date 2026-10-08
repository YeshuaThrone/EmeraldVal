import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/sdk/studio-queue", () => ({
  getStudioQueue: () => ({
    getJob: vi.fn(async () => ({
      id: "job-1",
      data: { episodeId: "ep-42" },
      progress: {
        jobId: "job-1",
        episodeId: "ep-42",
        stage: "EPG_PUBLISHED",
        progressPercent: 100,
        hlsMasterUrl: "/tmp/internal-studio/ep-42/hls/index.m3u8",
      },
      returnvalue: { status: "EPG_PUBLISHED" },
      failedReason: undefined,
      getState: async () => "completed",
    })),
  }),
}));

import { GET } from "./route";

describe("GET /api/internal-studio/render-jobs/[jobId]/events", () => {
  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires studio staff", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal-studio/render-jobs/job-1/events"),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("streams text/event-stream job progress for staff", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal-studio/render-jobs/job-1/events", {
        headers: {
          "x-studio-staff-email": "3bbullion@gmail.com",
          "x-studio-staff-key": "studio-key",
        },
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("EPG_PUBLISHED");
    expect(text).toContain("data: ");
  });

  it("is an internal SSE route and not the public WURFI ticker", () => {
    const src = readFileSync(path.join(import.meta.dirname, "route.ts"), "utf8");
    expect(src).toContain("text/event-stream");
    expect(src).toContain("studioStaffFrom");
  });
});
