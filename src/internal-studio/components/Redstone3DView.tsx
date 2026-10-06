"use client";

import React, { useEffect, useRef } from "react";
import { Redstone3DRenderer } from "@/config/minecraft/redstone3DRenderer";

export function Redstone3DView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let renderer: Redstone3DRenderer | null = null;
    let cancelled = false;
    const observer = new ResizeObserver(() => {
      if (cancelled || renderer || el.clientWidth < 2 || el.clientHeight < 2) return;
      renderer = new Redstone3DRenderer(el, { wsUrl: "ws://127.0.0.1:8080" });
    });
    observer.observe(el);
    if (el.clientWidth >= 2 && el.clientHeight >= 2) {
      renderer = new Redstone3DRenderer(el, { wsUrl: "ws://127.0.0.1:8080" });
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      renderer?.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: "100dvh", background: "#1a1a1a" }}
    />
  );
}
