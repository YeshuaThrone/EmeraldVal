import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");

describe("/watch", () => {
  it("is a standalone WURFI player link, not Cursor desktop", () => {
    expect(page).toContain("WorfiAppShell");
    expect(page).toContain("livePreview");
    expect(page).not.toContain("WorfiPreviewSDK");
  });
});
