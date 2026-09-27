import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");
const sdk = readFileSync(
  path.join(process.cwd(), "src/streaming/preview/WorfiPreviewSDK.tsx"),
  "utf8",
);

describe("/preview", () => {
  it("mounts the live WURFI player, not a toy SDK card", () => {
    expect(page).toContain("WorfiAppShell");
    expect(page).toContain("livePreview");
    expect(page).not.toContain("WorfiPreviewSDK");
    expect(sdk).toContain("livePreview");
    expect(sdk).not.toContain("PREVIEW SDK");
    expect(sdk).not.toContain("Launch Preview");
  });
});
