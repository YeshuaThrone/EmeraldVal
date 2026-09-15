"use client";

import React, { useState } from "react";
import { WorfiPlayerView } from "../player/WorfiPlayerView";
import { AdminLineupManager } from "../admin/AdminLineupManager";
import { WorfiAdIntelligenceDashboard } from "../analytics/WorfiAdIntelligenceDashboard";
import { WorfiSponsorPortal } from "../ads/WorfiSponsorPortal";

export type ActiveTab =
  | "PLAYER"
  | "ADMIN"
  | "ANALYTICS"
  | "SPONSOR_ONBOARDING";

export const WorfiAppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("PLAYER");

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-950 p-4 font-mono text-slate-100 sm:p-8">
      <header className="mb-8 flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-b border-blue-900/50 pb-6 sm:flex-row">
        <div>
          <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-yellow-400 uppercase">
            AUSTIN CABLE BROADCAST
          </span>
          <h1 className="mt-1 text-3xl font-black tracking-wider text-white">
            WORFI <span className="text-yellow-400">NETWORK</span>
          </h1>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("PLAYER")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === "PLAYER"
                ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                : "border border-blue-900/80 bg-slate-900 text-slate-300 hover:border-yellow-500/50"
            }`}
          >
            Network Player
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ADMIN")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === "ADMIN"
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "border border-blue-900/80 bg-slate-900 text-slate-300 hover:border-blue-500/50"
            }`}
          >
            Control Workspace
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ANALYTICS")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === "ANALYTICS"
                ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                : "border border-blue-900/80 bg-slate-900 text-slate-300 hover:border-emerald-500/50"
            }`}
          >
            Ad & Yield Analytics
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SPONSOR_ONBOARDING")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === "SPONSOR_ONBOARDING"
                ? "bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                : "border border-blue-900/80 bg-slate-900 text-slate-300 hover:border-yellow-400/50"
            }`}
          >
            Sponsor Onboarding
          </button>
        </nav>
      </header>

      <main className="flex w-full justify-center">
        {activeTab === "PLAYER" && <WorfiPlayerView />}
        {activeTab === "ADMIN" && <AdminLineupManager />}
        {activeTab === "ANALYTICS" && <WorfiAdIntelligenceDashboard />}
        {activeTab === "SPONSOR_ONBOARDING" && <WorfiSponsorPortal />}
      </main>
    </div>
  );
};
