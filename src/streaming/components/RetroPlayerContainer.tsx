"use client";

import React, { useState } from "react";
import { CableSoundFX } from "../audio/cableSoundFx";
import { RetroCablePlayer } from "./RetroCablePlayer";
import type { MultiChannelEngine } from "../playout/multiChannelEngine";

interface RetroPlayerContainerProps {
  engine: MultiChannelEngine;
  initialChannelId?: string;
}

export const RetroPlayerContainer: React.FC<RetroPlayerContainerProps> = ({
  engine,
  initialChannelId,
}) => {
  const [poweredOn, setPoweredOn] = useState(false);

  const handlePowerOn = () => {
    CableSoundFX.unlockAudio();
    CableSoundFX.playStaticBurst(400);
    setPoweredOn(true);
  };

  if (!poweredOn) {
    return (
      <div className="relative flex aspect-video w-full max-w-5xl flex-col items-center justify-center overflow-hidden rounded-lg border-8 border-gray-900 bg-black font-mono shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%)",
            backgroundSize: "100% 4px",
          }}
        />
        <p className="mb-6 text-xs tracking-[0.4em] text-green-700 uppercase">
          Standby
        </p>
        <button
          type="button"
          onClick={handlePowerOn}
          className="rounded-full border-2 border-red-600 bg-red-700 px-8 py-3 text-sm font-black tracking-widest text-white shadow-[0_0_24px_rgba(220,38,38,0.55)] transition hover:bg-red-600"
        >
          POWER
        </button>
        <p className="mt-4 text-[10px] tracking-widest text-stone-500 uppercase">
          Press to unlock broadcast audio
        </p>
      </div>
    );
  }

  return (
    <RetroCablePlayer engine={engine} initialChannelId={initialChannelId} />
  );
};
