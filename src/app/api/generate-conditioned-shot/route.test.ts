import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const from = vi.fn();
const getUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser },
    from,
  }),
}));

describe("POST /api/generate-conditioned-shot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    from.mockReset();
    getUser.mockReset();
  });

  it("queues a compiled conditioning payload", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    from.mockReturnValue({
      insert: vi.fn(async () => ({ error: null })),
    });

    const response = await POST(
      new Request("http://localhost/api/generate-conditioned-shot", {
        method: "POST",
        headers: {
          authorization: "Bearer staff-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          shotId: "act1-02",
          projectId: "pilot",
          prompt: "Maya turns into the key light.",
          negativePrompt: "morph",
          seed: 7,
          characterRef: {
            characterId: "maya",
            turnaroundSheetUrl: "https://cdn.example/maya.png",
            weight: 0.9,
          },
          motionVector: { type: "pan", speed: 0.4 },
        }),
      }) as never,
    );

    const json = (await response.json()) as {
      success: boolean;
      job: { generation_params: { prompt: string } };
    };
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.job.generation_params.prompt).toContain("[CHARACTER_LOCK: maya]");
  });
});
