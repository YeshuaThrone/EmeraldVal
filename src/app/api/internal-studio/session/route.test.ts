import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, GET } from "./route";
import { STUDIO_SESSION_COOKIE } from "@/internal-studio/auth";

describe("POST /api/internal-studio/session", () => {
  beforeEach(() => {
    vi.stubEnv("ANIMATION_STUDIO_OS_SECRET", "studio-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing key", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal-studio/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "3bbullion@gmail.com" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("sets an HttpOnly studio_session cookie for staff", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal-studio/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "3bbullion@gmail.com",
          key: "studio-key",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("Set-Cookie") || "";
    expect(cookie).toContain(`${STUDIO_SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");

    const token = cookie.split(";")[0]?.split("=")[1] || "";
    const me = await GET(
      new Request("http://localhost/api/internal-studio/session", {
        headers: { cookie: `${STUDIO_SESSION_COOKIE}=${token}` },
      }),
    );
    expect(me.status).toBe(200);
    const json = (await me.json()) as { email: string };
    expect(json.email).toBe("3bbullion@gmail.com");
  });
});
