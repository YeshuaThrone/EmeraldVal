export interface NewsHeadline {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  category: "TRAFFIC" | "WEATHER" | "MUNICIPAL" | "LOCAL";
}

const NEWS_FETCH_MS = 2500;
const KXAN_FEED = "https://www.kxan.com/feed/";
const NWS_FORECAST =
  "https://api.weather.gov/gridpoints/EWX/156,91/forecast";
const USER_AGENT = "WURFI Network CH04 ATX LOCAL NEWS ticker";

export const FALLBACK_AUSTIN_HEADLINES: NewsHeadline[] = [
  {
    id: "atx-01",
    title:
      "Austin City Council approves new downtown corridor transit initiatives",
    source: "ATX Local News",
    timestamp: "9:00 PM",
    category: "MUNICIPAL",
  },
  {
    id: "atx-02",
    title: "I-35 Southbound experiencing minor delays near 6th Street exit",
    source: "ATX Traffic Desk",
    timestamp: "9:05 PM",
    category: "TRAFFIC",
  },
  {
    id: "atx-03",
    title:
      "Clear skies expected across Travis County overnight with low of 68°F",
    source: "Austin Weather",
    timestamp: "8:45 PM",
    category: "WEATHER",
  },
  {
    id: "atx-04",
    title:
      "Red River Cultural District announces weekend live music showcase lineup",
    source: "ATX Culture",
    timestamp: "8:30 PM",
    category: "LOCAL",
  },
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function unwrapXmlText(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRssItems(
  xml: string,
): { title: string; pubDate?: string }[] {
  const items: { title: string; pubDate?: string }[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = unwrapXmlText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const pubDate = unwrapXmlText(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1],
    );
    if (title) items.push({ title, pubDate: pubDate || undefined });
  }
  return items;
}

export function categorizeHeadline(title: string): NewsHeadline["category"] {
  const t = title.toLowerCase();
  if (
    /weather|forecast|storm|flood|heat|cold|rain|drought|temperature|°/.test(t)
  ) {
    return "WEATHER";
  }
  if (/i-35|i 35|traffic|crash|lanes?|highway|road closed|delay/.test(t)) {
    return "TRAFFIC";
  }
  if (/council|city hall|municipal|mayor|ordinance|city of austin/.test(t)) {
    return "MUNICIPAL";
  }
  return "LOCAL";
}

function formatAustinClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

async function fetchKxanHeadlines(): Promise<NewsHeadline[]> {
  const response = await withTimeout(
    fetch(KXAN_FEED, {
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    }),
    NEWS_FETCH_MS,
  );
  if (!response.ok) throw new Error(`KXAN ${response.status}`);
  const xml = await response.text();
  return parseRssItems(xml)
    .slice(0, 8)
    .map((item, index) => {
      const published = item.pubDate ? new Date(item.pubDate) : new Date();
      return {
        id: `kxan-${index}`,
        title: item.title,
        source: "KXAN Austin",
        timestamp: Number.isNaN(published.getTime())
          ? formatAustinClock(new Date())
          : formatAustinClock(published),
        category: categorizeHeadline(item.title),
      };
    });
}

async function fetchAustinWeather(): Promise<NewsHeadline | null> {
  const response = await withTimeout(
    fetch(NWS_FORECAST, {
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
      },
    }),
    NEWS_FETCH_MS,
  );
  if (!response.ok) throw new Error(`NWS ${response.status}`);
  const json = (await response.json()) as {
    properties?: {
      periods?: Array<{
        name?: string;
        temperature?: number;
        temperatureUnit?: string;
        shortForecast?: string;
      }>;
    };
  };
  const period = json.properties?.periods?.[0];
  if (!period?.shortForecast) return null;
  return {
    id: "nws-austin",
    title: `${period.name ?? "Today"} in Austin: ${period.temperature ?? "--"}°${period.temperatureUnit ?? "F"} — ${period.shortForecast}`,
    source: "National Weather Service",
    timestamp: formatAustinClock(new Date()),
    category: "WEATHER",
  };
}

export class AtxNewsService {
  /**
   * Live Austin headlines for CH 04. KXAN RSS + NWS forecast, with a static fallback.
   */
  public static async getLiveAustinHeadlines(): Promise<NewsHeadline[]> {
    const [rss, weather] = await Promise.allSettled([
      fetchKxanHeadlines(),
      fetchAustinWeather(),
    ]);
    const live: NewsHeadline[] = [];
    if (weather.status === "fulfilled" && weather.value) {
      live.push(weather.value);
    }
    if (rss.status === "fulfilled") {
      live.push(...rss.value);
    }
    return live.length > 0 ? live : FALLBACK_AUSTIN_HEADLINES;
  }

  public static formatTicker(headlines: NewsHeadline[]): string {
    if (headlines.length === 0) {
      return "CH 04 ATX NEWS • STAND BY FOR MUNICIPAL, TRAFFIC, AND WEATHER UPDATES";
    }
    return headlines
      .map((h) => `[${h.category}] ${h.title} — ${h.source} ${h.timestamp}`)
      .join("  •  ");
  }
}

/** Browser helper: hit the local API so RSS is fetched server-side. */
export async function loadAustinHeadlines(): Promise<NewsHeadline[]> {
  try {
    const response = await fetch("/api/v1/news/austin", { cache: "no-store" });
    if (!response.ok) return FALLBACK_AUSTIN_HEADLINES;
    const json = (await response.json()) as { headlines?: NewsHeadline[] };
    return Array.isArray(json.headlines) && json.headlines.length > 0
      ? json.headlines
      : FALLBACK_AUSTIN_HEADLINES;
  } catch {
    return FALLBACK_AUSTIN_HEADLINES;
  }
}
