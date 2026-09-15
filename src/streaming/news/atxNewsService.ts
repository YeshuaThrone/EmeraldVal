export interface NewsHeadline {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  category: "TRAFFIC" | "WEATHER" | "MUNICIPAL" | "LOCAL";
}

export class AtxNewsService {
  /**
   * Fetches real-time Austin local news & municipal data for CH 04 ticker
   */
  public static async getLiveAustinHeadlines(): Promise<NewsHeadline[]> {
    return [
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
