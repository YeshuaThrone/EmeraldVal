"use client";

import React, { useEffect, useState } from "react";

interface Channel {
  id: string;
  channel_number: number;
  channel_name: string;
  category: string;
}

export const AdminLineupManager: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("ch-01");
  const [adminKey, setAdminKey] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newChanNum, setNewChanNum] = useState<number>(4);
  const [newChanName, setNewChanName] = useState("");
  const [newChanCategory, setNewChanCategory] = useState("CUSTOM");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/channels")
      .then((res) => res.json())
      .then((data: { success?: boolean; channels?: Channel[] }) => {
        if (!cancelled && data.success && data.channels) {
          setChannels(data.channels);
          const maxNum = data.channels.reduce(
            (max, ch) => Math.max(max, Number(ch.channel_number) || 0),
            0,
          );
          if (maxNum > 0) setNewChanNum(maxNum + 1);
          setSelectedChannel((current) =>
            current === "ch-01" && data.channels?.[0]
              ? data.channels[0].id
              : current,
          );
        }
      })
      .catch(() => {
        /* lineup list stays empty until the operator retries */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBridgeGaps = async () => {
    setIsProcessing(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/v1/admin/bridge-gaps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worfi-admin-key": adminKey,
        },
      });
      const data = (await res.json()) as { message?: string; success?: boolean };
      setStatusMsg(
        data.message || (data.success ? "Gaps bridged successfully." : "Failed."),
      );
    } catch {
      setStatusMsg("Error connecting to admin API.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCustomChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await fetch("/api/v1/admin/channels/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worfi-admin-key": adminKey,
        },
        body: JSON.stringify({
          channelNumber: newChanNum,
          channelName: newChanName,
          category: newChanCategory,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
      };
      if (data.success) {
        setStatusMsg(`Channel "${newChanName}" created!`);
        setNewChanName("");
        setNewChanNum(newChanNum + 1);
        const updated = (await fetch("/api/v1/channels").then((r) =>
          r.json(),
        )) as { success?: boolean; channels?: Channel[] };
        if (updated.success && updated.channels) setChannels(updated.channels);
      } else {
        setStatusMsg(data.error || "Failed to create channel.");
      }
    } catch {
      setStatusMsg("Error creating custom channel.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl rounded-2xl border border-blue-900/80 bg-slate-950 p-6 font-mono text-slate-100 shadow-2xl">
      <div className="mb-6 flex items-center justify-between border-b border-blue-900/60 pb-4">
        <div>
          <h1 className="text-2xl font-black text-yellow-400">
            WURFI NETWORK CONTROL CENTER
          </h1>
          <p className="text-xs text-blue-300/80">
            Internal Operator Portal • EPG Grid & Channel Orchestration
          </p>
        </div>
        <input
          type="password"
          placeholder="Admin Secret Key"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="rounded border border-blue-800 bg-slate-900 px-3 py-1 text-xs text-yellow-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-blue-900/50 bg-slate-900/60 p-4">
          <h2 className="border-b border-blue-900/40 pb-2 text-sm font-bold text-yellow-400">
            ACTIVE CHANNELS
          </h2>
          <div className="space-y-2">
            {channels.map((ch) => (
              <button
                type="button"
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`w-full rounded-lg border p-3 text-left text-xs font-bold transition ${
                  selectedChannel === ch.id
                    ? "border-yellow-400 bg-blue-950 text-yellow-400"
                    : "border-blue-900/40 bg-slate-900 text-slate-300 hover:border-blue-700"
                }`}
              >
                CH {String(ch.channel_number).padStart(2, "0")} • {ch.channel_name}{" "}
                ({ch.category})
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleBridgeGaps()}
            disabled={isProcessing}
            className="w-full rounded-lg bg-yellow-500 py-2.5 text-xs font-extrabold tracking-wider text-black uppercase transition hover:bg-yellow-400 active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? "BRIDGING..." : "⚡ AUTO-BRIDGE SCHEDULE GAPS"}
          </button>
        </div>

        <div className="space-y-4 rounded-xl border border-blue-900/50 bg-slate-900/60 p-4 md:col-span-2">
          <h2 className="border-b border-blue-900/40 pb-2 text-sm font-bold text-yellow-400">
            CREATE CUSTOM CHANNEL
          </h2>
          <form onSubmit={handleCreateCustomChannel} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400">
                  CHANNEL NUMBER
                </label>
                <input
                  type="number"
                  value={newChanNum}
                  onChange={(e) => setNewChanNum(Number(e.target.value))}
                  className="w-full rounded border border-blue-900/80 bg-slate-900 px-3 py-2 text-xs font-bold text-yellow-400"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400">
                  CHANNEL NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. ATX LOCAL NEWS 24/7"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="w-full rounded border border-blue-900/80 bg-slate-900 px-3 py-2 text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400">
                  CATEGORY
                </label>
                <select
                  value={newChanCategory}
                  onChange={(e) => setNewChanCategory(e.target.value)}
                  className="w-full rounded border border-blue-900/80 bg-slate-900 px-3 py-2 text-xs font-bold text-yellow-400"
                >
                  <option value="LOCAL_NEWS">LOCAL NEWS</option>
                  <option value="LOCAL_SPORTS">LOCAL SPORTS</option>
                  <option value="MUSIC_INDIE">MUSIC & CREATIVE</option>
                  <option value="CUSTOM">CUSTOM ENTERTAINMENT</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="rounded border border-blue-700 bg-blue-900 px-6 py-2 text-xs font-bold tracking-wider text-yellow-400 uppercase hover:bg-blue-800"
            >
              + PROVISION CUSTOM CHANNEL
            </button>
          </form>

          {statusMsg && (
            <div className="rounded border border-blue-800 bg-blue-950/80 p-3 text-xs text-slate-200">
              {statusMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
