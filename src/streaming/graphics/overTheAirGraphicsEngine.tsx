"use client";

import React from "react";

interface GraphicsProps {
  channelNumber: number;
  channelName: string;
  showTitle: string;
  creatorName: string;
  socialHandle?: string;
  nextShowTitle?: string;
  playbackPositionSeconds: number;
  totalDurationSeconds: number;
}

export const OverTheAirGraphicsEngine: React.FC<GraphicsProps> = ({
  channelNumber,
  channelName,
  showTitle,
  creatorName,
  socialHandle,
  nextShowTitle,
  playbackPositionSeconds,
  totalDurationSeconds,
}) => {
  const remainingTime = totalDurationSeconds - playbackPositionSeconds;
  const showLowerThird = playbackPositionSeconds <= 10;
  const showUpNext = remainingTime <= 15 && remainingTime > 0 && !!nextShowTitle;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono select-none">
      <div className="absolute top-6 right-6 flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-black/60 px-3 py-1.5 opacity-80 shadow-lg backdrop-blur-md">
        <div className="h-2.5 w-2.5 animate-ping rounded-full bg-red-600" />
        <div>
          <div className="text-[10px] font-black tracking-widest text-yellow-400 uppercase">
            ATX CABLE
          </div>
          <div className="text-[9px] font-bold tracking-wider text-slate-300">
            CH {String(channelNumber).padStart(2, "0")} • {channelName}
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-10 left-8 transform transition-all duration-700 ${
          showLowerThird
            ? "translate-x-0 opacity-100"
            : "-translate-x-full opacity-0"
        }`}
      >
        <div className="max-w-md rounded-r-xl border-y border-r border-l-4 border-blue-800/50 border-l-yellow-500 bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-blue-900/90 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-0.5 text-[10px] font-bold tracking-widest text-yellow-400 uppercase">
            NOW BROADCASTING
          </div>
          <div className="truncate text-lg font-black text-white drop-shadow-md">
            {showTitle}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-medium text-indigo-200">
            <span>BY {creatorName}</span>
            {socialHandle ? (
              <span className="rounded border border-blue-700 bg-blue-900/60 px-2 py-0.5 text-[10px] text-yellow-300">
                {socialHandle}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={`absolute right-8 bottom-10 transform transition-all duration-700 ${
          showUpNext ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
        }`}
      >
        <div className="max-w-xs rounded-xl border-2 border-yellow-500/80 bg-black/80 p-3.5 text-right shadow-2xl backdrop-blur-md">
          <div className="text-[10px] font-extrabold tracking-widest text-yellow-400 uppercase">
            UP NEXT
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-white">
            {nextShowTitle}
          </div>
        </div>
      </div>
    </div>
  );
};
