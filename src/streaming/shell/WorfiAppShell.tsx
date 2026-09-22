"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FALLBACK_AUSTIN_HEADLINES,
  loadAustinHeadlines,
  AtxNewsService,
  type NewsHeadline,
} from "../news/atxNewsService";
import { ViewerSignIn } from "./ViewerSignIn";
import {
  clearViewerSession,
  readViewerSession,
  type ViewerSession,
} from "./viewerSession";

interface ProgramItem {
  chNumber: string;
  station: string;
  nowPlaying: string;
  nowCreator: string;
  upNext: string;
  nextCreator: string;
  streamUrl: string;
}

export const WURFI_DEMO_LINEUP: ProgramItem[] = [
  {
    chNumber: "01",
    station: "WURFI MAIN",
    nowPlaying: "Night of the Living Dead (1968)",
    nowCreator: "Public Domain Feature",
    upNext: "Tears of Steel (4K Sci-Fi)",
    nextCreator: "Blender Studio",
    streamUrl:
      "https://archive.org/download/night-of-the-living-dead_1968/Night%20of%20the%20Living%20Dead%20-%20%281968%29.mp4",
  },
  {
    chNumber: "02",
    station: "CLASSIC CARTOONS",
    nowPlaying: "Superman: The Mad Scientist",
    nowCreator: "1941 Fleischer Studios",
    upNext: "Popeye Meets Sinbad",
    nextCreator: "Classic Animation",
    streamUrl:
      "https://archive.org/download/superman_1941/superman_1941_512kb.mp4",
  },
  {
    chNumber: "04",
    station: "ATX LOCAL NEWS",
    nowPlaying: "Austin Local Headlines",
    nowCreator: "WURFI NETWORK",
    upNext: "Travis County Traffic & Weather",
    nextCreator: "ATX Weather Network",
    streamUrl:
      "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
  },
  {
    chNumber: "07",
    station: "NASA TV LIVE",
    nowPlaying: "ISS Live Earth Stream",
    nowCreator: "NASA Public Feed",
    upNext: "Deep Space Operations",
    nextCreator: "NASA Broadcast",
    streamUrl: "https://nasa-vh.akamaihd.net/i/NASA_TV@47068/master.m3u8",
  },
];

const DEFAULT_CHANNEL =
  WURFI_DEMO_LINEUP.find((p) => p.chNumber === "04") ?? WURFI_DEMO_LINEUP[0]!;

function formatAustinClock(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now);
}

export const WorfiAppShell: React.FC<{ livePreview?: boolean }> = ({
  livePreview = false,
}) => {
  const [hydrated, setHydrated] = useState(false);
  const [viewer, setViewer] = useState<ViewerSession | null>(null);

  useEffect(() => {
    setViewer(readViewerSession());
    setHydrated(true);
  }, []);

  if (!livePreview && !hydrated) {
    return (
      <div className="font-epg flex min-h-screen items-center justify-center bg-[#050814] text-yellow-400">
        <p className="text-sm font-black tracking-widest">WURFI</p>
      </div>
    );
  }

  if (!livePreview && !viewer) {
    return <ViewerSignIn onSignedIn={setViewer} />;
  }

  return (
    <div className="font-epg flex min-h-screen select-none flex-col items-center bg-[#050814] p-4 text-slate-100 sm:p-8">
      <header className="mb-6 flex w-full max-w-6xl flex-col items-center justify-between rounded-t-xl border-t border-r border-l border-blue-500/50 border-b-2 border-b-blue-600/80 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.6)] sm:flex-row">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black tracking-widest text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.9)]">
            WURFI <span className="text-yellow-400">NETWORK</span>
          </h1>
        </div>

        {livePreview ? (
          <span className="mt-4 text-xs font-black tracking-wider text-yellow-400 uppercase sm:mt-0">
            LIVE PREVIEW
          </span>
        ) : (
          <div className="mt-4 flex items-center gap-3 text-xs font-black tracking-wider uppercase sm:mt-0">
            <span className="text-blue-100">
              Watching as {viewer?.displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                clearViewerSession();
                setViewer(null);
              }}
              className="rounded border-2 border-blue-600 bg-blue-900/60 px-4 py-1.5 text-blue-100 transition hover:bg-blue-800"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="flex w-full justify-center">
        <WorfiGuidePlayerView autoPlay={livePreview} />
      </main>
    </div>
  );
};

