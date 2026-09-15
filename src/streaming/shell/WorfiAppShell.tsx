"use client";

import React, { useEffect, useState } from "react";
import { WorfiPlayerView } from "../player/WorfiPlayerView";
import { AdminLineupManager } from "../admin/AdminLineupManager";
import { WorfiAdIntelligenceDashboard } from "../analytics/WorfiAdIntelligenceDashboard";
import { WorfiSponsorPortal } from "../ads/WorfiSponsorPortal";

export type ActiveTab =
  | "PLAYER"
  | "ADMIN"
  | "ANALYTICS"
  | "SPONSOR_ONBOARDING";

function formatAustinClock(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now);
}

const navBtn = (active: boolean) =>
  `px-4 py-1.5 rounded border-2 transition ${
    active
      ? "bg-yellow-400 border-yellow-300 text-blue-950 shadow-[2px_2px_0px_#000]"
      : "bg-blue-900/60 border-blue-600 text-blue-100 hover:bg-blue-800"
  }`;

export const WorfiAppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("PLAYER");
  const [clock, setClock] = useState("08:33 PM CDT");

  useEffect(() => {
    const tick = () => setClock(formatAustinClock(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="font-epg flex min-h-screen select-none flex-col items-center bg-[#070b19] p-4 text-white sm:p-8">
      <header className="mb-6 flex w-full max-w-6xl flex-col items-center justify-between rounded-t-xl border-t border-r border-l border-blue-500/40 border-b-2 border-b-blue-600/60 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 p-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="rounded bg-yellow-400 px-2.5 py-0.5 text-xs font-black tracking-wider text-blue-950 shadow-[1px_1px_0px_#000]">
            DIRECT-CABLE
          </div>
          <h1 className="text-3xl font-black tracking-widest text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.9)]">
            WORFI <span className="text-yellow-400">NETWORK</span>
          </h1>
        </div>

        <nav className="font-epg mt-4 flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider uppercase sm:mt-0">
          <button
            type="button"
            onClick={() => setActiveTab("PLAYER")}
            className={navBtn(activeTab === "PLAYER")}
          >
            Network Player
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ADMIN")}
            className={navBtn(activeTab === "ADMIN")}
          >
            Control Workspace
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ANALYTICS")}
            className={navBtn(activeTab === "ANALYTICS")}
          >
            Ad & Yield Data
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SPONSOR_ONBOARDING")}
            className={navBtn(activeTab === "SPONSOR_ONBOARDING")}
          >
            Sponsor Onboarding
          </button>
        </nav>
      </header>

      <div className="w-full max-w-6xl rounded-b-xl border-2 border-blue-600 bg-[#0a1128] p-4 shadow-[0_0_30px_rgba(0,50,150,0.3)]">
        <div className="mb-4 flex items-center justify-between rounded border border-blue-500/80 bg-blue-900/80 p-3 text-xs font-bold tracking-wider text-yellow-300">
          <span className="font-osd text-lg tracking-widest text-yellow-400">
            CH 01 • WORFI MAIN BROADCAST
          </span>
          <span className="font-osd rounded border border-blue-700 bg-blue-950 px-3 py-1 text-base text-white">
            {clock}
          </span>
        </div>

        <main className="flex w-full justify-center">
          {activeTab === "PLAYER" && <WorfiPlayerView />}
          {activeTab === "ADMIN" && <AdminLineupManager />}
          {activeTab === "ANALYTICS" && <WorfiAdIntelligenceDashboard />}
          {activeTab === "SPONSOR_ONBOARDING" && <WorfiSponsorPortal />}
        </main>
      </div>
    </div>
  );
};
