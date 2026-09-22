import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AtxNewsService,
  FALLBACK_AUSTIN_HEADLINES,
  categorizeHeadline,
  loadAustinHeadlines,
  parseRssItems,
} from "./atxNewsService";

describe("AtxNewsService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses RSS items and categorizes Austin headlines", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title><![CDATA[Austin City Council votes on housing]]></title><pubDate>Tue, 22 Sep 2026 17:15:02 +0000</pubDate></item>
      <item><title>I-35 Southbound crash closes lanes</title><pubDate>Tue, 22 Sep 2026 16:00:00 +0000</pubDate></item>
      <item><title>Heat advisory forecast for Travis County</title></item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toHaveLength(3);
    expect(items[0]?.title).toBe("Austin City Council votes on housing");
    expect(categorizeHeadline(items[0]!.title)).toBe("MUNICIPAL");
    expect(categorizeHeadline(items[1]!.title)).toBe("TRAFFIC");
    expect(categorizeHeadline(items[2]!.title)).toBe("WEATHER");
  });

  it("returns live KXAN + NWS headlines when feeds respond", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("kxan.com/feed")) {
          return new Response(
            `<rss><channel><item><title>Local school board meeting tonight</title><pubDate>Tue, 22 Sep 2026 12:00:00 +0000</pubDate></item></channel></rss>`,
            { status: 200 },
          );
        }
        if (url.includes("weather.gov")) {
          return Response.json({
            properties: {
              periods: [
                {
                  name: "Tonight",
                  temperature: 68,
                  temperatureUnit: "F",
                  shortForecast: "Clear",
                },
              ],
            },
          });
        }
        return new Response("nope", { status: 404 });
      }),
    );

    const headlines = await AtxNewsService.getLiveAustinHeadlines();
    expect(headlines[0]?.category).toBe("WEATHER");
    expect(headlines[0]?.title).toMatch(/Austin/i);
    expect(headlines.some((h) => h.title.includes("school board"))).toBe(true);
    expect(AtxNewsService.formatTicker(headlines)).toContain("[LOCAL]");
  });

  it("falls back to static Austin headlines when feeds fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const headlines = await AtxNewsService.getLiveAustinHeadlines();
    expect(headlines).toEqual(FALLBACK_AUSTIN_HEADLINES);
    expect(headlines.map((h) => h.category)).toEqual([
      "MUNICIPAL",
      "TRAFFIC",
      "WEATHER",
      "LOCAL",
    ]);
    expect(AtxNewsService.formatTicker(headlines)).toContain("I-35 Southbound");
  });

  it("loadAustinHeadlines reads the local news API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          headlines: [
            {
              id: "live-1",
              title: "Live Austin headline",
              source: "KXAN Austin",
              timestamp: "6:00 PM",
              category: "LOCAL",
            },
          ],
        }),
      ),
    );
    await expect(loadAustinHeadlines()).resolves.toEqual([
      {
        id: "live-1",
        title: "Live Austin headline",
        source: "KXAN Austin",
        timestamp: "6:00 PM",
        category: "LOCAL",
      },
    ]);
  });
});
