"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FALLBACK_AUSTIN_HEADLINES,
  loadAustinHeadlines,
  AtxNewsService,
  type NewsHeadline,
} from "../news/atxNewsService";
import {
  calculateLiveStreamOffset,
  currentScheduledProgram,
  generate24HourSchedule,
  utcDayStart,
} from "../sdk/wurfi-sdk";
import { NewsTicker } from "../sdk/NewsTicker";
import { ViewerSignIn } from "./ViewerSignIn";
import { PREVIEW_ROUTE, WATCH_ROUTE } from "@/lib/routes";
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
  durationSeconds: number;
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
    durationSeconds: 5760,
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
    durationSeconds: 660,
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
    durationSeconds: 734,
  },
  {
    chNumber: "07",
    station: "NASA TV LIVE",
    nowPlaying: "ISS Live Earth Stream",
    nowCreator: "NASA Public Feed",
    upNext: "Deep Space Operations",
    nextCreator: "NASA Broadcast",
    streamUrl: "https://nasa-vh.akamaihd.net/i/NASA_TV@47068/master.m3u8",
    durationSeconds: 86400,
  },
];

const DEFAULT_CHANNEL =
  WURFI_DEMO_LINEUP.find((p) => p.chNumber === "04") ?? WURFI_DEMO_LINEUP[0]!;

