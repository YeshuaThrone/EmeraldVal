"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JobProgressPayload, PipelineStage, ShotCard } from "@/sdk/studio-engine";
import type { MetaHumanAsset } from "@/lib/MetaHumanRegistry";
import { StudioHlsPreview } from "./StudioHlsPreview";

const STAGES: PipelineStage[] = [
  "QUEUED",
  "AUDIO_ALIGNMENT",
  "MOTION_DISPATCH",
  "LIP_SYNC_GENERATION",
  "FFMPEG_STITCHING",
  "HLS_PACKAGING",
  "EPG_PUBLISHED",
];

const DEFAULT_SCRIPT = `PRIMARY: They think they can hold the city.
SECONDARY: Let them try. The throne belongs to us now.`;

function previewSrc(hlsMasterUrl?: string): string | null {
  if (!hlsMasterUrl) return null;
  if (hlsMasterUrl.startsWith("/api/")) return hlsMasterUrl;
  const parts = hlsMasterUrl.split(/[/\\]/);
  const hlsAt = parts.lastIndexOf("hls");
  if (hlsAt <= 0) return null;
  return `/api/internal-studio/media/${parts.slice(hlsAt - 1).join("/")}`;
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
      const line = chunk.split("\n").find((part) => part.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6)) as JobProgressPayload;
      if (payload.stage) onEvent(payload);
    }
  }
}

interface StaffSession {
  email: string;
  role: string;
}

interface HistoryJob {
  queueJobId: string | null;
  episodeId: string | null;
  status: string;
  hlsMasterUrl: string | null;
  requestedBy: string | null;
  createdAt: string;
}

