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

describe("POST /api/extract-scene-structure", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    from.mockReset();
    getUser.mockReset();
  });

  it("rejects a missing frame", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const form = new FormData();
    form.set("projectId", "pilot");
    const response = await POST(
      new Request("http://localhost/api/extract-scene-structure", {
        method: "POST",
        headers: { authorization: "Bearer staff-token" },
        body: form,
      }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("inserts an extracted Palais Rose structure", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "struct-1" }, error: null }),
      }),
    }));
    from.mockReturnValue({ insert });

    const form = new FormData();
    form.set("projectId", "pilot");
    form.set("condition", "WEATHERED_AGED");
    form.set("frame", new File([new Uint8Array([1, 2, 3])], "frame.png", {
      type: "image/png",
    }));

    const response = await POST(
      new Request("http://localhost/api/extract-scene-structure", {
        method: "POST",
        headers: { authorization: "Bearer staff-token" },
        body: form,
      }) as never,
    );
    const json = (await response.json()) as {
      success: boolean;
      preset: { architecturalStyle: string };
    };
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.preset.architecturalStyle).toContain("Palais Rose");
    expect(insert).toHaveBeenCalled();
  });
});
