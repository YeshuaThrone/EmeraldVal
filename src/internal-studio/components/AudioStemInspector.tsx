"use client";

import React from "react";
import { MASTER_ASSET_MAP } from "../config/masterAssetMap";

export const AudioStemInspector: React.FC<{
  audioStemUrl?: string | null;
  activeTag?: "@video1" | "@video2";
}> = ({ audioStemUrl, activeTag }) => {
  const stems = MASTER_ASSET_MAP.filter(
    (asset) => asset.tag === "@video1" || asset.tag === "@video2",
  );

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-black p-3 text-xs">
      <h3 className="font-black tracking-widest text-zinc-400 uppercase">
        Audio stems
      </h3>
      {stems.map((stem) => (
        <div
          key={stem.tag}
          className={`rounded border px-2 py-1 ${
            activeTag === stem.tag
              ? "border-zinc-500 text-white"
              : "border-zinc-800 text-zinc-400"
          }`}
        >
          <div className="font-mono font-bold">{stem.tag}</div>
          <div>{stem.role}</div>
        </div>
      ))}
      {audioStemUrl ? (
        <audio src={audioStemUrl} controls className="w-full" />
      ) : (
        <p className="text-zinc-600">No stem attached</p>
      )}
    </div>
  );
};
