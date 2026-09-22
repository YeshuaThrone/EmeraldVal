"use client";

import React, { useEffect, useState } from "react";
import { CableSoundFX } from "../audio/cableSoundFx";
import { OverTheAirGraphicsEngine } from "../graphics/overTheAirGraphicsEngine";
import { WorfiScreenSaver } from "../graphics/WorfiScreenSaver";
import type {
  CurrentPlayheadState,
  MultiChannelEngine,
} from "../playout/multiChannelEngine";
import { WorfiLiveChat } from "./WorfiLiveChat";

interface PlayerProps {
  engine: MultiChannelEngine;
  initialChannelId?: string;
}

function youtubeEmbedUrl(url: string): string | null {
  const watch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return watch
    ? `https://www.youtube-nocookie.com/embed/${watch[1]}?autoplay=1&controls=0&mute=1`
    : null;
}

function channelIndex(engine: MultiChannelEngine, channelId?: string): number {
  if (!channelId) return 0;
  const idx = engine.getNetworks().findIndex((ch) => ch.channelId === channelId);
  return idx >= 0 ? idx : 0;
}

export const RetroCablePlayer: React.FC<PlayerProps> = ({
  engine,
  initialChannelId,
}) => {
  const [playhead, setPlayhead] = useState<CurrentPlayheadState | null>(null);
  const [currentChannelIndex, setCurrentChannelIndex] = useState(() =>
    channelIndex(engine, initialChannelId),
  );
  const [isFlipping, setIsFlipping] = useState(false);
  const [showOSD, setShowOSD] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const channels = engine.getNetworks();
  const currentChannel = channels[currentChannelIndex] || {
    channelId: "ch-worfi",
    channelNumber: 1,
    channelName: "WURFI MAIN",
  };

  useEffect(() => {
    const updatePlayhead = () => {
      const list = engine.getNetworks();
      const activeChannel = list[currentChannelIndex];
      if (activeChannel) {
        setPlayhead(engine.getCurrentPlayhead(activeChannel.channelId));
      }
    };

    updatePlayhead();
    const interval = setInterval(updatePlayhead, 1000);
    return () => clearInterval(interval);
  }, [engine, currentChannelIndex]);

  const changeChannel = (direction: "UP" | "DOWN") => {
    if (channels.length === 0) return;
    CableSoundFX.playChannelClick();
    CableSoundFX.playStaticBurst(250);

    setIsFlipping(true);
    setShowOSD(true);

    setTimeout(() => {
      const count = engine.getNetworks().length || 1;
      if (direction === "UP") {
        setCurrentChannelIndex((prev) => (prev + 1) % count);
      } else {
        setCurrentChannelIndex((prev) => (prev - 1 + count) % count);
      }
      setIsFlipping(false);
    }, 250);
  };

  const youtube = playhead?.segment
    ? youtubeEmbedUrl(playhead.segment.streamUrl)
    : null;

  return (
    <div className="flex h-screen w-full select-none flex-col overflow-hidden bg-black font-mono text-slate-100 md:flex-row">
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 z-30 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
        <div className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_100px_rgba(2,6,23,0.9)]" />

        {isFlipping && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900 opacity-90">
            <div className="text-sm font-bold tracking-widest text-yellow-400">
              WURFI SWITCHING...
            </div>
          </div>
        )}

        {playhead?.segment ? (
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            {youtube ? (
              <iframe
                src={youtube}
                title={playhead.segment.title}
                className="h-full w-full border-0 object-cover"
                allow="autoplay; fullscreen"
              />
            ) : (
              <video
                src={playhead.segment.streamUrl}
                autoPlay
                muted
                playsInline
                className="h-full w-full border-0 object-cover"
              />
            )}

            <OverTheAirGraphicsEngine
              channelNumber={currentChannel.channelNumber}
              channelName={currentChannel.channelName}
              showTitle={playhead.segment.title}
              creatorName={playhead.segment.creatorName || "Wurfi Creator"}
              nextShowTitle={playhead.nextSegment?.title}
              playbackPositionSeconds={playhead.segment.positionSeconds}
              totalDurationSeconds={playhead.segment.durationSeconds}
            />
          </div>
        ) : (
          <WorfiScreenSaver
            channelNumber={currentChannel.channelNumber}
            channelName={currentChannel.channelName}
          />
        )}

        {showOSD && (
          <div className="absolute top-6 left-6 z-40 rounded-r-xl border-y border-r border-l-4 border-blue-800/40 border-l-yellow-400 bg-gradient-to-r from-blue-950/90 via-slate-900/90 to-blue-900/80 px-5 py-3 shadow-2xl backdrop-blur-md">
            <div className="text-[10px] font-black tracking-widest text-yellow-400 uppercase">
              WURFI CABLE BROADCAST
            </div>
            <div className="text-xl font-extrabold text-white">
              CH {String(currentChannel.channelNumber).padStart(2, "0")} •{" "}
              {currentChannel.channelName}
            </div>
          </div>
        )}

        <div className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-blue-900/60 bg-slate-900/80 px-6 py-3 shadow-[0_0_20px_rgba(30,58,138,0.4)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => changeChannel("DOWN")}
            className="rounded-full border border-blue-700/60 bg-blue-950 px-4 py-2 font-bold text-yellow-400 transition hover:bg-blue-900 active:scale-95"
          >
            ▼ CH -
          </button>
          <div className="px-2 text-xs font-bold text-slate-300">
            WURFI NETWORK
          </div>
          <button
            type="button"
            onClick={() => changeChannel("UP")}
            className="rounded-full border border-blue-700/60 bg-blue-950 px-4 py-2 font-bold text-yellow-400 transition hover:bg-blue-900 active:scale-95"
          >
            ▲ CH +
          </button>
          <button
            type="button"
            onClick={() => setShowMobileChat(!showMobileChat)}
            className="ml-2 rounded-full border border-yellow-500/40 bg-yellow-500/20 px-3 py-2 text-xs font-bold text-yellow-400 md:hidden"
          >
            💬
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 md:relative ${
          showMobileChat ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        <WorfiLiveChat channelId={currentChannel.channelId ?? currentChannel.channelName} />
      </div>
    </div>
  );
};
