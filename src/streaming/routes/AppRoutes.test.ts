import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "AppRoutes.tsx"), "utf8");

describe("AppRoutes", () => {
  it("does not open creator onboarding without an invite token", () => {
    expect(src).toContain('Navigate to="/" replace');
    expect(src).toContain("CreatorOnboardingPortal inviteToken={token}");
    expect(src).not.toContain("searchParams.get(\"token\") || undefined");
  });
});
