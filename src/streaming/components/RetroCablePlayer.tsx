"use client";

import React, { useEffect, useRef, useState } from "react";
import { CableSoundFX } from "../audio/cableSoundFx";
import { CableGraphicsEngine, type CableOverlayState } from "../graphics/cableGraphicsEngine";
import { OverTheAirGraphicsEngine } from "../graphics/overTheAirGraphicsEngine";
import { WorfiScreenSaver } from "../graphics/WorfiScreenSaver";
import type { MultiChannelEngine, ProgramSegment } from "../playout/multiChannelEngine";
import { StreamHealthMonitor } from "../playout/streamHealthMonitor";

interface RetroCablePlayerProps {
  engine: MultiChannelEngine;
  initialChannelId?: string;
}

function youtubeEmbedUrl(url: string): string | null {
  const watch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return watch ? `https://www.youtube-nocookie.com/embed/${watch[1]}?autoplay=1&mute=1` : null;
}

export const RetroCablePlayer: React.FC<RetroCablePlayerProps> = ({
  engine,
  initialChannelId = "ch-haven",
}) => {
  const channels = engine.getChannelList();
  const initialIndex = Math.max(
    0,
    channels.findIndex((ch) => ch.id === initialChannelId),
  );
  const [currentChannelIndex, setCurrentChannelIndex] = useState(
    initialIndex === -1 ? 0 : initialIndex,
  );
  const [showOSD, setShowOSD] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [overlayState, setOverlayState] = useState<CableOverlayState | null>(
    null,
  );
  const [currentSegment, setCurrentSegment] = useState<ProgramSegment | null>(
    null,
  );
  const [nextShowTitle, setNextShowTitle] = useState<string | undefined>();
  const [offsetSeconds, setOffsetSeconds] = useState(0);
  const [failedSegmentId, setFailedSegmentId] = useState<string | null>(null);
  const triedFallback = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeChannel = channels[currentChannelIndex];

  useEffect(() => {
    if (!activeChannel) return;

    const updatePlayout = () => {
      try {
        const playout = engine.resolveCurrentPlayout(activeChannel.id);
        setCurrentSegment(playout.activeSegment);
        setNextShowTitle(playout.nextSegment.title);
        setOffsetSeconds(playout.offsetSeconds);

        const graphics = CableGraphicsEngine.evaluateCableGraphics(
          playout.channel,
          playout.activeSegment,
          playout.nextSegment,
          playout.offsetSeconds,
        );
        setOverlayState(graphics);
      } catch (err) {
        console.error("Playout error:", err);
      }
    };

    updatePlayout();
    const interval = setInterval(updatePlayout, 1000);
    return () => clearInterval(interval);
  }, [activeChannel, currentChannelIndex, engine]);

  useEffect(() => {
    triedFallback.current = false;
  }, [currentSegment?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSegment) return;
    const sync = () => {
      if (Math.abs(video.currentTime - offsetSeconds) > 2) {
        video.currentTime = offsetSeconds;
      }
    };
    if (video.readyState >= 1) {
      sync();
    } else {
      video.addEventListener("loadedmetadata", sync, { once: true });
    }
  }, [currentSegment, offsetSeconds, currentChannelIndex]);

  const changeChannel = (direction: "UP" | "DOWN") => {
    if (channels.length === 0) return;

    // Trigger tactile clicks and CRT noise bursts
    CableSoundFX.playChannelClick();
    CableSoundFX.playStaticBurst(250);

    setIsFlipping(true);
    setShowOSD(true);

    setTimeout(() => {
      if (direction === "UP") {
        setCurrentChannelIndex((prev) => (prev + 1) % channels.length);
      } else {
        setCurrentChannelIndex(
          (prev) => (prev - 1 + channels.length) % channels.length,
        );
      }
      setIsFlipping(false);
    }, 250);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") changeChannel("UP");
      if (e.key === "ArrowDown") changeChannel("DOWN");
      if (e.key === "g" || e.key === "G") setShowGuide((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!activeChannel) {
    return (
      <div className="flex aspect-video w-full max-w-5xl items-center justify-center rounded-lg border-8 border-gray-900 bg-black font-mono text-green-400">
        No channels registered
      </div>
    );
  }

  const youtube = currentSegment ? youtubeEmbedUrl(currentSegment.videoUrl) : null;
  const standby =
    currentSegment?.type === "STATION_ID" ||
    failedSegmentId === currentSegment?.id;

  return (
    <div className="relative aspect-video w-full max-w-5xl select-none overflow-hidden rounded-lg border-8 border-gray-900 bg-black font-mono shadow-2xl">
      {youtube && !isFlipping ? (
        <iframe
          title={currentSegment?.title ?? "Live broadcast"}
          src={youtube}
          className="h-full w-full"
          allow="autoplay; encrypted-media"
        />
      ) : (
        <video
          ref={videoRef}
          src={currentSegment?.videoUrl}
          autoPlay
          muted
          playsInline
          onError={() => {
            const video = videoRef.current;
            if (video && !triedFallback.current) {
              triedFallback.current = true;
              video.src = StreamHealthMonitor.getEmergencyFallbackUrl();
              void video.play();
              return;
            }
            setFailedSegmentId(currentSegment?.id ?? "failed");
          }}
          className={`h-full w-full object-cover transition-opacity duration-150 ${
            isFlipping ? "opacity-10 blur-sm" : "opacity-100"
          }`}
        />
      )}

      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      {isFlipping && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 opacity-80">
          <div className="animate-pulse text-3xl font-bold tracking-widest text-white">
            {"/// STATIC NOISE ///"}
          </div>
        </div>
      )}

      {standby && !isFlipping ? (
        <WorfiScreenSaver
          channelNumber={activeChannel.number}
          channelName={activeChannel.name}
        />
      ) : null}

      {showOSD && !isFlipping && (
        <div className="absolute top-6 left-6 rounded border border-green-500/50 bg-black/70 px-4 py-2 font-mono text-lg text-green-400 shadow-lg">
          <span className="font-bold">
            CH {String(activeChannel.number).padStart(2, "0")}
          </span>{" "}
          - {activeChannel.name}
          <div className="text-xs text-green-300/80">
            {currentSegment?.title || "LIVE BROADCAST"}
          </div>
        </div>
      )}

      {!isFlipping && currentSegment && !standby ? (
        <OverTheAirGraphicsEngine
          channelNumber={activeChannel.number}
          channelName={activeChannel.name}
          showTitle={currentSegment.title}
          creatorName={currentSegment.creatorName}
          socialHandle={currentSegment.metadata?.socialHandle}
          nextShowTitle={nextShowTitle}
          playbackPositionSeconds={offsetSeconds}
          totalDurationSeconds={currentSegment.durationSeconds}
        />
      ) : null}

      {overlayState?.interludePromo.visible &&
        overlayState.interludePromo.promoType !== "UP_NEXT" &&
        !isFlipping && (
        <div className="absolute right-6 bottom-10 left-6 flex items-center gap-4 rounded border-l-4 border-yellow-400 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 p-4 text-white shadow-2xl">
          {overlayState.interludePromo.creatorAvatarUrl ? (
            <img
              src={overlayState.interludePromo.creatorAvatarUrl}
              alt=""
              className="h-14 w-14 rounded-full border-2 border-yellow-400 object-cover"
            />
          ) : null}
          <div className="flex-1">
            <div className="text-xs font-bold tracking-wider text-yellow-300 uppercase">
              {overlayState.interludePromo.promoType === "STATION_ID"
                ? "STATION IDENTIFICATION"
                : "SPOTLIGHT CREATOR"}
            </div>
            <div className="text-lg font-bold">
              {overlayState.interludePromo.creatorName}
            </div>
            <div className="text-xs text-gray-200">
              {overlayState.interludePromo.showTitle}
            </div>
          </div>
          {overlayState.interludePromo.socialHandle && (
            <div className="rounded bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
              {overlayState.interludePromo.socialHandle}
            </div>
          )}
        </div>
      )}

      {showGuide && (
        <div className="absolute inset-0 overflow-y-auto border-4 border-yellow-500 bg-blue-950/95 p-8 font-mono text-yellow-300">
          <div className="mb-4 flex justify-between border-b-2 border-yellow-500 pb-2 text-2xl font-bold">
            <span>NETWORK PROGRAM GUIDE</span>
            <span className="text-xs text-white">PRESS &apos;G&apos; TO CLOSE</span>
          </div>
          <div className="space-y-3">
            {channels.map((ch, idx) => (
              <div
                key={ch.id}
                onClick={() => {
                  setCurrentChannelIndex(idx);
                  setShowGuide(false);
                }}
                className={`cursor-pointer rounded border p-3 ${
                  idx === currentChannelIndex
                    ? "border-yellow-300 bg-yellow-500 font-bold text-black"
                    : "border-blue-700 bg-blue-900/50 text-white hover:bg-blue-800"
                }`}
              >
                <span className="mr-4">
                  CH {String(ch.number).padStart(2, "0")}
                </span>
                <span className="font-bold">{ch.name}</span>
                <span className="ml-4 text-xs opacity-75">({ch.category})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute right-4 bottom-2 flex gap-2">
        <button
          type="button"
          onClick={() => changeChannel("DOWN")}
          className="rounded border border-gray-600 bg-gray-800 px-3 py-1 text-xs text-white hover:bg-gray-700"
        >
          CH -
        </button>
        <button
          type="button"
          onClick={() => changeChannel("UP")}
          className="rounded border border-gray-600 bg-gray-800 px-3 py-1 text-xs text-white hover:bg-gray-700"
        >
          CH +
        </button>
        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="rounded border border-yellow-400 bg-yellow-600 px-3 py-1 text-xs font-bold text-black hover:bg-yellow-500"
        >
          GUIDE
        </button>
      </div>
    </div>
  );
};
