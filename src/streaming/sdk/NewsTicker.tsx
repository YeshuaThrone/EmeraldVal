"use client";

import React, { useEffect, useState } from "react";
import type { TickerProps } from "./wurfi-sdk";

/**
 * Hardware-accelerated news ticker connected to a Server-Sent Events stream.
 */
export const NewsTicker: React.FC<TickerProps> = ({
  sseEndpoint,
  initialText,
}) => {
  const [headline, setHeadline] = useState<string>(
    initialText ?? "[WURFI NETWORK] Initializing ticker stream...",
  );

  useEffect(() => {
    if (!sseEndpoint) return;

    const eventSource = new EventSource(sseEndpoint);

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { tickerText?: unknown };
        if (data && typeof data.tickerText === "string") {
          setHeadline(data.tickerText);
        }
      } catch (err) {
        console.error("WURFI Ticker Parse Error:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("WURFI Ticker SSE Connection Error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [sseEndpoint]);

  return (
    <div
      className="wurfi-ticker-container"
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
        backgroundColor: "transparent",
        color: "#5ee9b5",
        padding: "0",
      }}
    >
      <div
        className="wurfi-ticker-text"
        style={{
          display: "inline-block",
          willChange: "transform",
          animation: "wurfiMarquee 20s linear infinite",
          transform: "translate3d(0, 0, 0)",
        }}
      >
        {headline}
      </div>
    </div>
  );
};
