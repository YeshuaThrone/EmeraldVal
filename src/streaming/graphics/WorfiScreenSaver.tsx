"use client";

import React, { useEffect, useState } from "react";

interface WorfiScreenSaverProps {
  channelNumber: number;
  channelName: string;
}

const LOGO_COLORS = [
  "text-yellow-400 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.6)]",
  "text-cyan-400 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]",
  "text-fuchsia-500 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.6)]",
  "text-emerald-400 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)]",
] as const;

interface BounceState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  colorIndex: number;
}

export const WorfiScreenSaver: React.FC<WorfiScreenSaverProps> = ({
  channelNumber,
  channelName,
}) => {
  const [bounce, setBounce] = useState<BounceState>({
    x: 10,
    y: 10,
    dx: 1.5,
    dy: 1.2,
    colorIndex: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setBounce((prev) => {
        let { x, y, dx, dy, colorIndex } = prev;
        x += dx;
        y += dy;

        if (x <= 5 || x >= 75) {
          dx = -dx;
          x = Math.min(75, Math.max(5, x));
          colorIndex = (colorIndex + 1) % LOGO_COLORS.length;
        }
        if (y <= 5 || y >= 75) {
          dy = -dy;
          y = Math.min(75, Math.max(5, y));
          colorIndex = (colorIndex + 1) % LOGO_COLORS.length;
        }

        return { x, y, dx, dy, colorIndex };
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col justify-between overflow-hidden bg-slate-950 p-8 font-mono">
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-40 [background-size:16px_16px]" />

      <div className="z-20 flex items-center justify-between border-b border-slate-800/80 pb-4 text-xs font-bold tracking-widest text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          <span>WURFI BROADCAST NETWORK</span>
        </div>
        <div>OFF-AIR / INTERSTITIAL STANDBY</div>
      </div>

      <div
        className="absolute duration-75"
        style={{ left: `${bounce.x}%`, top: `${bounce.y}%` }}
      >
        <div
          className={`rounded-2xl border-4 bg-black/80 px-6 py-3 text-3xl font-black tracking-tighter backdrop-blur-md transition-colors duration-300 ${LOGO_COLORS[bounce.colorIndex]}`}
        >
          WURFI
          <span className="block font-mono text-xs font-normal tracking-normal text-white/70">
            CHANNEL {String(channelNumber).padStart(2, "0")} • {channelName}
          </span>
        </div>
      </div>

      <div className="z-20 flex items-end justify-between font-mono text-[11px] text-slate-500">
        <div>
          <div className="font-bold text-slate-400">STATION IDENTIFICATION</div>
          <div>WURFI-TV AUSTIN • ALL RIGHTS RESERVED</div>
        </div>
        <div className="text-right">
          <div className="font-bold text-yellow-500/80">
            PROGRAMMING WILL RESUME SHORTLY
          </div>
          <div className="text-[10px] text-slate-600">SIGNAL STATUS: OPTIMAL</div>
        </div>
      </div>
    </div>
  );
};
