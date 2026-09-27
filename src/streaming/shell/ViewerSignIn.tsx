"use client";

import React, { useState } from "react";
import {
  type ViewerSession,
  writeViewerSession,
} from "./viewerSession";

export const ViewerSignIn: React.FC<{
  onSignedIn: (session: ViewerSession) => void;
}> = ({ onSignedIn }) => {
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    const session = { displayName: name };
    writeViewerSession(session);
    onSignedIn(session);
  };

  return (
    <div className="font-epg flex min-h-screen select-none flex-col items-center justify-center bg-wurfi-void p-4 text-slate-100 sm:p-8">
      <div className="w-full max-w-md rounded-xl border border-wurfi-jade/40 bg-black p-8">
        <h1 className="text-center text-3xl font-black tracking-widest text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,0.9)]">
          WURFI <span className="text-wurfi-jade">NETWORK</span>
        </h1>
        <p className="mt-3 text-center text-xs tracking-wider text-wurfi-jade uppercase">
          Viewer sign-in
        </p>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Sign in to watch the lineup.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold tracking-wider text-wurfi-jade uppercase">
              Display name
            </span>
            <input
              required
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear as a viewer"
              className="w-full rounded border border-wurfi-jade/40 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-wurfi-jade"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded border border-wurfi-jade bg-wurfi-jade px-4 py-2.5 text-sm font-black tracking-wider text-black uppercase shadow-[2px_2px_0px_#000] transition hover:bg-wurfi-jade-deep"
          >
            Watch the lineup
          </button>
        </form>
      </div>
    </div>
  );
};
