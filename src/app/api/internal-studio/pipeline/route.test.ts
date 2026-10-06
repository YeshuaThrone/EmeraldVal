import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function staffRequest(body: unknown) {
  return new Request("http://localhost/api/internal-studio/pipeline", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-studio-staff-email": "3bbullion@gmail.com",
      "x-studio-staff-key": "studio-key",
    },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/internal-studio/pipeline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires studio staff", async () => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
    const response = await POST(
      new Request("http://localhost/api/internal-studio/pipeline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "comic_issue_01",
          masterAudioUrl: "https://storage.studio-os.internal/audio/a.wav",
          comicPanelUrls: ["https://storage.studio-os.internal/panels/p1.png"],
        }),
      }) as never,
    );
    expect(response.status).toBe(401);
  });

  it("rejects a missing comic panel list", async () => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
    const response = await POST(
      staffRequest({
        projectId: "comic_issue_01",
        masterAudioUrl: "https://storage.studio-os.internal/audio/a.wav",
        comicPanelUrls: [],
      }),
    );
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error).toContain("comicPanelUrls");
  });

  it("returns an internal master HLS URL for a valid staff payload", async () => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
    const response = await POST(
      staffRequest({
        projectId: "comic_issue_01",
        masterAudioUrl: "https://storage.studio-os.internal/audio/rodecaster_master_01.wav",
        comicPanelUrls: [
          "https://storage.studio-os.internal/panels/issue_1_page_1.png",
        ],
        characterVault: [
          {
            id: "hero_01",
            name: "Sovereign Lead",
            seedNumber: 8849201,
            referenceImageUrls: [
              "https://storage.studio-os.internal/vault/hero_turnaround.png",
            ],
            voiceId: "unity_disney_voice_01",
            defaultPromptPrefix: "dark graphic novel style",
          },
        ],
        outputResolution: "4K",
        autoPublishToNetwork: true,
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      projectId: string;
      outputStreamUrl: string;
    };
    expect(json.success).toBe(true);
    expect(json.projectId).toBe("comic_issue_01");
    expect(json.outputStreamUrl).toContain(
      "network.three-thrones.internal/streams/comic_issue_01/master_episode.m3u8",
    );
  });
});
