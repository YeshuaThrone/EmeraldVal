"use client";

import React, { useState } from "react";
import type {
  ChannelNetworkConfig,
  ProgramSegment,
} from "../playout/multiChannelEngine";

interface WorkspaceProps {
  initialChannels: ChannelNetworkConfig[];
  onSaveNetworks: (updatedChannels: ChannelNetworkConfig[]) => void;
}

export const ChannelWorkspaceAdmin: React.FC<WorkspaceProps> = ({
  initialChannels,
  onSaveNetworks,
}) => {
  const [channels, setChannels] =
    useState<ChannelNetworkConfig[]>(initialChannels);
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    initialChannels[0]?.channelId || "",
  );

  const activeChannel = channels.find((c) => c.channelId === selectedChannelId);

  const handleAddChannel = () => {
    const newId = `ch-${crypto.randomUUID()}`;
    const newChannel: ChannelNetworkConfig = {
      channelId: newId,
      channelNumber: channels.length + 1,
      channelName: "NEW CHANNEL",
      category: "General",
      stationBugLogoUrl: "",
      programmingGrid: [],
    };
    const updated = [...channels, newChannel];
    setChannels(updated);
    setSelectedChannelId(newId);
    onSaveNetworks(updated);
  };

  const handleUpdateChannelMeta = (
    field: keyof ChannelNetworkConfig,
    value: ChannelNetworkConfig[keyof ChannelNetworkConfig],
  ) => {
    if (!activeChannel) return;
    const updated = channels.map((c) =>
      c.channelId === activeChannel.channelId ? { ...c, [field]: value } : c,
    );
    setChannels(updated);
    onSaveNetworks(updated);
  };

  const handleAddSegment = (
    type: "SHOW" | "CREATOR_PROMO" | "STATION_ID",
  ) => {
    if (!activeChannel) return;
    const newSegment: ProgramSegment = {
      id: `seg-${crypto.randomUUID()}`,
      title: type === "SHOW" ? "Untitled Show" : "Creator Spotlight Interlude",
      creatorName: "Creator Name",
      type,
      videoUrl: "",
      durationSeconds: type === "SHOW" ? 600 : 30,
      metadata: { socialHandle: "@handle" },
    };

    const updatedGrid = [...activeChannel.programmingGrid, newSegment];
    handleUpdateChannelMeta("programmingGrid", updatedGrid);
  };

  const handleUpdateSegment = (
    segmentId: string,
    field: string,
    value: string | number,
  ) => {
    if (!activeChannel) return;
    const updatedGrid = activeChannel.programmingGrid.map((seg) => {
      if (seg.id !== segmentId) return seg;
      if (field.startsWith("meta.")) {
        const metaKey = field.split(".")[1];
        if (!metaKey) return seg;
        return {
          ...seg,
          metadata: { ...seg.metadata, [metaKey]: value },
        };
      }
      return { ...seg, [field]: value };
    });
    handleUpdateChannelMeta("programmingGrid", updatedGrid);
  };

  const handleMoveSegment = (index: number, direction: "UP" | "DOWN") => {
    if (!activeChannel) return;
    const grid = [...activeChannel.programmingGrid];
    const targetIndex = direction === "UP" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= grid.length) return;

    const current = grid[index];
    const target = grid[targetIndex];
    if (!current || !target) return;
    grid[index] = target;
    grid[targetIndex] = current;

    handleUpdateChannelMeta("programmingGrid", grid);
  };

  const handleDeleteSegment = (segmentId: string) => {
    if (!activeChannel) return;
    const updatedGrid = activeChannel.programmingGrid.filter(
      (s) => s.id !== segmentId,
    );
    handleUpdateChannelMeta("programmingGrid", updatedGrid);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 p-8 font-sans text-slate-100">
      <div className="mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Broadcast Control Workspace
          </h1>
          <p className="text-sm text-slate-400">
            Design your channels, assign slot positions, and curate custom
            interludes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddChannel}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500"
        >
          + Create New Channel
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-3 space-y-3">
          <h2 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            My Networks
          </h2>
          {channels.map((ch) => (
            <div
              key={ch.channelId}
              onClick={() => setSelectedChannelId(ch.channelId)}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                ch.channelId === selectedChannelId
                  ? "border-indigo-500 bg-indigo-950/60 text-white"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                  CH {String(ch.channelNumber).padStart(2, "0")}
                </span>
                <span className="text-xs text-slate-500">
                  {ch.programmingGrid.length} Slots
                </span>
              </div>
              <div className="mt-2 text-base font-bold">{ch.channelName}</div>
              <div className="text-xs text-slate-400">{ch.category}</div>
            </div>
          ))}
        </div>

        {activeChannel ? (
          <div className="col-span-9 space-y-6">
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">
                Channel Configuration
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Channel Number
                  </label>
                  <input
                    type="number"
                    value={activeChannel.channelNumber}
                    onChange={(e) =>
                      handleUpdateChannelMeta(
                        "channelNumber",
                        Number(e.target.value),
                      )
                    }
                    className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Network Name
                  </label>
                  <input
                    type="text"
                    value={activeChannel.channelName}
                    onChange={(e) =>
                      handleUpdateChannelMeta("channelName", e.target.value)
                    }
                    className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
                    Category / Theme
                  </label>
                  <input
                    type="text"
                    value={activeChannel.category}
                    onChange={(e) =>
                      handleUpdateChannelMeta("category", e.target.value)
                    }
                    className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">
                    Programming Schedule
                  </h3>
                  <p className="text-xs text-slate-500">
                    Order your main shows, custom commercial interludes, and
                    artist promos.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSegment("SHOW")}
                    className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
                  >
                    + Add Main Show
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSegment("CREATOR_PROMO")}
                    className="rounded border border-purple-700 bg-purple-900/40 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-900/60"
                  >
                    + Add Interlude / Promo
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {activeChannel.programmingGrid.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-500">
                    No programming slots created yet. Click above to add a show
                    or interlude.
                  </div>
                ) : (
                  activeChannel.programmingGrid.map((segment, index) => (
                    <div
                      key={segment.id}
                      className={`rounded-lg border p-4 transition ${
                        segment.type === "CREATOR_PROMO"
                          ? "border-purple-900/60 bg-purple-950/20"
                          : "border-slate-800 bg-slate-950"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              segment.type === "SHOW"
                                ? "bg-indigo-900 text-indigo-200"
                                : "bg-purple-900 text-purple-200"
                            }`}
                          >
                            {segment.type}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            Slot #{index + 1}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveSegment(index, "UP")}
                            disabled={index === 0}
                            className="px-2 text-xs text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSegment(index, "DOWN")}
                            disabled={
                              index === activeChannel.programmingGrid.length - 1
                            }
                            className="px-2 text-xs text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(segment.id)}
                            className="ml-2 px-2 text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <label className="block text-[10px] text-slate-500">
                            Title / Show Name
                          </label>
                          <input
                            type="text"
                            value={segment.title}
                            onChange={(e) =>
                              handleUpdateSegment(
                                segment.id,
                                "title",
                                e.target.value,
                              )
                            }
                            className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[10px] text-slate-500">
                            Creator / Artist
                          </label>
                          <input
                            type="text"
                            value={segment.creatorName}
                            onChange={(e) =>
                              handleUpdateSegment(
                                segment.id,
                                "creatorName",
                                e.target.value,
                              )
                            }
                            className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[10px] text-slate-500">
                            YouTube or MP4 Stream URL
                          </label>
                          <input
                            type="text"
                            value={segment.videoUrl}
                            placeholder="https://youtube.com/watch?v=..."
                            onChange={(e) =>
                              handleUpdateSegment(
                                segment.id,
                                "videoUrl",
                                e.target.value,
                              )
                            }
                            className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-500">
                            Duration (Secs)
                          </label>
                          <input
                            type="number"
                            value={segment.durationSeconds}
                            onChange={(e) =>
                              handleUpdateSegment(
                                segment.id,
                                "durationSeconds",
                                Number(e.target.value),
                              )
                            }
                            className="w-full rounded border border-slate-800 bg-slate-900 p-1.5 font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="col-span-9 py-20 text-center text-slate-500">
            Select or create a network channel to manage programming.
          </div>
        )}
      </div>
    </div>
  );
};
