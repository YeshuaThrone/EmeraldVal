"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

export function StudioHlsPreview({ src }: { src?: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls({ enableWorker: false });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      hls.destroy();
    };
  }, [src]);

  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-zinc-800 bg-black text-xs tracking-widest text-zinc-500 uppercase">
        Internal preview
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="aspect-video w-full rounded-lg border border-zinc-800 bg-black"
    />
  );
}
