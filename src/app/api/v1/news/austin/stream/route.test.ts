import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.join(import.meta.dirname, "route.ts"), "utf8");

describe("GET /api/v1/news/austin/stream", () => {
  it("is a WURFI ticker SSE that pushes tickerText events", () => {
    expect(src).toContain("text/event-stream");
    expect(src).toContain("tickerText");
    expect(src).toContain("AtxNewsService.getLiveAustinHeadlines()");
    expect(src).toContain("formatTicker");
  });
});
