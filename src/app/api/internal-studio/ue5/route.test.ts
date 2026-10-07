import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/UnrealEngineStudioSDK", () => ({
  callUE5RemoteControl: vi.fn(async () => ({ ReturnValue: true })),
  triggerAudio2FaceLiveLink: vi.fn(async () => ({
    status: "STREAMING_ACTIVE",
    streamingChannel: "livelink_hero_01",
  })),
}));

import { callUE5RemoteControl, triggerAudio2FaceLiveLink } from "@/lib/UnrealEngineStudioSDK";
import { POST } from "./route";

function staffRequest(body: unknown) {
  return new Request("http://localhost/api/internal-studio/ue5", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-studio-staff-email": "3bbullion@gmail.com",
      "x-studio-staff-key": "studio-key",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal-studio/ue5", () => {
  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("requires studio staff", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal-studio/ue5", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remote", payload: { objectPath: "/Game/A", functionName: "Ping" } }),
      }),
    );
    expect(response.status).toBe(401);
    expect(callUE5RemoteControl).not.toHaveBeenCalled();
  });

  it("dispatches a Remote Control payload", async () => {
    const response = await POST(
      staffRequest({
        action: "remote",
        payload: {
          objectPath: "/Game/WerfiStudio/Cameras.Cameras",
          functionName: "SetCameraAngle",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(callUE5RemoteControl).toHaveBeenCalled();
  });

  it("starts Audio2Face LiveLink for a MetaHuman", async () => {
    const response = await POST(
      staffRequest({
        action: "livelink",
        audioFilePath: "/tmp/internal-studio/ep_01/master.wav",
        metaHumanTargetId: "hero_01",
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { streamingChannel: string };
    expect(json.streamingChannel).toBe("livelink_hero_01");
    expect(triggerAudio2FaceLiveLink).toHaveBeenCalled();
  });
});
