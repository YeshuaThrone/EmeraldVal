"use client";

import { useMemo, useState } from "react";
import type { JobProgressPayload, PipelineStage, ShotCard } from "@/sdk/studio-engine";

const STAGES: PipelineStage[] = [
  "QUEUED",
  "AUDIO_ALIGNMENT",
  "MOTION_DISPATCH",
  "LIP_SYNC_GENERATION",
  "FFMPEG_STITCHING",
  "HLS_PACKAGING",
  "EPG_PUBLISHED",
];

function staffHeaders(email: string, key: string): HeadersInit {
  return {
    "content-type": "application/json",
    "x-studio-staff-email": email.trim(),
    "x-studio-staff-key": key,
  };
}

async function readSsePayloads(
  response: Response,
  onEvent: (payload: JobProgressPayload) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((part) => part.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6)) as JobProgressPayload & {
        status?: string;
      };
      if (payload.stage) onEvent(payload);
    }
  }
}

const defaultShotCards: ShotCard[] = [
  {
    shotId: "shot_01",
    speakerId: "hero_01",
    dialogueText: "They think they can hold the city.",
    characterModelId: "hero_01",
    motionPrompt: "cinematic push-in, graphic novel lighting",
  },
];

export function StudioPipelineConsole() {
  const [email, setEmail] = useState("3bbullion@gmail.com");
  const [staffKey, setStaffKey] = useState("");
  const [episodeId, setEpisodeId] = useState("ep_01");
  const [showId, setShowId] = useState("wurfi_internal");
  const [audioPath, setAudioPath] = useState(
    "/tmp/internal-studio/ep_01/master.wav",
  );
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<JobProgressPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activeStage = status?.stage ?? "QUEUED";

  const progressLabel = useMemo(() => {
    if (!status) return "Idle — enqueue a staff render";
    return `${status.stage} (${status.progressPercent}%)`;
  }, [status]);

  async function enqueueRender(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/internal-studio/pipeline", {
        method: "POST",
        headers: staffHeaders(email, staffKey),
        body: JSON.stringify({
          episodeId,
          showId,
          rodecasterAudioPath: audioPath,
          shotCards: defaultShotCards,
          targetFps: 29.97,
        }),
      });
      const json = (await response.json()) as {
        jobId?: string;
        streamUrl?: string;
        error?: string;
        details?: string;
      };
      if (!response.ok || !json.jobId) {
        throw new Error(json.details || json.error || `Enqueue failed (${response.status})`);
      }
      setJobId(json.jobId);
      setStatus({
        jobId: json.jobId,
        episodeId,
        stage: "QUEUED",
        progressPercent: 0,
      });
      const stream = await fetch(
        json.streamUrl || `/api/internal-studio/pipeline?jobId=${json.jobId}`,
        { headers: staffHeaders(email, staffKey) },
      );
      if (!stream.ok) {
        throw new Error(`Status stream failed (${stream.status})`);
      }
      await readSsePayloads(stream, setStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enqueue failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <header className="mb-8 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          AnimationStudioOS · staff only
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Studio pipeline console</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enqueue a BullMQ render, then watch Whisper, SeeDance, lip-sync, and
          FFmpeg/HLS stages over SSE. This page does not publish to the public
          WURFI player.
        </p>
      </header>

      <ol className="mb-8 flex flex-wrap gap-2 text-xs">
        {STAGES.map((stage) => (
          <li
            key={stage}
            className={`rounded-full border px-3 py-1 ${
              stage === activeStage
                ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                : "border-zinc-800 text-zinc-500"
            }`}
          >
            {stage.replaceAll("_", " ")}
          </li>
        ))}
      </ol>

      <form
        onSubmit={enqueueRender}
        className="grid max-w-3xl gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
      >
        <label className="grid gap-1 text-sm">
          Staff email
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Staff key
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
            type="password"
            value={staffKey}
            onChange={(event) => setStaffKey(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Episode ID
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={episodeId}
            onChange={(event) => setEpisodeId(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Show ID
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={showId}
            onChange={(event) => setShowId(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Rodecaster audio path
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={audioPath}
            onChange={(event) => setAudioPath(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          {busy ? "Running…" : "Enqueue render"}
        </button>
      </form>

      <section className="mt-8 max-w-3xl rounded-xl border border-zinc-800 p-5 text-sm">
        <p className="text-zinc-400">{progressLabel}</p>
        {jobId ? (
          <p className="mt-2 font-mono text-xs text-zinc-500">jobId {jobId}</p>
        ) : null}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${status?.progressPercent ?? 0}%` }}
          />
        </div>
        {status?.hlsMasterUrl ? (
          <p className="mt-3 break-all font-mono text-xs text-emerald-200">
            {status.hlsMasterUrl}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-red-400">{error}</p> : null}
      </section>
    </div>
  );
}
