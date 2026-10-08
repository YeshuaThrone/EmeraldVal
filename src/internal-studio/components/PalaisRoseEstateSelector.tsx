"use client";

import React, { useState } from "react";
import {
  PALAIS_ROSE_EXTERIOR_PRESET,
  PALAIS_ROSE_INTERIOR_ROOMS,
  compilePalaisRoseExteriorPrompt,
  compilePalaisRoseRoomPrompt,
  type PalaisRoseRoomConfig,
} from "@/config/palaisRosePresets";
import { PALAIS_ROSE_CHARACTER_ANCHORS } from "@/config/palaisRoseAnchors";

interface PalaisRoseEstateSelectorProps {
  onCompiledPromptChange?: (prompt: string) => void;
}

export function PalaisRoseEstateSelector({
  onCompiledPromptChange,
}: PalaisRoseEstateSelectorProps) {
  const [selectedRoom, setSelectedRoom] = useState<PalaisRoseRoomConfig | null>(
    null,
  );

  const prompt = selectedRoom
    ? compilePalaisRoseRoomPrompt(selectedRoom)
    : compilePalaisRoseExteriorPrompt();

  return (
    <div className="space-y-3 rounded-xl border border-pink-500/30 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold tracking-wider text-pink-300 uppercase">
          Palais Rose Estate Rooms
        </label>
        <span className="font-mono text-[10px] text-pink-300">
          {PALAIS_ROSE_EXTERIOR_PRESET.facadeStyle}
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          setSelectedRoom(null);
          onCompiledPromptChange?.(compilePalaisRoseExteriorPrompt());
        }}
        className={`w-full rounded-lg border p-3 text-left text-xs transition ${
          selectedRoom == null
            ? "border-pink-400 bg-pink-500/10 text-white"
            : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
        }`}
      >
        <div className="font-bold">Exterior — Grand Trianon</div>
        <div className="mt-1 text-[11px] text-slate-400">
          {PALAIS_ROSE_EXTERIOR_PRESET.primaryMaterial}
        </div>
      </button>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {PALAIS_ROSE_INTERIOR_ROOMS.map((room) => (
          <button
            key={room.roomName}
            type="button"
            onClick={() => {
              setSelectedRoom(room);
              onCompiledPromptChange?.(compilePalaisRoseRoomPrompt(room));
            }}
            className={`rounded-lg border p-3 text-left text-xs transition ${
              selectedRoom?.roomName === room.roomName
                ? "border-pink-400 bg-pink-500/10 text-white"
                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="font-bold text-slate-200">{room.roomName}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {room.architecturalStyle}
            </div>
          </button>
        ))}
      </div>

      <p className="rounded-lg border border-slate-800/80 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
        {prompt}
      </p>

      <div className="space-y-2">
        <label className="text-[10px] font-bold tracking-wider text-pink-300 uppercase">
          Character Multiplane Anchors
        </label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PALAIS_ROSE_CHARACTER_ANCHORS.map((anchor) => (
            <div
              key={anchor.anchorId}
              className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-400"
            >
              <div className="font-semibold text-slate-200">{anchor.locationName}</div>
              <div className="mt-1 font-mono text-[10px]">
                z={anchor.depthZ} · scale={anchor.recommendedScale} · max=
                {anchor.maxCharactersAllowed}
              </div>
              <div
                className="mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-950"
                style={{ backgroundColor: anchor.ambientTintHex }}
              >
                {anchor.ambientTintHex}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
