"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  AtxNewsService,
  type NewsHeadline,
} from "../news/atxNewsService";

export interface RoyaltyFreeChannel {
  chNumber: string;
  station: string;
  title: string;
  rights: "PUBLIC_DOMAIN" | "CREATIVE_COMMONS" | "AUSTIN_MUNICIPAL";
  streamUrl: string;
}

export const WORFI_FREE_LINEUP: RoyaltyFreeChannel[] = [
  {
    chNumber: "01",
    station: "WORFI MAIN",
    title: "Night of the Living Dead (1968)",
    rights: "PUBLIC_DOMAIN",
    streamUrl:
      "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4",
  },
  {
    chNumber: "02",
    station: "CLASSIC ANIMATION",
    title: "Superman: The Mad Scientist (1941)",
    rights: "PUBLIC_DOMAIN",
    streamUrl:
      "https://archive.org/download/superman_1941/superman_1941_512kb.mp4",
  },
  {
    chNumber: "04",
    station: "ATX LOCAL NEWS",
    title: "Live Feed",
    rights: "AUSTIN_MUNICIPAL",
    streamUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  },
];

const DEFAULT_CHANNEL: RoyaltyFreeChannel = WORFI_FREE_LINEUP[2] ??
  WORFI_FREE_LINEUP[0]!;

export const WorfiPreviewSDK: React.FC = () => {
  const [activeChannel, setActiveChannel] =
    useState<RoyaltyFreeChannel>(DEFAULT_CHANNEL);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    void AtxNewsService.getLiveAustinHeadlines().then((next) => {
      if (!cancelled) setHeadlines(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!isPlaying || !video) return;

    const url = activeChannel.streamUrl;
    const isHls = url.includes(".m3u8");
    if (isHls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    video.src = url;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [isPlaying, activeChannel]);

  const lead = headlines[0];

  return (
    <div className="mx-auto w-full max-w-4xl rounded-xl border-2 border-blue-600 bg-slate-950 p-6 font-sans text-white shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-blue-800 pb-3">
        <h2 className="text-xl font-black tracking-wider text-yellow-400">
          WORFI PREVIEW SDK • LIVE NEWS & ROYALTY-FREE PLAYER
        </h2>
        <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 font-mono text-xs text-emerald-400">
          PREVIEW READY
        </span>
      </div>

      <div className="relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-blue-900 bg-black">
        {isPlaying ? (
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="space-y-3 p-6 text-center">
            <div className="font-mono text-sm text-yellow-400">
              CH {activeChannel.chNumber} • {activeChannel.station}
            </div>
            <p className="text-lg font-bold text-slate-300">
              {activeChannel.title}
            </p>
            <span className="inline-block rounded border border-blue-500 bg-blue-900/60 px-3 py-1 text-xs text-blue-200">
              License: {activeChannel.rights}
            </span>
            <div>
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="mt-2 rounded-full bg-yellow-400 px-6 py-2 text-xs font-black tracking-wider text-blue-950 uppercase shadow-lg transition hover:bg-yellow-300"
              >
                Launch Preview
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-800 bg-blue-950 p-3">
        <span className="shrink-0 rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-black tracking-wider text-blue-950">
          ATX NEWS FEED
        </span>
        <div className="truncate font-mono text-xs text-slate-200">
          {lead
            ? `[${lead.category}] ${lead.title} — ${lead.timestamp}`
            : "Fetching live Austin news feed..."}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {WORFI_FREE_LINEUP.map((ch) => (
          <button
            type="button"
            key={ch.chNumber}
            onClick={() => {
              setActiveChannel(ch);
              setIsPlaying(true);
            }}
            className={`rounded-lg border p-3 text-left transition ${
              activeChannel.chNumber === ch.chNumber
                ? "border-yellow-400 bg-blue-900 text-white"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            <div className="font-mono text-xs font-bold text-yellow-400">
              CH {ch.chNumber}
            </div>
            <div className="truncate text-xs font-bold text-slate-200">
              {ch.station}
            </div>
            <div className="truncate text-[10px] text-slate-400">{ch.rights}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
