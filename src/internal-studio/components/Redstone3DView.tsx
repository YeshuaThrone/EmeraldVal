"use client";

import React, { useEffect, useRef } from "react";
import { Redstone3DRenderer } from "@/config/minecraft/redstone3DRenderer";

export function Redstone3DView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const renderer = new Redstone3DRenderer(el);
    return () => renderer.destroy();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: "100dvh", background: "#1a1a1a" }}
    />
  );
}
