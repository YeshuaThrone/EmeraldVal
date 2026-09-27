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
    nowPlaying: "Deep Space Documentary",
    nowCreator: "NASA Public Domain",
    upNext: "Hubble Operations",
    nextCreator: "NASA Broadcast",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    durationSeconds: 596,
  },
];

const DEFAULT_CHANNEL =
  WURFI_DEMO_LINEUP.find((p) => p.chNumber === "04") ?? WURFI_DEMO_LINEUP[0]!;

const FALLBACK_HLS =
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

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

const WurfiChannelVideo: React.FC<{
  channel: ProgramItem;
  autoPlay: boolean;
  onPlayingChange: (playing: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ channel, autoPlay, onPlayingChange, videoRef }) => {

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hls: {
      stopLoad: () => void;
      detachMedia: () => void;
      destroy: () => void;
    } | null = null;

    const playMuted = () => {
      if (cancelled) return;
      if (!autoPlay) return;
      video.muted = true;
      void video
        .play()
        .then(() => {
          if (!cancelled) onPlayingChange(true);
        })
        .catch(() => {
          if (!cancelled) onPlayingChange(false);
        });
    };

    const seekIfReady = () => {
      const offset = wallClockOffsetSeconds(channel);
      if (!(offset > 1) || video.seekable.length === 0) return;
      const end = video.seekable.end(video.seekable.length - 1);
      if (end >= offset) {
        video.currentTime = Math.min(offset, Math.max(0, end - 0.25));
      }
    };

    const attach = async () => {
      const url = channel.streamUrl;
      if (url.includes(".m3u8")) {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ enableWorker: false });
          hls = instance;
          instance.loadSource(url);
          instance.attachMedia(video);
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            playMuted();
          });
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (!data?.fatal || cancelled) return;
            if (url !== FALLBACK_HLS) {
              instance.loadSource(FALLBACK_HLS);
              return;
            }
            onPlayingChange(false);
          });
          return;
        }
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          playMuted();
          return;
        }
      }

      video.src = url;
      video.addEventListener("loadedmetadata", seekIfReady, { once: true });
      video.addEventListener("canplay", playMuted, { once: true });
      playMuted();
    };

    void attach();

    return () => {
      cancelled = true;
      if (hls) {
        hls.stopLoad();
        hls.detachMedia();
        hls.destroy();
        hls = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel, autoPlay, onPlayingChange, videoRef]);

  return (
    <video
      ref={videoRef}
      playsInline
      muted={autoPlay}
      autoPlay={autoPlay}
      className="h-full w-full object-cover"
    />
  );
};

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
    <div className="font-epg flex min-h-screen select-none flex-col items-center bg-wurfi-void p-3 text-slate-100 sm:p-4">
      <header className="mb-3 flex w-full max-w-6xl items-center justify-between rounded-xl border border-wurfi-jade/40 bg-black px-3 py-2">
        <h1 className="text-xl font-black tracking-widest text-white sm:text-2xl">
          WURFI <span className="text-wurfi-jade">NETWORK</span>
        </h1>

        {livePreview ? (
          <span className="font-osd text-xs tracking-widest text-wurfi-jade">
            LIVE
          </span>
        ) : (
          <div className="flex items-center gap-3 text-xs font-black tracking-wider uppercase">
            <span className="hidden text-zinc-300 sm:inline">
              Watching as {viewer?.displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                clearViewerSession();
                setViewer(null);
              }}
              className="rounded border border-wurfi-jade/50 bg-black px-3 py-1 text-wurfi-jade transition hover:bg-zinc-950"
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
  const [tuning, setTuning] = useState(false);
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
    setTuning(true);
    setIsPlaying(autoPlay);
    const id = window.setTimeout(() => setTuning(false), 650);
    return () => window.clearTimeout(id);
  }, [selectedChannel.chNumber, autoPlay]);

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
    <div className="flex w-full max-w-6xl flex-col gap-3">
      <div className="rounded-xl border border-wurfi-jade/40 bg-black p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-black tracking-widest text-wurfi-jade">
            CHANNELS
          </h2>
          <div className="font-osd text-sm tracking-widest text-wurfi-jade">
            {clock}
          </div>
        </div>
        <div className="relative z-20 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WURFI_DEMO_LINEUP.map((prog) => {
            const isSelected = selectedChannel.chNumber === prog.chNumber;
            return (
              <button
                type="button"
                key={prog.chNumber}
                aria-pressed={isSelected}
                data-channel={prog.chNumber}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedChannel(prog);
                  setIsPlaying(autoPlay);
                }}
                className={`flex min-h-[72px] cursor-pointer flex-col items-start rounded-lg border px-3 py-2 text-left ${
                  isSelected
                    ? "border-wurfi-jade bg-zinc-950"
                    : "border-zinc-800 hover:border-wurfi-jade/40"
                }`}
              >
                <span className="font-osd text-lg font-black text-wurfi-jade">
                  CH {prog.chNumber}
                </span>
                <span
                  className={`truncate text-xs font-black ${isSelected ? "text-wurfi-jade" : "text-white"}`}
                >
                  {prog.station}
                </span>
                <span className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">
                  {prog.nowPlaying}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between rounded-t-xl border border-wurfi-jade/50 bg-black px-3 py-1.5 text-wurfi-jade">
          <span className="font-osd text-sm tracking-widest sm:text-base">
            CH {selectedChannel.chNumber} • {selectedChannel.station}
          </span>
          <span className="font-osd rounded border border-wurfi-jade/40 px-2 py-0.5 text-xs text-white">
            LIVE
          </span>
        </div>
        <div className="relative aspect-video max-h-[48vh] w-full overflow-hidden rounded-b-xl border border-t-0 border-wurfi-jade/40 bg-black">
          <WurfiChannelVideo
            key={selectedChannel.chNumber}
            channel={selectedChannel}
            autoPlay={autoPlay}
            onPlayingChange={setIsPlaying}
            videoRef={videoRef}
          />

          {(tuning || (!isPlaying && autoPlay)) && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center">
              <span className="font-osd text-4xl tracking-widest text-wurfi-jade">
                CH {selectedChannel.chNumber}
              </span>
              <span className="mt-2 text-sm font-black tracking-widest text-white">
                {selectedChannel.station}
              </span>
              <span className="mt-3 text-[10px] font-black tracking-widest text-zinc-400">
                TUNING
              </span>
            </div>
          )}

          {isNewsChannel && currentHeadline && !tuning && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pt-8 pb-2">
              <span className="mb-1 inline-block bg-wurfi-jade px-1.5 py-0.5 text-[10px] font-black tracking-widest text-black">
                {currentHeadline.category} • ATX LOCAL NEWS
              </span>
              <p className="text-sm font-black leading-tight text-white sm:text-base">
                {currentHeadline.title}
              </p>
            </div>
          )}

          {!isPlaying && !isNewsChannel && !autoPlay && !tuning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-4 text-center">
              <div className="font-osd mb-3 text-lg tracking-widest text-wurfi-jade">
                {selectedChannel.station}
              </div>
              <p className="mb-3 text-[10px] font-black tracking-widest text-zinc-400">
                PRESS TO UNLOCK BROADCAST AUDIO & VIDEO
              </p>
              <button
                type="button"
                onClick={togglePower}
                className="cursor-pointer rounded-full border border-wurfi-jade bg-black px-6 py-2 text-xs font-black tracking-wider text-wurfi-jade uppercase"
              >
                POWER
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-wurfi-jade bg-black p-2">
        <span className="shrink-0 rounded bg-wurfi-jade px-2.5 py-1 text-xs font-black text-black">
          ATX NEWS
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <NewsTicker
            sseEndpoint="/api/v1/news/austin/stream"
            initialText={tickerText}
          />
        </div>
      </div>
    </div>
  );
};