export const WorfiGuidePlayerView: React.FC<{ autoPlay?: boolean }> = ({
  autoPlay = false,
}) => {
  const [selectedChannel, setSelectedChannel] =
    useState<ProgramItem>(DEFAULT_CHANNEL);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>(
    FALLBACK_AUSTIN_HEADLINES,
  );
  const [currentNewsIdx, setCurrentNewsIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [clock, setClock] = useState("09:13 PM CDT");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void loadAustinHeadlines().then((data) => {
        if (!cancelled && data.length > 0) setHeadlines(data);
      });
    };
    load();
    const refresh = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (headlines.length === 0) return;
    const interval = setInterval(() => {
      setCurrentNewsIdx((prev) => (prev + 1) % headlines.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [headlines]);

  useEffect(() => {
    const tick = () => setClock(formatAustinClock(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const url = selectedChannel.streamUrl;
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;

    const bind = async () => {
      const tryPlay = () => {
        if (!autoPlay) return;
        video.muted = true;
        void video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      };

      if (url.includes(".m3u8")) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          tryPlay();
          return;
        }
        const { default: Hls } = await import("hls.js");
        if (cancelled || !videoRef.current) return;
        if (!Hls.isSupported()) {
          video.src = url;
          tryPlay();
          return;
        }
        const instance = new Hls({ enableWorker: false });
        instance.loadSource(url);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          tryPlay();
        });
        hls = instance;
        return;
      }
      video.src = url;
      tryPlay();
    };

    void bind();
    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [selectedChannel, autoPlay]);

  const togglePower = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    const start = () =>
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    if (video.readyState >= 2) {
      void start();
      return;
    }
    const onReady = () => {
      video.removeEventListener("canplay", onReady);
      void start();
    };
    video.addEventListener("canplay", onReady);
    void start();
  };

  const currentHeadline = headlines[currentNewsIdx];
  const isNewsChannel = selectedChannel.chNumber === "04";
  const tickerText = AtxNewsService.formatTicker(headlines);

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between rounded-t-xl border-2 border-blue-600 bg-blue-900/80 p-3 text-xs font-bold tracking-wider text-yellow-300">
        <span className="font-osd text-lg tracking-widest text-yellow-400">
          CH {selectedChannel.chNumber} • {selectedChannel.station}
        </span>
        <span className="font-osd rounded border border-blue-700 bg-blue-950 px-3 py-1 text-base text-white">
          LIVE BROADCAST
        </span>
      </div>

      <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-b-xl border-2 border-t-0 border-blue-600/80 bg-black shadow-[0_0_30px_rgba(0,50,150,0.3)]">
        <video
          ref={videoRef}
          playsInline
          muted={autoPlay}
          autoPlay={autoPlay}
          className="h-full w-full object-cover"
        />

        {isNewsChannel && currentHeadline && (
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute top-3 left-3 rounded bg-red-600 px-2 py-1 text-[10px] font-black tracking-widest text-white">
              ATX LOCAL NEWS • LIVE
            </span>
            <div className="absolute right-0 bottom-7 left-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent px-4 pt-10 pb-3">
              <div className="mb-1 inline-block bg-yellow-400 px-2 py-0.5 text-[10px] font-black tracking-widest text-blue-950">
                {currentHeadline.category}
              </div>
              <p className="text-lg font-black leading-tight text-white drop-shadow-[1px_1px_0_#000] sm:text-2xl">
                {currentHeadline.title}
              </p>
              <p className="mt-1 text-[10px] font-bold tracking-wider text-blue-200 uppercase">
                {currentHeadline.source} • {currentHeadline.timestamp}
              </p>
            </div>
            <div className="absolute right-0 bottom-0 left-0 overflow-hidden bg-yellow-400 py-1">
              <div
                className="font-epg whitespace-nowrap text-xs font-bold text-blue-950"
                style={{ animation: "atx-marquee 22s linear infinite" }}
              >
                {tickerText} • {tickerText}
              </div>
            </div>
          </div>
        )}

        {!isPlaying && !isNewsChannel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-4 text-center">
            <div className="font-osd mb-4 animate-pulse text-2xl tracking-widest text-emerald-400">
              {selectedChannel.station} • READY FOR PLAYOUT
            </div>

            <button
              type="button"
              onClick={togglePower}
              className="cursor-pointer rounded-full border-2 border-red-400 bg-red-600 px-8 py-3 text-sm font-black tracking-wider text-white uppercase shadow-[0_0_20px_rgba(220,38,38,0.6)] transition hover:bg-red-500 active:scale-95"
            >
              POWER
            </button>

            <span className="font-osd mt-4 text-sm tracking-wider text-slate-400">
              PRESS TO UNLOCK BROADCAST AUDIO & VIDEO
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-hidden rounded-xl border-2 border-yellow-400 bg-blue-950 p-2">
        <span className="shrink-0 rounded bg-yellow-400 px-2.5 py-1 text-xs font-black text-blue-950 shadow-[1px_1px_0px_#000]">
          ATX NEWS TICKER
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="font-epg whitespace-nowrap text-xs text-slate-200"
            style={{ animation: "atx-marquee 22s linear infinite" }}
          >
            {tickerText} • {tickerText}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border-2 border-blue-600 bg-[#091026] p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-blue-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" />
              <h2 className="text-2xl font-black tracking-wider text-yellow-400">
                WURFI PROGRAM GUIDE
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-blue-200/80">
              Synchronized 24/7 Cable Grid
            </p>
          </div>

          <div className="rounded border border-blue-700 bg-blue-950 px-3 py-1.5 text-right">
            <div className="text-[10px] font-bold text-blue-300">
              NETWORK TIME
            </div>
            <div className="font-osd text-lg tracking-widest text-yellow-400">
              {clock}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-blue-800 bg-blue-950/80 font-black text-blue-300 uppercase">
                <th className="p-3">CH #</th>
                <th className="p-3">STATION</th>
                <th className="p-3">NOW PLAYING</th>
                <th className="p-3">UP NEXT</th>
              </tr>
            </thead>
            <tbody className="font-epg divide-y divide-blue-900/60">
              {WURFI_DEMO_LINEUP.map((prog) => {
                const isSelected = selectedChannel.chNumber === prog.chNumber;
                return (
                  <tr
                    key={prog.chNumber}
                    onClick={() => {
                      setSelectedChannel(prog);
                      if (!autoPlay) setIsPlaying(false);
                    }}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? "border-l-4 border-l-yellow-400 bg-blue-950/90"
                        : "hover:bg-blue-900/40"
                    }`}
                  >
                    <td className="font-osd p-3 text-base font-black text-yellow-400">
                      {prog.chNumber}
                    </td>
                    <td
                      className={`p-3 font-bold ${isSelected ? "text-yellow-300" : "text-white"}`}
                    >
                      {prog.station}
                    </td>
                    <td className="p-3 text-blue-100">
                      <div className="font-bold text-white">
                        {prog.nowPlaying}
                      </div>
                      <div className="text-[10px] text-blue-300">
                        {prog.nowCreator}
                      </div>
                    </td>
                    <td className="p-3 text-blue-200/80">
                      <div className="font-bold text-slate-200">
                        {prog.upNext}
                      </div>
                      <div className="text-[10px] text-blue-400">
                        {prog.nextCreator}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
