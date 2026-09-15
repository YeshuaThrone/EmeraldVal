import { NextResponse } from "next/server";
import { AtxNewsService } from "@/streaming/news/atxNewsService";

export async function GET() {
  const headlines = await AtxNewsService.getLiveAustinHeadlines();
  return NextResponse.json({
    success: true,
    channelId: "ch-04",
    headlines,
    ticker: AtxNewsService.formatTicker(headlines),
  });
}
