"use client";

import React from "react";
import type { StudioShotRow } from "../types";

export const ShotList: React.FC<{
  shots: StudioShotRow[];
  selectedShotId?: string;
  onSelectShot?: (shotId: string) => void;
}> = ({ shots, selectedShotId, onSelectShot }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-black">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 font-black uppercase text-zinc-400">
            <th className="p-2">Shot</th>
            <th className="p-2">Status</th>
            <th className="p-2">Project</th>
            <th className="p-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => {
            const selected = selectedShotId === shot.shot_id;
            return (
              <tr
                key={shot.id}
                onClick={() => onSelectShot?.(shot.shot_id)}
                className={`cursor-pointer ${selected ? "bg-zinc-900" : "hover:bg-zinc-950"}`}
              >
                <td className="p-2 font-mono font-bold text-white">{shot.shot_id}</td>
                <td className="p-2 uppercase text-zinc-300">{shot.status}</td>
                <td className="p-2 text-zinc-400">{shot.project_id}</td>
                <td className="p-2 text-zinc-500">{shot.director_notes ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
