import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const from = vi.fn();
const storageFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from,
    storage: { from: storageFrom },
  }),
}));

describe("POST /api/internal-studio/webhooks/obvious", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    from.mockReset();
    storageFrom.mockReset();
  });

  it("rejects a missing Obvious signature", async () => {
    vi.stubEnv("OBVIOUS_WEBHOOK_SECRET", "webhook-secret");
    const response = await POST(
      new Request("http://localhost/api/internal-studio/webhooks/obvious", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "pilot",
          shotId: "act1-02",
          videoUrl: "https://cdn.example/b.mp4",
        }),
      }) as never,
    );
    expect(response.status).toBe(401);
  });

  it("upserts pending_review when the signature matches", async () => {
    vi.stubEnv("OBVIOUS_WEBHOOK_SECRET", "webhook-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");

    const select = vi.fn().mockResolvedValue({
      data: [{ shot_id: "act1-02", status: "pending_review" }],
      error: null,
    });
    const upsert = vi.fn(() => ({ select }));
    from.mockReturnValue({ upsert });

    const response = await POST(
      new Request("http://localhost/api/internal-studio/webhooks/obvious", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-obvious-signature": "webhook-secret",
        },
        body: JSON.stringify({
          projectId: "pilot",
          shotId: "act1-02",
          videoUrl: "https://cdn.example/b.mp4",
          scriptText: "Orbit hold",
        }),
      }) as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });
});
