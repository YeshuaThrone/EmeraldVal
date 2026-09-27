import { AtxNewsService } from "@/streaming/news/atxNewsService";

export const dynamic = "force-dynamic";

function encodeEvent(tickerText: string): Uint8Array {
  return new TextEncoder().encode(
    `data: ${JSON.stringify({ tickerText })}\n\n`,
  );
}

export async function GET() {
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        try {
          const headlines = await AtxNewsService.getLiveAustinHeadlines();
          controller.enqueue(
            encodeEvent(AtxNewsService.formatTicker(headlines)),
          );
        } catch {
          if (closed) return;
          controller.enqueue(
            encodeEvent(
              "CH 04 ATX NEWS • STAND BY FOR MUNICIPAL, TRAFFIC, AND WEATHER UPDATES",
            ),
          );
        }
      };
      await send();
      timer = setInterval(() => {
        void send();
      }, 15_000);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
