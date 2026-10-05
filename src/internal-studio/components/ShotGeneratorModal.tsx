"use client";

import React, { useState } from "react";

interface ShotGeneratorProps {
  shotId: string;
  projectId: string;
  onSuccess?: () => void;
}

export function ShotGeneratorModal({
  shotId,
  projectId,
  onSuccess,
}: ShotGeneratorProps) {
  const [scriptText, setScriptText] = useState("");
  const [characterSheetUrl, setCharacterSheetUrl] = useState("");
  const [startingFrameUrl, setStartingFrameUrl] = useState("");
  const [cameraMotionVideoUrl, setCameraMotionVideoUrl] = useState("");
  const [propReferenceUrl, setPropReferenceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleTriggerGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage("Dispatching 3D vector parameters to SeeDance...");

    try {
      const token = localStorage.getItem("supabase_auth_token") || "";

      const res = await fetch("/api/generate-shot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shotId,
          projectId,
          scriptText,
          characterSheetUrl,
          startingFrameUrl,
          cameraMotionVideoUrl,
          propReferenceUrl: propReferenceUrl || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch generation request");
      }

      setStatusMessage("Shot queued successfully! Monitoring webhook feed...");
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to dispatch generation request";
      setStatusMessage(`Error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-white">
      <h3 className="mb-4 text-xl font-bold text-emerald-400">
        Studio OS: Trigger 3D Conditioned Shot
      </h3>

      <form onSubmit={handleTriggerGeneration} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">
            Action / Scene Description
          </label>
          <textarea
            required
            rows={2}
            className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            placeholder="Tailor sewing costume while camera orbits steady..."
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">
              Character Sheet URL
            </label>
            <input
              type="url"
              required
              className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm text-white"
              placeholder="https://..."
              value={characterSheetUrl}
              onChange={(e) => setCharacterSheetUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">
              Starting Frame URL
            </label>
            <input
              type="url"
              required
              className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm text-white"
              placeholder="https://..."
              value={startingFrameUrl}
              onChange={(e) => setStartingFrameUrl(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">
            3D Stage Camera Motion Recording (.mp4)
          </label>
          <input
            type="url"
            required
            className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm text-white"
            placeholder="Recorded 3D orbit video URL..."
            value={cameraMotionVideoUrl}
            onChange={(e) => setCameraMotionVideoUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase">
            Prop Reference URL (Optional)
          </label>
          <input
            type="url"
            className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm text-white"
            placeholder="Garment or object structure URL..."
            value={propReferenceUrl}
            onChange={(e) => setPropReferenceUrl(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {isSubmitting ? "Dispatching to SeeDance..." : "Queue Shot for Rendering"}
        </button>

        {statusMessage ? (
          <p className="mt-2 text-center text-xs text-slate-300">{statusMessage}</p>
        ) : null}
      </form>
    </div>
  );
}
