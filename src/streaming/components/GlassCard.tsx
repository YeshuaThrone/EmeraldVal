"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";
import { STREAMING_ROUTE } from "@/lib/routes";

export interface GlassCardProps {
  title?: string;
  subtitle?: string;
  href?: string;
}

export default function GlassCard({
  title = "System Active",
  subtitle = "Real-time ledger pipeline",
  href = STREAMING_ROUTE,
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="relative mx-auto w-full max-w-xl p-1 font-sans">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 p-[1px] shadow-2xl transition-all duration-300 hover:border-neutral-700/60"
      >
        <div
          className={`pointer-events-none absolute -inset-px transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.1) 40%, transparent 80%)`,
          }}
        />

        <div
          className={`pointer-events-none absolute -inset-px transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
          style={{
            background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, rgba(168, 85, 247, 0.4), transparent 80%)`,
          }}
        />

        <div className="relative rounded-[15px] bg-neutral-950/90 p-6 backdrop-blur-xl sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 rounded-[15px] opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(#fff 1px, transparent 1px)`,
              backgroundSize: `16px 16px`,
            }}
          />

          <div className="relative z-10 mb-6 flex items-center justify-between border-b border-neutral-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </div>
              <span className="font-mono text-xs tracking-widest text-neutral-400 uppercase">
                {title}
              </span>
            </div>

            <span className="rounded-full border border-emerald-800/50 bg-emerald-950/50 px-2.5 py-1 font-mono text-[11px] text-emerald-400">
              v2.4.0
            </span>
          </div>

          <div className="relative z-10 space-y-4">
            <h3 className="text-xl font-medium tracking-tight text-neutral-100 sm:text-2xl">
              High-Velocity Data Streaming
            </h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {subtitle}. Designed with modern dark-mode dynamics, instant
              responsiveness, and fine optical feedback.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/50 p-3.5">
                <div className="font-mono text-[11px] text-neutral-500">
                  LATENCY
                </div>
                <div className="mt-0.5 text-lg font-semibold text-neutral-200">
                  12ms
                </div>
              </div>
              <div className="rounded-lg border border-neutral-800/60 bg-neutral-900/50 p-3.5">
                <div className="font-mono text-[11px] text-neutral-500">
                  THROUGHPUT
                </div>
                <div className="mt-0.5 text-lg font-semibold text-neutral-200">
                  99.98%
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 pt-2">
            <Link
              href={href}
              className="group/btn relative flex w-full overflow-hidden rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-950 transition-all duration-200 hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-[0.99]"
            >
              <span className="relative z-10 flex w-full items-center justify-center gap-2">
                Launch Environment
                <svg
                  className="h-4 w-4 transition-transform group-hover/btn:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
