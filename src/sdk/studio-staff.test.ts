import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeStaffAccess, studioStaffAllowlist } from "./studio-staff";

describe("authorizeStaffAccess", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows the owner as studio_admin", () => {
    expect(authorizeStaffAccess("3bbullion@gmail.com")).toEqual({
      email: "3bbullion@gmail.com",
      role: "studio_admin",
    });
    expect(studioStaffAllowlist().has("3bbullion@gmail.com")).toBe(true);
  });

  it("allows extra staff from ANIMATION_STUDIO_OS_STAFF", () => {
    vi.stubEnv("ANIMATION_STUDIO_OS_STAFF", "maya@wurfi.tv:director");
    expect(authorizeStaffAccess("maya@wurfi.tv").role).toBe("director");
  });

  it("denies emails outside the allowlist", () => {
    expect(() => authorizeStaffAccess("fan@example.com")).toThrow(/Access Denied/);
  });
});