export function StudioPipelineConsole() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [email, setEmail] = useState("3bbullion@gmail.com");
  const [staffKey, setStaffKey] = useState("");
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [episodeId, setEpisodeId] = useState("ep_01");
  const [showId, setShowId] = useState("wurfi_internal");
  const [audioPath, setAudioPath] = useState("/tmp/internal-studio/ep_01/master.wav");
  const [primaryHost, setPrimaryHost] = useState("HOST_01");
  const [secondaryHost, setSecondaryHost] = useState("GUEST_01");
  const [metahumans, setMetahumans] = useState<MetaHumanAsset[]>([]);
  const [shotCards, setShotCards] = useState<ShotCard[]>([]);
  const [compiledPrompt, setCompiledPrompt] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<JobProgressPayload | null>(null);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [ue5Note, setUe5Note] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activeStage = status?.stage ?? "QUEUED";
  const preview = previewSrc(status?.hlsMasterUrl);

  const loadDesk = useCallback(async () => {
    const [ue5, jobs] = await Promise.all([
      fetch("/api/internal-studio/ue5", { credentials: "include" }),
      fetch("/api/internal-studio/render-jobs", { credentials: "include" }),
    ]);
    if (ue5.ok) {
      const json = (await ue5.json()) as {
        metahumans?: MetaHumanAsset[];
        doctor?: { note?: string; ready?: boolean };
      };
      setMetahumans(json.metahumans ?? []);
      setUe5Note(json.doctor?.note ?? "");
    }
    if (jobs.ok) {
      const json = (await jobs.json()) as { jobs?: HistoryJob[] };
      setHistory(json.jobs ?? []);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/internal-studio/session", {
        credentials: "include",
      });
      if (!response.ok) return;
      const json = (await response.json()) as StaffSession;
      setSession({ email: json.email, role: json.role });
      await loadDesk();
    })();
  }, [loadDesk]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/internal-studio/session", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, key: staffKey }),
    });
    const json = (await response.json()) as StaffSession & { error?: string };
    if (!response.ok) {
      setError(json.error || "Login failed");
      return;
    }
    setSession({ email: json.email, role: json.role });
    setStaffKey("");
    await loadDesk();
  }

  async function logout() {
    await fetch("/api/internal-studio/session", {
      method: "DELETE",
      credentials: "include",
    });
    setSession(null);
  }

  async function onScriptFile(file: File | null) {
    if (!file) return;
    setScript(await file.text());
  }

  async function constructScene(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/internal-studio/compile", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: episodeId,
          script,
          primaryHost,
          secondaryHost,
        }),
      });
      const json = (await response.json()) as {
        shotCards?: ShotCard[];
        prompt?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error || "Compile failed");
      }
      setShotCards(json.shotCards ?? []);
      setCompiledPrompt(json.prompt ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compile failed");
    } finally {
      setBusy(false);
    }
  }

  async function enqueueRender(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const cards =
        shotCards.length > 0
          ? shotCards
          : [
              {
                shotId: "shot_01",
                speakerId: primaryHost,
                dialogueText: script.split("\n")[0] || "Hold.",
                characterModelId: primaryHost,
                motionPrompt: "cinematic hold",
              },
            ];
      const response = await fetch("/api/internal-studio/pipeline", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          episodeId,
          showId,
          rodecasterAudioPath: audioPath,
          shotCards: cards,
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
        { credentials: "include" },
      );
      if (!stream.ok) {
        throw new Error(`Status stream failed (${stream.status})`);
      }
      await readSsePayloads(stream, setStatus);
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enqueue failed");
    } finally {
      setBusy(false);
    }
  }

  const progressLabel = useMemo(() => {
    if (!status) return "Idle";
    return `${status.stage} (${status.progressPercent}%)`;
  }, [status]);

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
        <form
          onSubmit={login}
          className="mx-auto grid max-w-md gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            AnimationStudioOS · staff
          </p>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <label className="grid gap-1 text-sm">
            Email
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
          <button
            type="submit"
            className="mt-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950"
          >
            Open studio
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <header className="mb-8 flex max-w-5xl items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            AnimationStudioOS · {session.role}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Studio desk</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Paste or upload a script to build shot cards, pick MetaHumans, enqueue
            a render, and preview HLS here. This never publishes to the public
            WURFI player.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-400"
        >
          {session.email} · sign out
        </button>
      </header>

      <ol className="mb-8 flex max-w-5xl flex-wrap gap-2 text-xs">
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

      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <form
          onSubmit={constructScene}
          className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
        >
          <h2 className="font-medium">1. Script → scene</h2>
          <textarea
            className="min-h-36 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
            value={script}
            onChange={(event) => setScript(event.target.value)}
          />
          <label className="text-xs text-zinc-500">
            Upload .txt
            <input
              className="mt-1 block text-sm"
              type="file"
              accept=".txt,text/plain"
              onChange={(event) => void onScriptFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm">
              Primary
              <select
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2"
                value={primaryHost}
                onChange={(event) => setPrimaryHost(event.target.value)}
              >
                {metahumans.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id} · {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Secondary
              <select
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2"
                value={secondaryHost}
                onChange={(event) => setSecondaryHost(event.target.value)}
              >
                {metahumans.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id} · {asset.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            Construct shot cards
          </button>
          {shotCards.length > 0 ? (
            <p className="text-xs text-zinc-500">
              {shotCards.length} shot card{shotCards.length === 1 ? "" : "s"} ready
            </p>
          ) : null}
        </form>

        <form
          onSubmit={enqueueRender}
          className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
        >
          <h2 className="font-medium">2. Queue render</h2>
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
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Running…" : "Enqueue render"}
          </button>
          <p className="text-xs text-zinc-500">{ue5Note}</p>
        </form>
      </div>

      <section className="mt-8 max-w-5xl rounded-xl border border-zinc-800 p-5">
        <p className="text-sm text-zinc-400">{progressLabel}</p>
        {jobId ? (
          <p className="mt-2 font-mono text-xs text-zinc-500">jobId {jobId}</p>
        ) : null}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${status?.progressPercent ?? 0}%` }}
          />
        </div>
        <div className="mt-4">
          <StudioHlsPreview src={preview} />
        </div>
        {compiledPrompt ? (
          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-zinc-500">
            {compiledPrompt}
          </pre>
        ) : null}
        {error ? <p className="mt-3 text-red-400">{error}</p> : null}
      </section>

      {history.length > 0 ? (
        <section className="mt-8 max-w-5xl text-sm">
          <h2 className="mb-3 font-medium">Job history</h2>
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {history.map((job) => (
              <li key={`${job.queueJobId}-${job.createdAt}`} className="px-4 py-3">
                <span className="font-mono text-xs text-zinc-500">
                  {job.queueJobId || "unqueued"}
                </span>
                <span className="ml-3 text-zinc-300">{job.status}</span>
                {job.episodeId ? (
                  <span className="ml-3 text-zinc-500">{job.episodeId}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
