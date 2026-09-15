"use client";

import React, { useState } from "react";

export const WorfiSponsorPortal: React.FC = () => {
  const [advertiserName, setAdvertiserName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [cpmRate, setCpmRate] = useState(20);
  const [totalBudget, setTotalBudget] = useState(5000);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/v1/sponsors/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiserName,
          campaignName,
          cpmRate,
          totalBudget,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        campaign?: { id: string };
      };
      if (data.success) {
        setStatusMsg(`Campaign booked (${data.campaign?.id ?? "ok"}).`);
        setCampaignName("");
      } else {
        setStatusMsg(data.error || "Failed to book campaign.");
      }
    } catch {
      setStatusMsg("Error connecting to sponsor API.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-yellow-500/30 bg-slate-950 p-6 font-mono text-slate-100 shadow-2xl">
      <div className="mb-6 border-b border-yellow-500/20 pb-4">
        <p className="text-[10px] font-bold tracking-widest text-yellow-400 uppercase">
          Sponsor Onboarding
        </p>
        <h2 className="text-2xl font-black text-white">Book a WORFI Buy</h2>
        <p className="mt-1 text-xs text-slate-400">
          Local advertisers provision CPM campaigns onto the linear grid.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold text-slate-400">
            ADVERTISER
          </span>
          <input
            required
            value={advertiserName}
            onChange={(e) => setAdvertiserName(e.target.value)}
            placeholder="e.g. Rainey Street Brewing"
            className="w-full rounded border border-yellow-500/20 bg-slate-900 px-3 py-2 text-xs text-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold text-slate-400">
            CAMPAIGN NAME
          </span>
          <input
            required
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g. Summer Patio Flight"
            className="w-full rounded border border-yellow-500/20 bg-slate-900 px-3 py-2 text-xs text-white"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold text-slate-400">
              CPM RATE (USD)
            </span>
            <input
              type="number"
              min={1}
              step="0.01"
              required
              value={cpmRate}
              onChange={(e) => setCpmRate(Number(e.target.value))}
              className="w-full rounded border border-yellow-500/20 bg-slate-900 px-3 py-2 text-xs font-bold text-yellow-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold text-slate-400">
              TOTAL BUDGET
            </span>
            <input
              type="number"
              min={1}
              step="0.01"
              required
              value={totalBudget}
              onChange={(e) => setTotalBudget(Number(e.target.value))}
              className="w-full rounded border border-yellow-500/20 bg-slate-900 px-3 py-2 text-xs font-bold text-yellow-400"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-yellow-400 py-2.5 text-xs font-extrabold tracking-wider text-black uppercase hover:bg-yellow-300 disabled:opacity-50"
        >
          {pending ? "BOOKING…" : "PROVISION CAMPAIGN"}
        </button>
      </form>

      {statusMsg ? (
        <div className="mt-4 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
          {statusMsg}
        </div>
      ) : null}
    </div>
  );
};
