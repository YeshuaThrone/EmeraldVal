import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "apiRoutes.ts"), "utf8");

describe("streaming ingest API", () => {
  it("rejects creator ingest without an invite token", () => {
    expect(src).toContain("readInviteToken");
    expect(src).toContain("assertCreatorInviteToken");
    expect(src).toContain("Creator onboarding requires an invite link");
    expect(src).toContain("{ status: 403 }");
  });
});
