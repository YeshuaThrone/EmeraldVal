import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");

describe("StreamingOnboardPage", () => {
  it("never opens creator delivery without a valid operator invite", () => {
    expect(src).toContain("assertCreatorInviteToken");
    expect(src).toContain("redirect(STREAMING_ROUTE)");
    expect(src).toContain("if (!invite)");
    expect(src).toContain("if (!check.ok)");
    expect(src).not.toContain("CreatorOnboardingPortal inviteToken={token}");
  });
});
