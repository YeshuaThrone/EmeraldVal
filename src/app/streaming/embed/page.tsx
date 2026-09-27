"use client";

import React, { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { RetroPlayerContainer } from "@/streaming/components/RetroPlayerContainer";
import { cloneChannelPresets } from "@/streaming/config/channelPresets";
import { MultiChannelEngine } from "@/streaming/playout/multiChannelEngine";

function EmbedPlayerInner() {
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channelId") || undefined;

  const engine = useMemo(
    () => new MultiChannelEngine(cloneChannelPresets()),
    [],
  );

  return (
    <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
      <RetroPlayerContainer engine={engine} initialChannelId={channelId} />
    </main>
  );
}

export default function EmbedPlayerPage() {
  return (
    <Suspense fallback={<main className="h-screen w-full bg-black" />}>
      <EmbedPlayerInner />
    </Suspense>
  );
}
