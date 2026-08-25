"use client";

import { useState } from "react";
import { LoaderCircle, Radio, X } from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import { GENRES, type Genre } from "@/lib/types";

type GoLiveValues = {
  performerName: string;
  genre: Genre;
  streetAddress: string;
  handle: string;
};

type GoLiveModalProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: GoLiveValues) => void;
};

export default function GoLiveModal({
  isSubmitting,
  onClose,
  onSubmit,
}: GoLiveModalProps) {
  const [form, setForm] = useState<GoLiveValues>({
    performerName: "",
    genre: "Acoustic",
    streetAddress: "",
    handle: "",
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close go live modal"
        className="absolute inset-0 bg-[#003366]/20"
        onClick={onClose}
      />
      <form
        className="relative w-full max-w-md rounded-3xl border border-[#00529C]/20 bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#E0144C] uppercase">
              <Radio className="h-3.5 w-3.5" />
              Go Live
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold text-[#003366]">
              Drop a live pin
            </h2>
            <p className="mt-1 text-sm text-[#00529C]/70">
              Geocode your street address and appear on the Austin map.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#00529C]/20 p-2 text-[#00529C] transition hover:bg-[#F8FAFC]"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">Performer Name</span>
            <input
              required
              value={form.performerName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  performerName: event.target.value,
                }))
              }
              placeholder="Band or artist name"
              className={FIELD_CLASS}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">Genre</span>
            <select
              required
              value={form.genre}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  genre: event.target.value as Genre,
                }))
              }
              className={FIELD_CLASS}
            >
              {GENRES.map((genre) => (
                <option key={genre} value={genre} className="bg-white text-[#003366]">
                  {genre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">Street Address</span>
            <input
              required
              value={form.streetAddress}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  streetAddress: event.target.value,
                }))
              }
              placeholder="508 E 6th St or Rainey & Driskill"
              className={FIELD_CLASS}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">
              Cash App / Venmo handle
            </span>
            <input
              required
              value={form.handle}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  handle: event.target.value,
                }))
              }
              placeholder="$cashapp or @venmo"
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E0144C] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#c41243] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          Go Live
        </button>
      </form>
    </div>
  );
}
