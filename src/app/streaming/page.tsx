"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RetroCablePlayer } from "@/streaming/components/RetroCablePlayer";
import { RetroTVGuide } from "@/streaming/components/RetroTVGuide";
import { cloneChannelPresets } from "@/streaming/config/channelPresets";
import { MultiChannelEngine } from "@/streaming/playout/multiChannelEngine";
import {
  STREAMING_ADMIN_ROUTE,
  STREAMING_ONBOARD_ROUTE,
} from "@/lib/routes";

export default function StreamingPage() {
  const engine = useMemo(() => {
    const next = new MultiChannelEngine();
    for (const channel of cloneChannelPresets()) {
      next.registerChannel(channel);
    }
    return next;
  }, []);
  const [channelId, setChannelId] = useState("ch-haven");

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-8">
      <header className="flex w-full flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-yellow-400 uppercase">
            Austin Cable Broadcast
          </p>
          <h1 className="text-2xl font-black text-white">Network Player</h1>
        </div>
        <nav className="flex gap-2 text-xs font-bold">
          <Link
            href={STREAMING_ADMIN_ROUTE}
            className="rounded border border-indigo-500 bg-indigo-900/60 px-3 py-1.5 text-indigo-100"
          >
            Control Workspace
          </Link>
          <Link
            href={STREAMING_ONBOARD_ROUTE}
            className="rounded border border-yellow-500 bg-yellow-600/80 px-3 py-1.5 text-black"
          >
            Creator Onboarding
          </Link>
        </nav>
      </header>
      <RetroCablePlayer
        key={channelId}
        engine={engine}
        initialChannelId={channelId}
      />
      <RetroTVGuide engine={engine} onSelectChannel={setChannelId} />
    </div>
  );
}
