"use client";

import React, { useEffect, useState } from "react";

export interface NetworkAnalyticsSummary {
  totalWatchSeconds: number;
  uniqueViewers: number;
  channelSwitches: number;
  byChannel: Array<{
    channelId: string;
    watchSeconds: number;
    views: number;
  }>;
  bySegment: Array<{
    segmentId: string;
    watchSeconds: number;
    views: number;
  }>;
}

const EMPTY_SUMMARY: NetworkAnalyticsSummary = {
  totalWatchSeconds: 0,
  uniqueViewers: 0,
  channelSwitches: 0,
  byChannel: [],
  bySegment: [],
};

export const NetworkAnalyticsDashboard: React.FC = () => {
  const [summary, setSummary] = useState<NetworkAnalyticsSummary>(EMPTY_SUMMARY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/streaming/analytics");
        if (!response.ok) {
          throw new Error("Analytics store unavailable");
        }
        const payload = (await response.json()) as {
          summary?: NetworkAnalyticsSummary;
        };
        if (!cancelled && payload.summary) {
          setSummary(payload.summary);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Analytics failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 font-sans text-slate-100">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <p className="text-xs font-bold tracking-widest text-indigo-400 uppercase">
          Network Operations
        </p>
        <h1 className="text-3xl font-bold text-white">
          Viewer Telemetry Dashboard
        </h1>
        <p className="text-sm text-slate-400">
          Watch time, unique viewers, and channel-switch retention from
          PostgreSQL.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Loading telemetry…</p>
      ) : null}
      {error ? (
        <p className="mb-6 text-sm text-amber-400" role="status">
          {error}. Showing empty totals until the broadcast database is online.
        </p>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Watch Seconds"
          value={summary.totalWatchSeconds.toLocaleString()}
        />
        <StatCard
          label="Unique Viewers"
          value={summary.uniqueViewers.toLocaleString()}
        />
        <StatCard
          label="Channel Switches"
          value={summary.channelSwitches.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AnalyticsTable
          title="By Channel"
          rows={summary.byChannel.map((row) => ({
            id: row.channelId,
            watch: row.watchSeconds,
            views: row.views,
          }))}
        />
        <AnalyticsTable
          title="By Segment"
          rows={summary.bySegment.map((row) => ({
            id: row.segmentId,
            watch: row.watchSeconds,
            views: row.views,
          }))}
        />
      </div>
    </div>
  );
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="text-xs tracking-wider text-slate-500 uppercase">
        {label}
      </div>
      <div className="mt-2 font-mono text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function AnalyticsTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; watch: number; views: number }>;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-4 text-sm font-bold tracking-wider text-slate-400 uppercase">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No telemetry rows yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="pb-2">ID</th>
              <th className="pb-2">Watch (s)</th>
              <th className="pb-2">Views</th>
            </tr>
          </thead>
          <tbody className="font-mono text-slate-200">
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="py-2">{row.id}</td>
                <td>{row.watch}</td>
                <td>{row.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
