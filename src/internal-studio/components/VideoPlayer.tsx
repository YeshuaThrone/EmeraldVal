"use client";

import React from "react";

export const VideoPlayer: React.FC<{
  src?: string | null;
  shotId?: string;
}> = ({ src, shotId }) => {
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-zinc-800 bg-black text-xs tracking-widest text-zinc-500 uppercase">
        {shotId ? `${shotId} • no picture` : "No picture"}
      </div>
    );
  }

  return (
    <video
      key={src}
      src={src}
      controls
      playsInline
      className="aspect-video w-full rounded-lg border border-zinc-800 bg-black object-cover"
    />
  );
};
