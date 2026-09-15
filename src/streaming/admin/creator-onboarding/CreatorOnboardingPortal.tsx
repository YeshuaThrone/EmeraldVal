"use client";

import React, { useState } from "react";

interface CreatorOnboardingProps {
  inviteToken?: string;
}

type OnboardingType = "SHOW" | "CREATOR_PROMO";

export const CreatorOnboardingPortal: React.FC<CreatorOnboardingProps> = ({
  inviteToken,
}) => {
  const [formData, setFormData] = useState({
    creatorName: "",
    email: "",
    socialHandle: "",
    title: "",
    videoUrl: "",
    durationSeconds: 300,
    type: "SHOW" as OnboardingType,
    artistBio: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/streaming/channels/ch-haven/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          inviteToken,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Ingest failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 font-sans text-slate-100">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 border-b border-slate-800 pb-6">
          <div className="mb-1 text-xs font-bold tracking-widest text-indigo-400 uppercase">
            NETWORK ONBOARDING PORTAL (INVITE ONLY)
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Selected Creator Delivery
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Welcome to the network. Use this private portal to upload your
            master assets and promo media for programming placement.
          </p>
          {inviteToken ? (
            <p className="mt-2 text-xs text-indigo-300">
              Invite token accepted.
            </p>
          ) : null}
        </div>

        {submitted ? (
          <div className="space-y-3 rounded-xl border border-indigo-800 bg-indigo-950/40 p-8 text-center">
            <div className="text-xl font-bold text-indigo-300">
              Asset Ingested Successfully
            </div>
            <div className="text-sm text-slate-300">
              Your media has been staged for final network schedule placement.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Artist / Creator Name
                </label>
                <input
                  required
                  type="text"
                  value={formData.creatorName}
                  onChange={(e) =>
                    setFormData({ ...formData, creatorName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Primary Social Handle (@)
                </label>
                <input
                  type="text"
                  value={formData.socialHandle}
                  onChange={(e) =>
                    setFormData({ ...formData, socialHandle: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-slate-400">
                  Show or Track Title
                </label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Asset Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as OnboardingType,
                    })
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="SHOW">Main Feature</option>
                  <option value="CREATOR_PROMO">Network Interlude</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Stream Link (YouTube URL or Direct MP4)
              </label>
              <input
                required
                type="url"
                placeholder="https://..."
                value={formData.videoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, videoUrl: e.target.value })
                }
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {pending ? "Delivering…" : "Deliver Master Asset to Network"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
