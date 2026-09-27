import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "NewsTicker.tsx"), "utf8");

describe("NewsTicker", () => {
  it("subscribes to WURFI ticker SSE and renders tickerText", () => {
    expect(src).toContain("EventSource");
    expect(src).toContain("tickerText");
    expect(src).toContain("wurfiMarquee");
    expect(src).toContain("#5ee9b5");
  });
});
