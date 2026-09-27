"use client";

import React, { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import type { SponsorCampaign } from "../ads/sponsorCampaigns";
import { AdRevenueLedger } from "../monetization/adRevenueLedger";

export const WorfiAdIntelligenceDashboard: React.FC = () => {
  const [campaigns, setCampaigns] = useState<SponsorCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/sponsors/campaigns")
      .then((res) => res.json())
      .then((data: { success?: boolean; campaigns?: SponsorCampaign[] }) => {
        if (!cancelled && data.success && data.campaigns) {
          setCampaigns(data.campaigns);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Yield store unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sampleSplit = AdRevenueLedger.processSplit({
    impressionId: "imp-demo",
    channelId: "ch-atx-01",
    assetId: "preroll",
    creatorId: "worfi-network",
    cpmRateUSD: 20,
    impressionCount: 1000,
    timestamp: new Date(),
  });

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spentBudget, 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + c.totalBudget, 0);

  return (
    <div className="w-full max-w-6xl space-y-8">
      <div className="text-center sm:text-left">
        <p className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
          Ad & Yield Analytics
        </p>
        <h2 className="text-2xl font-black text-white">
          Campaign Intelligence
        </h2>
        <p className="text-xs text-slate-400">
          CPM ledger, budget burn, and 50/50 creator split.
        </p>
      </div>

      <GlassCard
        title="System Active"
        subtitle="Real-time ledger pipeline"
      />

      {error ? (
        <p className="text-xs text-amber-400" role="status">
          {error}. Showing in-memory yield until Postgres is online.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <YieldStat label="Booked Budget" value={`$${totalBudget.toFixed(2)}`} />
        <YieldStat label="Spent" value={`$${totalSpend.toFixed(2)}`} />
        <YieldStat
          label="Sample 50/50 Split"
          value={`$${sampleSplit.creatorShare.toFixed(2)} creator`}
        />
      </div>

      <section className="rounded-xl border border-emerald-900/50 bg-slate-900/60 p-5">
        <h3 className="mb-4 text-sm font-bold text-emerald-400">
          ACTIVE CAMPAIGNS
        </h3>
        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-500">
            No sponsor campaigns yet. Provision one from Sponsor Onboarding.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="pb-2">Advertiser</th>
                <th className="pb-2">Campaign</th>
                <th className="pb-2">CPM</th>
                <th className="pb-2">Budget</th>
                <th className="pb-2">Spent</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="py-2">{c.advertiserName}</td>
                  <td>{c.campaignName}</td>
                  <td>${c.cpmRate.toFixed(2)}</td>
                  <td>${c.totalBudget.toFixed(2)}</td>
                  <td>${c.spentBudget.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

function YieldStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-emerald-900/40 bg-slate-900/70 p-4">
      <div className="text-[10px] tracking-wider text-slate-500 uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-white">{value}</div>
    </div>
  );
}
