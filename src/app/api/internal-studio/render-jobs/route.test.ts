import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/sdk/studio-queue", () => ({
  enqueueStudioPipeline: vi.fn(async () => ({ jobId: "job-queued-1", status: "QUEUED" })),
}));

import { enqueueStudioPipeline } from "@/sdk/studio-queue";
import { POST } from "./route";

function staffRequest(body: unknown) {
  return new Request("http://localhost/api/internal-studio/render-jobs", {
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
  showId: "show-wurfi",
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
  targetFps: 24,
};

describe("POST /api/internal-studio/render-jobs", () => {
  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("requires studio staff", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal-studio/render-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );
    expect(response.status).toBe(401);
    expect(enqueueStudioPipeline).not.toHaveBeenCalled();
  });

  it("rejects a missing episode payload", async () => {
    const response = await POST(staffRequest({ episodeId: "ep-1" }));
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toContain("shotCards");
    expect(enqueueStudioPipeline).not.toHaveBeenCalled();
  });

  it("enqueues a staff render job at QUEUED without publishing to WURFI", async () => {
    const response = await POST(staffRequest(validBody));
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      jobId: string;
      episodeId: string;
      stage: string;
    };
    expect(json).toEqual({
      success: true,
      jobId: "job-queued-1",
      episodeId: "ep-42",
      stage: "QUEUED",
    });
    expect(enqueueStudioPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: "ep-42",
        showId: "show-wurfi",
        requestedBy: "3bbullion@gmail.com",
        targetFps: 24,
        shotCards: validBody.shotCards,
      }),
    );
  });
});
