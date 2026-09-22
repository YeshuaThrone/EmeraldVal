import { afterEach, describe, expect, it, vi } from "vitest";
import { StreamHealthMonitor } from "./streamHealthMonitor";

describe("StreamHealthMonitor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects empty URLs", async () => {
    await expect(StreamHealthMonitor.verifyStreamUrl("")).resolves.toBe(false);
  });

  it("treats YouTube URLs as structurally valid", async () => {
    await expect(
      StreamHealthMonitor.verifyStreamUrl(
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
      ),
    ).resolves.toBe(true);
  });

  it("returns true when HEAD succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true }),
    );
    await expect(
      StreamHealthMonitor.verifyStreamUrl("https://cdn.example.com/a.mp4"),
    ).resolves.toBe(true);
  });

  it("returns false when HEAD fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      StreamHealthMonitor.verifyStreamUrl("https://cdn.example.com/a.mp4"),
    ).resolves.toBe(false);
  });

  it("uses the public standby env override when set", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_WORFI_STANDBY_VIDEO_URL",
      "https://cdn.example.com/standby.mp4",
    );
    expect(StreamHealthMonitor.getEmergencyFallbackUrl()).toBe(
      "https://cdn.example.com/standby.mp4",
    );
  });
});
