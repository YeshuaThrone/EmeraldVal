"use client";

import React, { useMemo, useState } from "react";
import { RetroPlayerContainer } from "../components/RetroPlayerContainer";
import { RetroTVGuide } from "../components/RetroTVGuide";
import { cloneChannelPresets } from "../config/channelPresets";
import { MultiChannelEngine } from "../playout/multiChannelEngine";

export const WorfiPlayerView: React.FC = () => {
  const engine = useMemo(
    () => new MultiChannelEngine(cloneChannelPresets()),
    [],
  );
  const [channelId, setChannelId] = useState("ch-01");

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8">
      <RetroPlayerContainer
        key={channelId}
        engine={engine}
        initialChannelId={channelId}
      />
      <RetroTVGuide engine={engine} onSelectChannel={setChannelId} />
    </div>
  );
};
