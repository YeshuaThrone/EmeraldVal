"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Gauge, LogOut, MapPinned, Radio, Receipt } from "lucide-react";
import type { AdminDataPayload } from "@/lib/admin-types";

function formatWhen(at: number): string {
  return new Date(at).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DataRoomPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminDataPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attendanceScope, setAttendanceScope] = useState<"daily" | "weekly">("daily");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/data", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        setError("Could not load municipal metrics.");
        return;
      }
      setData((await response.json()) as AdminDataPayload);
      setError(null);
    } catch {
      setError("Could not load municipal metrics.");
    }
  }, [router]);

  useEffect(() => {
    const first = window.setTimeout(() => {
      void load();
    }, 0);
    const timer = window.setInterval(() => {
      void load();
    }, 8000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  const maxHeat = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, ...data.zoneHeat.map((row) => row.count));
  }, [data]);

  const attendanceLogs = useMemo(() => {
    if (!data) {
      return [];
    }
    const windowMs = attendanceScope === "daily" ? 86_400_000 : 7 * 86_400_000;
    const cutoff = data.generatedAt - windowMs;
    return data.attendance.logs.filter((row) => row.at >= cutoff);
  }, [attendanceScope, data]);

  async function exportLuminate() {
    setExporting(true);
    try {
      const response = await fetch("/api/admin/data?export=luminate");
      if (!response.ok) {
        return;
      }
      const text = await response.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "luminate-physical-pos.txt";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  const touristPercent = data?.hot.touristPercent ?? 0;

  return (
    <div className="h-dvh overflow-y-auto bg-[#F8FAFC] text-[#003366]">
      <header className="border-b border-[#00529C]/15 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#E0144C] uppercase">
              Module 6 · Super-admin
            </p>
            <h1 className="font-display text-2xl font-semibold">Municipal Data Room</h1>
            <p className="text-sm text-[#00529C]">
              Citywide HOT · Slaughter to North Lamar heat · 150m attendance · Luminate POS
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#00529C] bg-white px-4 py-2 text-sm font-semibold text-[#00529C] hover:bg-[#00529C] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5">
        {error ? (
          <p className="rounded-2xl border border-[#E0144C]/30 bg-white px-4 py-3 text-sm text-[#E0144C]">
            {error}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-[#00529C]/15 bg-white p-5 shadow-sm">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#00529C] uppercase">
              <Gauge className="h-3.5 w-3.5" />
              Citywide HOT Tax Ratio Meter
            </p>
            <div className="mt-4 flex items-center gap-5">
              <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#E8EEF5" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#E0144C"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(touristPercent / 100) * 301.6} 301.6`}
                  transform="rotate(-90 60 60)"
                />
                <text
                  x="60"
                  y="56"
                  textAnchor="middle"
                  className="fill-[#003366]"
                  fontSize="22"
                  fontWeight="700"
                >
                  {touristPercent}%
                </text>
                <text x="60" y="74" textAnchor="middle" className="fill-[#00529C]" fontSize="8">
                  visitors
                </text>
              </svg>
              <div className="grid gap-2 text-sm">
                <p>
                  <span className="font-semibold text-[#E0144C]">Out-of-town</span>
                  {" · "}
                  {data?.hot.touristCount ?? 0} sessions
                </p>
                <p>
                  <span className="font-semibold text-[#00529C]">Austin residents</span>
                  {" · "}
                  {data?.hot.localCount ?? 0} sessions
                </p>
                <p className="text-xs text-slate-500">
                  Local share {data?.hot.localPercent ?? 0}% · unknown {data?.hot.unknownCount ?? 0}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-[#00529C]/15 bg-white p-5 shadow-sm">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#00529C] uppercase">
              <MapPinned className="h-3.5 w-3.5" />
              Full Austin Heat Map
            </p>
            <div className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1">
              {(data?.zoneHeat ?? []).map((row) => {
                const width = Math.max(6, Math.round((row.count / maxHeat) * 100));
                return (
                  <div key={row.zoneTag}>
                    <div className="mb-1 flex justify-between text-xs text-[#00529C]">
                      <span>
                        {row.label}
                        <span className="ml-2 rounded-full bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                          {row.kind === "district" ? "District" : "Zip zone"}
                        </span>
                      </span>
                      <span className="font-semibold text-[#003366]">{row.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#F8FAFC]">
                      <div
                        className={`h-full rounded-full ${row.kind === "district" ? "bg-[#E0144C]" : "bg-[#00529C]"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <article className="rounded-3xl border border-[#00529C]/15 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#00529C] uppercase">
              <Radio className="h-3.5 w-3.5" />
              Verified Venue Attendance
            </p>
            <div className="inline-flex rounded-2xl border border-[#00529C]/30 bg-[#F8FAFC] p-1">
              {(["daily", "weekly"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setAttendanceScope(scope)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize ${
                    attendanceScope === scope
                      ? "bg-[#E0144C] text-white"
                      : "text-[#00529C]"
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm text-[#003366]">
            {attendanceScope === "daily" ? data?.attendance.daily ?? 0 : data?.attendance.weekly ?? 0}{" "}
            verified check-ins within 150m of active stages, citywide
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-[#00529C] uppercase">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Venue</th>
                  <th className="py-2 pr-4">Zone / Zip</th>
                  <th className="py-2">Distance</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.map((row) => (
                  <tr key={`${row.sessionId}-${row.at}`} className="border-t border-[#00529C]/10">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatWhen(row.at)}</td>
                    <td className="py-2 pr-4">{row.venueName}</td>
                    <td className="py-2 pr-4">
                      {row.zoneTag.replaceAll("_", " ")}
                      {row.zipCode ? ` · ${row.zipCode}` : ""}
                    </td>
                    <td className="py-2">{row.distanceMeters != null ? `${Math.round(row.distanceMeters)}m` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendanceLogs.length === 0 ? (
              <p className="py-6 text-sm text-[#00529C]">No verified attendance in this window.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-[#00529C]/15 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#00529C] uppercase">
                <Receipt className="h-3.5 w-3.5" />
                Luminate Sales Audit Queue
              </p>
              <p className="mt-1 text-sm text-[#003366]">
                Vinyl / CD / Cassette only · {data?.luminate.signed ?? 0} chart-eligible ·{" "}
                {data?.luminate.pending ?? 0} pending sign-off · {data?.luminate.ineligible ?? 0}{" "}
                ineligible digital
              </p>
            </div>
            <button
              type="button"
              onClick={() => void exportLuminate()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#E0144C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c41243] disabled:opacity-70"
            >
              <Download className="h-4 w-4" />
              Export pipe-delimited feed
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-[#00529C] uppercase">
                <tr>
                  <th className="py-2 pr-4">UPC_Code</th>
                  <th className="py-2 pr-4">Format</th>
                  <th className="py-2 pr-4">Location_ID</th>
                  <th className="py-2 pr-4">Manager_Signoff_ID</th>
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.luminate.sales ?? []).map((sale) => (
                  <tr key={sale.transactionId} className="border-t border-[#00529C]/10">
                    <td className="py-2 pr-4 font-mono text-xs">{sale.upcCode}</td>
                    <td className="py-2 pr-4">{sale.physicalFormatType ?? "DIGITAL"}</td>
                    <td className="py-2 pr-4">{sale.registeredVenueOrLocationId}</td>
                    <td className="py-2 pr-4">{sale.managerSignoffId ?? "—"}</td>
                    <td className="py-2 pr-4">{sale.quantity}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          sale.eligible
                            ? "bg-[#10B981]/15 text-[#0f766e]"
                            : sale.channel === "DIGITAL"
                              ? "bg-[#E0144C]/10 text-[#E0144C]"
                              : "bg-[#FFE317]/40 text-[#003366]"
                        }`}
                      >
                        {sale.eligible
                          ? "Chart-eligible"
                          : sale.channel === "DIGITAL"
                            ? "Ineligible digital"
                            : "Pending sign-off"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </main>
    </div>
  );
}
