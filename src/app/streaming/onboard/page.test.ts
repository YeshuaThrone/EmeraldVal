import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");

describe("StreamingOnboardPage", () => {
  it("never opens creator delivery without an operator invite token", () => {
    expect(src).toContain("CreatorOnboardGate");
    expect(src).toContain("redirect(STREAMING_ROUTE)");
    expect(src).toContain("if (!invite)");
    expect(src).not.toContain("CreatorOnboardingPortal");
    expect(src).not.toContain("assertCreatorInviteToken");
  });
});
