"use client";

import React, { useEffect, useState } from "react";
import type { MultiChannelEngine } from "../playout/multiChannelEngine";

interface RetroTVGuideProps {
  engine: MultiChannelEngine;
  onSelectChannel?: (channelId: string) => void;
}

export const RetroTVGuide: React.FC<RetroTVGuideProps> = ({
  engine,
  onSelectChannel,
}) => {
  const channels = engine.getChannelList();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="w-full max-w-5xl select-none overflow-hidden rounded-lg border-4 border-yellow-500 bg-blue-950 font-mono shadow-2xl">
      <div className="flex items-center justify-between border-b-4 border-yellow-500 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-4 text-yellow-400">
        <div>
          <div className="text-2xl font-black tracking-widest text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            CABLE NETWORK GUIDE
          </div>
          <div className="text-xs tracking-wider text-blue-200">
            EXCLUSIVE PROGRAMMING CHANNEL LINEUP
          </div>
        </div>
        <div className="text-right">
          <div className="rounded border border-yellow-500/50 bg-black/60 px-3 py-1 font-mono text-xl font-bold text-yellow-300">
            {formatTime(currentTime)}
          </div>
          <div className="mt-1 text-[10px] tracking-widest text-blue-300 uppercase">
            AUSTIN CABLE BROADCAST
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 border-b-2 border-black bg-yellow-500 px-2 py-1.5 text-xs font-bold tracking-wider text-black uppercase">
        <div className="col-span-1 border-r border-black/30 text-center">CH</div>
        <div className="col-span-3 border-r border-black/30 pl-2">NETWORK</div>
        <div className="col-span-4 border-r border-black/30 pl-2">ON NOW</div>
        <div className="col-span-4 pl-2">COMING UP NEXT</div>
      </div>

      <div className="divide-y-2 divide-blue-900/80 bg-blue-950">
        {channels.map((ch) => {
          let currentShow = "LIVE BROADCAST";
          let nextShow = "STATION INTERLUDE";

          try {
            const playout = engine.resolveCurrentPlayout(ch.id);
            if (playout.activeSegment) currentShow = playout.activeSegment.title;
            if (playout.nextSegment) nextShow = playout.nextSegment.title;
          } catch {
            // Fallback if segment resolution is pending
          }

          return (
            <div
              key={ch.id}
              onClick={() => onSelectChannel?.(ch.id)}
              className="group grid cursor-pointer grid-cols-12 items-center px-2 py-3 text-sm text-white transition hover:bg-blue-800/60"
            >
              <div className="col-span-1 text-center font-bold text-yellow-400 group-hover:text-yellow-300">
                {String(ch.number).padStart(2, "0")}
              </div>
              <div className="col-span-3 truncate border-l-2 border-blue-800 pl-2 font-bold text-yellow-100">
                {ch.name}
                <div className="truncate text-[10px] font-normal text-blue-300">
                  {ch.category}
                </div>
              </div>
              <div className="col-span-4 truncate border-l-2 border-blue-800 pl-2 font-semibold text-white">
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {currentShow}
              </div>
              <div className="col-span-4 truncate border-l-2 border-blue-800 pl-2 text-xs text-blue-200">
                {nextShow}
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden border-t-2 border-black bg-yellow-500 px-4 py-1 text-xs font-bold whitespace-nowrap text-black">
        <div
          className="inline-block tracking-wide"
          style={{
            animation: "atx-marquee 22s linear infinite",
          }}
        >
          *** WELCOME TO THE NETWORK *** TUNING IN LIVE FROM AUSTIN, TX ***
          EXCLUSIVE SELECTED ARTISTS & SPECIAL FEATURES *** PRESS &apos;G&apos; ON
          PLAYER TO TOGGLE DIRECT OVERLAY ***
        </div>
      </div>
    </div>
  );
};
