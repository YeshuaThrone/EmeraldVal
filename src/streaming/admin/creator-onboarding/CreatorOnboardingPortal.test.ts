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

  it("locks public signup and only renders the delivery form after an invite", () => {
    expect(src).toContain("hasCreatorInviteToken(inviteToken)");
    expect(src).toContain("Creator signup is closed");
    expect(src).toContain("Watch the lineup");
    expect(src).toContain("Invite token accepted.");
    expect(src).toContain("Deliver Master Asset to Network");
  });
});
