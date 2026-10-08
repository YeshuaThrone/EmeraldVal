import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/studio-engine-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/studio-engine-sdk")>();
  return {
    ...actual,
    enqueueStudioPipeline: vi.fn(async () => ({
      jobId: "job-queued-1",
      status: "QUEUED",
    })),
  };
});

vi.mock("@/sdk/studio-queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/sdk/studio-queue")>();
  return {
    ...actual,
    getStudioQueue: () => ({
      getJob: vi.fn(async () => ({
        id: "job-queued-1",
        data: { episodeId: "ep-42" },
        progress: {
          jobId: "job-queued-1",
          episodeId: "ep-42",
          stage: "EPG_PUBLISHED",
          progressPercent: 100,
        },
        returnvalue: { status: "EPG_PUBLISHED" },
        failedReason: undefined,
        getState: async () => "completed",
      })),
    }),
  };
});

import { enqueueStudioPipeline } from "@/lib/studio-engine-sdk";
import { GET, POST } from "./route";

function staffPost(body: unknown) {
  return new NextRequest("http://localhost/api/internal-studio/pipeline", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-studio-staff-email": "3bbullion@gmail.com",
      "x-studio-staff-key": "studio-key",
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  episodeId: "ep-42",
  rodecasterAudioPath: "/tmp/internal-studio/ep-42/master.wav",
  shotCards: [
    {
      shotId: "shot_01",
      speakerId: "hero_01",
      dialogueText: "Hold the city.",
      characterModelId: "hero_01",
      motionPrompt: "push-in",
    },
  ],
};

describe("POST /api/internal-studio/pipeline", () => {
  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("requires studio staff", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/internal-studio/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );
    expect(response.status).toBe(401);
    expect(enqueueStudioPipeline).not.toHaveBeenCalled();
  });

  it("accepts x-staff-email as an alias when the staff key is present", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/internal-studio/pipeline", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-staff-email": "3bbullion@gmail.com",
          "x-studio-staff-key": "studio-key",
        },
        body: JSON.stringify(validBody),
      }),
    );
    expect(response.status).toBe(202);
  });

  it("rejects a missing shot card list", async () => {
    const response = await POST(
      staffPost({
        episodeId: "ep-42",
        rodecasterAudioPath: "/tmp/internal-studio/ep-42/master.wav",
        shotCards: [],
      }),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toContain("shot cards");
    expect(enqueueStudioPipeline).not.toHaveBeenCalled();
  });

  it("returns 202 with a jobId and SSE streamUrl without publishing to WURFI", async () => {
    const response = await POST(staffPost(validBody));
    expect(response.status).toBe(202);
    const json = (await response.json()) as {
      jobId: string;
      status: string;
      streamUrl: string;
    };
    expect(json.jobId).toBe("job-queued-1");
    expect(json.status).toBe("QUEUED");
    expect(json.streamUrl).toBe("/api/internal-studio/pipeline?jobId=job-queued-1");
    expect(enqueueStudioPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: "ep-42",
        showId: "wurfi-default-show",
        requestedBy: "3bbullion@gmail.com",
      }),
    );
  });
});

describe("GET /api/internal-studio/pipeline", () => {
  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires studio staff", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/internal-studio/pipeline?jobId=job-queued-1"),
    );
    expect(response.status).toBe(401);
  });

  it("requires jobId", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/internal-studio/pipeline", {
        headers: {
          "x-studio-staff-email": "3bbullion@gmail.com",
          "x-studio-staff-key": "studio-key",
        },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("streams text/event-stream progress for staff", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/internal-studio/pipeline?jobId=job-queued-1", {
        headers: {
          "x-studio-staff-email": "3bbullion@gmail.com",
          "x-studio-staff-key": "studio-key",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("data: ");
    expect(text).toMatch(/CONNECTED|QUEUED|EPG_PUBLISHED/);
  });
});
