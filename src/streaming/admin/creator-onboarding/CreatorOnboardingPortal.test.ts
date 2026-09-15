import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasCreatorInviteToken } from "./creatorInviteAccess";

const src = readFileSync(
  path.join(import.meta.dirname, "CreatorOnboardingPortal.tsx"),
  "utf8",
);

describe("CreatorOnboardingPortal", () => {
  it("requires a non-empty invite token before showing the form", () => {
    expect(hasCreatorInviteToken(undefined)).toBe(false);
    expect(hasCreatorInviteToken("")).toBe(false);
    expect(hasCreatorInviteToken("   ")).toBe(false);
    expect(hasCreatorInviteToken("invite-abc")).toBe(true);
  });

  it("is a private delivery form, not a public upload page", () => {
    expect(src).toContain("inviteToken: string");
    expect(src).toContain("Invite token accepted.");
    expect(src).toContain("Deliver Master Asset to Network");
    expect(src).not.toContain("Creator signup is closed");
    expect(src).not.toContain("they join only after receiving a private invite");
  });
});
