import { describe, expect, it, vi } from "vitest";
import { isWorfiAdminKey } from "./adminIngestApi";

describe("isWorfiAdminKey", () => {
  it("denies when WORFI_ADMIN_SECRET is unset", () => {
    vi.stubEnv("WORFI_ADMIN_SECRET", "");
    expect(isWorfiAdminKey("secret")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("accepts the matching x-worfi-admin-key", () => {
    vi.stubEnv("WORFI_ADMIN_SECRET", "network-key");
    expect(isWorfiAdminKey("network-key")).toBe(true);
    expect(isWorfiAdminKey("nope")).toBe(false);
    vi.unstubAllEnvs();
  });
});
