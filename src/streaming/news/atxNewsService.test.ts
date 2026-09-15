import { describe, expect, it } from "vitest";
import { AtxNewsService } from "./atxNewsService";

describe("AtxNewsService", () => {
  it("returns Austin municipal, traffic, weather, and local headlines", async () => {
    const headlines = await AtxNewsService.getLiveAustinHeadlines();
    expect(headlines).toHaveLength(4);
    expect(headlines.map((h) => h.category)).toEqual([
      "MUNICIPAL",
      "TRAFFIC",
      "WEATHER",
      "LOCAL",
    ]);
    expect(headlines[0]?.title).toMatch(/City Council/i);
  });

  it("formats a CH 04 ticker crawl", async () => {
    const headlines = await AtxNewsService.getLiveAustinHeadlines();
    const ticker = AtxNewsService.formatTicker(headlines);
    expect(ticker).toContain("[TRAFFIC]");
    expect(ticker).toContain("I-35 Southbound");
    expect(ticker).toContain("68°F");
  });
});