function wallClockOffsetSeconds(item: ProgramItem, now: Date = new Date()): number {
  if (item.streamUrl.includes(".m3u8") || item.durationSeconds <= 0) {
    return 0;
  }
  const schedule = generate24HourSchedule(
    [
      {
        id: item.chNumber,
        title: item.nowPlaying,
        durationSeconds: item.durationSeconds,
      },
    ],
    utcDayStart(now),
  );
  const current = currentScheduledProgram(schedule, now);
  if (!current) return 0;
  const duration =
    (Date.parse(current.end_time_utc) - Date.parse(current.start_time_utc)) /
    1000;
  return calculateLiveStreamOffset(
    current.start_time_utc,
    duration,
    now.getTime(),
  );
}

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
      <div className="font-epg flex min-h-screen items-center justify-center bg-wurfi-void text-wurfi-jade">
        <p className="text-sm font-black tracking-widest">WURFI</p>
      </div>
    );
  }

  if (!livePreview && !viewer) {
    return <ViewerSignIn onSignedIn={setViewer} />;
  }

  return (
    <div className="font-epg flex min-h-screen select-none flex-col items-center bg-wurfi-void p-4 text-slate-100 sm:p-6">
      <header className="mb-4 flex w-full max-w-6xl flex-col items-center justify-between rounded-t-xl border border-wurfi-jade/40 bg-black p-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black tracking-widest text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.9)]">
            WURFI <span className="text-wurfi-jade">NETWORK</span>
          </h1>
        </div>

        {livePreview ? (
          <nav className="mt-4 flex items-center gap-4 text-xs font-black tracking-wider text-wurfi-jade uppercase sm:mt-0">
            <a href={PREVIEW_ROUTE} className="hover:text-wurfi-jade-deep">
              /preview
            </a>
            <a href={WATCH_ROUTE} className="hover:text-wurfi-jade-deep">
              /watch
            </a>
          </nav>
        ) : (
          <div className="mt-4 flex items-center gap-3 text-xs font-black tracking-wider uppercase sm:mt-0">
            <span className="text-zinc-300">
              Watching as {viewer?.displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                clearViewerSession();
                setViewer(null);
              }}
              className="rounded border border-wurfi-jade/50 bg-black px-4 py-1.5 text-wurfi-jade transition hover:bg-zinc-950"
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

      const seekToWallClock = () => {
        const offset = wallClockOffsetSeconds(selectedChannel);
        if (!(offset > 1)) return;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (duration > 1) {
          video.currentTime = Math.min(offset, duration - 0.25);
          return;
        }
        video.currentTime = offset;
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
      video.addEventListener("loadedmetadata", seekToWallClock, { once: true });
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
    <div className="w-full max-w-6xl space-y-4">
      <div className="flex items-center justify-between rounded-t-xl border border-wurfi-jade/50 bg-black p-3 text-xs font-bold tracking-wider text-wurfi-jade">
        <span className="font-osd text-lg tracking-widest text-wurfi-jade">
          CH {selectedChannel.chNumber} • {selectedChannel.station}
        </span>
        <span className="font-osd rounded border border-wurfi-jade/40 bg-black px-3 py-1 text-base text-white">
          LIVE BROADCAST
        </span>
      </div>

      <div className="relative flex aspect-video max-h-[42vh] w-full flex-col items-center justify-center overflow-hidden rounded-b-xl border border-t-0 border-wurfi-jade/40 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted={autoPlay}
          autoPlay={autoPlay}
          className="h-full w-full object-cover"
        />

        {isNewsChannel && currentHeadline && (
          <div className="pointer-events-none absolute inset-0">
            <span className="absolute top-3 left-3 rounded bg-wurfi-jade px-2 py-1 text-[10px] font-black tracking-widest text-black">
              ATX LOCAL NEWS • LIVE
            </span>
            <div className="absolute right-0 bottom-7 left-0 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-10 pb-3">
              <div className="mb-1 inline-block bg-wurfi-jade px-2 py-0.5 text-[10px] font-black tracking-widest text-black">
                {currentHeadline.category}
              </div>
              <p className="text-lg font-black leading-tight text-white drop-shadow-[1px_1px_0_#000] sm:text-2xl">
                {currentHeadline.title}
              </p>
              <p className="mt-1 text-[10px] font-bold tracking-wider text-wurfi-jade uppercase">
                {currentHeadline.source} • {currentHeadline.timestamp}
              </p>
            </div>
            <div className="absolute right-0 bottom-0 left-0 overflow-hidden bg-wurfi-jade py-1">
              <div
                className="font-epg whitespace-nowrap text-xs font-bold text-black"
                style={{ animation: "atx-marquee 22s linear infinite" }}
              >
                {tickerText} • {tickerText}
              </div>
            </div>
          </div>
        )}

        {!isPlaying && !isNewsChannel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-4 text-center">
            <div className="font-osd mb-4 animate-pulse text-2xl tracking-widest text-wurfi-jade">
              {selectedChannel.station} • READY FOR PLAYOUT
            </div>

            <button
              type="button"
              onClick={togglePower}
              className="cursor-pointer rounded-full border-2 border-wurfi-jade bg-black px-8 py-3 text-sm font-black tracking-wider text-wurfi-jade uppercase transition hover:bg-zinc-950 active:scale-95"
            >
              POWER
            </button>

            <span className="font-osd mt-4 text-sm tracking-wider text-zinc-500">
              PRESS TO UNLOCK BROADCAST AUDIO & VIDEO
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-wurfi-jade bg-black p-2">
        <span className="shrink-0 rounded bg-wurfi-jade px-2.5 py-1 text-xs font-black text-black shadow-[1px_1px_0px_#000]">
          ATX NEWS TICKER
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <NewsTicker
            sseEndpoint="/api/v1/news/austin/stream"
            initialText={tickerText}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-wurfi-jade/40 bg-black p-4">
        <div className="flex items-center justify-between border-b border-wurfi-jade/30 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-wurfi-jade shadow-[0_0_8px_#5ee9b5]" />
              <h2 className="text-2xl font-black tracking-wider text-wurfi-jade">
                WURFI PROGRAM GUIDE
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              All channels • news on CH 04
            </p>
          </div>

          <div className="rounded border border-wurfi-jade/30 bg-black px-3 py-1.5 text-right">
            <div className="text-[10px] font-bold text-zinc-400">
              NETWORK TIME
            </div>
            <div className="font-osd text-lg tracking-widest text-wurfi-jade">
              {clock}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-wurfi-jade/20 bg-black font-black text-wurfi-jade uppercase">
                <th className="p-2">CH #</th>
                <th className="p-2">STATION</th>
                <th className="p-2">NOW PLAYING</th>
                <th className="p-2">UP NEXT</th>
              </tr>
            </thead>
            <tbody className="font-epg divide-y divide-zinc-900">
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
                        ? "border-l-4 border-l-wurfi-jade bg-zinc-950"
                        : "hover:bg-zinc-950"
                    }`}
                  >
                    <td className="font-osd p-2 text-base font-black text-wurfi-jade">
                      {prog.chNumber}
                    </td>
                    <td
                      className={`p-2 font-bold ${isSelected ? "text-wurfi-jade" : "text-white"}`}
                    >
                      {prog.station}
                    </td>
                    <td className="p-2 text-zinc-300">
                      <div className="font-bold text-white">
                        {prog.nowPlaying}
                      </div>
                      <div className="text-[10px] text-wurfi-jade/80">
                        {prog.nowCreator}
                      </div>
                    </td>
                    <td className="p-2 text-zinc-400">
                      <div className="font-bold text-slate-200">
                        {prog.upNext}
                      </div>
                      <div className="text-[10px] text-zinc-500">
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
