import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");

describe("OnboardRedirectPage", () => {
  it("sends tokenless visitors to viewership, not creator signup", () => {
    expect(src).toContain("STREAMING_ROUTE");
    expect(src).toContain("if (!invite)");
    expect(src).toContain("redirect(STREAMING_ROUTE)");
    expect(src).toContain("STREAMING_ONBOARD_ROUTE}?token=");
  });
});
