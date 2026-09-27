import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  path.join(import.meta.dirname, "CreatorOnboardGate.tsx"),
  "utf8",
);

describe("CreatorOnboardGate", () => {
  it("only mounts the delivery form after invite validation", () => {
    expect(src).toContain("/api/invites/validate/");
    expect(src).toContain("CreatorOnboardingPortal");
    expect(src).toContain("window.location.replace(STREAMING_ROUTE)");
    expect(src).not.toContain("Creator signup is closed");
  });
});
