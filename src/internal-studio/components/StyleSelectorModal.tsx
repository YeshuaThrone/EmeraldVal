"use client";

import React, { useState } from "react";
import {
  ANIMATION_STYLE_PRESETS,
  type AnimationStyleType,
} from "@/config/animationStyles";

interface StyleSelectorModalProps {
  shotId: string;
  projectId: string;
  onSuccess?: () => void;
}

export function StyleSelectorModal({
  shotId,
  projectId,
  onSuccess,
}: StyleSelectorModalProps) {
  const [selectedStyle, setSelectedStyle] =
    useState<AnimationStyleType>("golden_age_cel");
  const [scriptText, setScriptText] = useState("");
  const [characterSheetUrl, setCharacterSheetUrl] = useState("");
  const [startingFrameUrl, setStartingFrameUrl] = useState("");
  const [cameraMotionVideoUrl, setCameraMotionVideoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("Dispatching styled 3D shot...");

    try {
      const token = localStorage.getItem("supabase_auth_token") || "";
      const res = await fetch("/api/generate-styled-shot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shotId,
          projectId,
          styleType: selectedStyle,
          scriptText,
          characterSheetUrl,
          startingFrameUrl,
          cameraMotionVideoUrl,
        }),
      });

      const data = (await res.json()) as { error?: string; styleApplied?: string };
      if (!res.ok) throw new Error(data.error);

      setStatus(`Queued! Style: ${data.styleApplied}`);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to queue styled shot";
      setStatus(`Error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white">
      <h2 className="mb-4 text-xl font-bold text-emerald-400">
        Select Animation Style & Render
      </h2>

      <div className="mb-6 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
        {Object.values(ANIMATION_STYLE_PRESETS).map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => setSelectedStyle(style.id)}
            className={`rounded-lg border p-3 text-left text-xs transition ${
              selectedStyle === style.id
                ? "border-emerald-500 bg-emerald-950/50 text-white"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="text-sm font-bold text-slate-200">{style.name}</div>
            <div className="text-[10px] text-slate-500">{style.era}</div>
          </button>
        ))}
      </div>

      <form onSubmit={handleGenerate} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">
            Scene Action
          </label>
          <input
            type="text"
            required
            className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm text-white"
            placeholder="Character turns toward camera while dancing..."
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <input
            type="url"
            required
            placeholder="Character Sheet URL"
            className="rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white"
            value={characterSheetUrl}
            onChange={(e) => setCharacterSheetUrl(e.target.value)}
          />
          <input
            type="url"
            required
            placeholder="Starting Frame URL"
            className="rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white"
            value={startingFrameUrl}
            onChange={(e) => setStartingFrameUrl(e.target.value)}
          />
          <input
            type="url"
            required
            placeholder="3D Camera Video URL"
            className="rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white"
            value={cameraMotionVideoUrl}
            onChange={(e) => setCameraMotionVideoUrl(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {isSubmitting
            ? "Processing..."
            : `Render Shot with ${ANIMATION_STYLE_PRESETS[selectedStyle].name}`}
        </button>

        {status ? (
          <p className="text-center text-xs text-slate-300">{status}</p>
        ) : null}
      </form>
    </div>
  );
}
