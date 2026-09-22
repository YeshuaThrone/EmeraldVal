"use client";

import React, { useEffect, useState } from "react";
import type { MultiChannelEngine } from "../playout/multiChannelEngine";
import { AtxNewsService } from "../news/atxNewsService";

interface GuideProps {
  engine: MultiChannelEngine;
  onSelectChannel?: (channelId: string) => void;
}

export const RetroTVGuide: React.FC<GuideProps> = ({
  engine,
  onSelectChannel,
}) => {
  const networks = engine.getNetworks();
  const [now, setNow] = useState(new Date());
  const [ticker, setTicker] = useState(
    "CH 04 ATX NEWS • STAND BY FOR MUNICIPAL, TRAFFIC, AND WEATHER UPDATES",
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void AtxNewsService.getLiveAustinHeadlines().then((headlines) => {
      if (!cancelled) setTicker(AtxNewsService.formatTicker(headlines));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const networkTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });

  return (
    <div className="w-full max-w-6xl rounded-2xl border-2 border-blue-900/80 bg-slate-950 p-6 font-mono text-slate-100 shadow-[0_0_40px_rgba(15,23,42,0.8)]">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-blue-900/60 pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-400" />
            <h1 className="text-2xl font-black tracking-widest text-yellow-400">
              WURFI PROGRAM GUIDE
            </h1>
          </div>
          <p className="mt-1 text-xs text-blue-300/80">
            Pronounced &quot;Wur-fee&quot; • Synchronized 24/7 Cable Grid
          </p>
        </div>
        <div className="rounded-lg border border-blue-900/50 bg-slate-900/80 px-4 py-2 text-right text-xs text-slate-400">
          <div>
            NETWORK TIME:{" "}
            <span className="font-bold text-yellow-400">{networkTime}</span>
          </div>
          <div className="text-[10px] text-slate-500">WURFI NETWORK</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-blue-900/60 bg-slate-900/40">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-blue-900/80 bg-blue-950/80 text-yellow-400">
              <th className="w-24 border-r border-blue-900/60 p-3">CH #</th>
              <th className="w-48 border-r border-blue-900/60 p-3">STATION</th>
              <th className="border-r border-blue-900/60 p-3">NOW PLAYING</th>
              <th className="p-3">UP NEXT</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((net) => {
              const playhead = engine.getCurrentPlayhead(net.channelId);
              const currentShow = playhead.segment || {
                title: "WURFI STANDBY",
                creatorName: "Network",
              };
              const nextShow = playhead.nextSegment || {
                title: "WURFI INTERSTITIAL",
                creatorName: "Network",
              };

              return (
                <tr
                  key={net.channelId}
                  onClick={() => onSelectChannel?.(net.channelId)}
                  className="cursor-pointer border-b border-blue-900/40 transition hover:bg-blue-950/40"
                >
                  <td className="border-r border-blue-900/60 bg-slate-950/60 p-3 font-bold text-yellow-400">
                    {String(net.channelNumber).padStart(2, "0")}
                  </td>
                  <td className="border-r border-blue-900/60 p-3 font-extrabold text-white">
                    {net.channelName}
                  </td>
                  <td className="border-r border-blue-900/60 p-3">
                    <div className="font-bold text-slate-200">
                      {currentShow.title}
                    </div>
                    <div className="text-[10px] text-blue-300/70">
                      BY {currentShow.creatorName ?? "Network"}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-400">{nextShow.title}</div>
                    <div className="text-[10px] text-slate-500">
                      BY {"creatorName" in nextShow ? nextShow.creatorName : "Network"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center overflow-hidden rounded-lg border border-blue-900/60 bg-slate-900/90 p-3">
        <span className="mr-3 rounded bg-yellow-500 px-2 py-0.5 text-[10px] font-black text-black uppercase">
          CH 04 ATX NEWS
        </span>
        <div
          className="whitespace-nowrap text-xs text-blue-200"
          style={{ animation: "atx-marquee 22s linear infinite" }}
        >
          {ticker}
        </div>
      </div>
    </div>
  );
};
