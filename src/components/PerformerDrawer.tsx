"use client";

import { Clock, DollarSign, MapPin, Music2, Send, X } from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import { formatLiveCountdown } from "@/lib/countdown";
import type { Pin } from "@/lib/types";

type PerformerDrawerProps = {
  pin: Pin | null;
  now: number;
  onChange: (patch: Partial<Pin>) => void;
  onClose: () => void;
  onSendTip: () => void;
};

export default function PerformerDrawer({
  pin,
  now,
  onChange,
  onClose,
  onSendTip,
}: PerformerDrawerProps) {
  const open = pin !== null;
  const isFestival = pin?.kind === "festival";

  return (
    <>
      <button
        type="button"
        aria-label="Close performer details"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#003366]/20 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <section
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl rounded-t-3xl border border-[#00529C]/20 border-b-0 bg-white px-5 pt-3 pb-6 shadow-[0_-16px_48px_rgba(0,82,156,0.12)] transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!open}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#00529C]/25" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p
              className={`text-xs font-semibold tracking-[0.2em] uppercase ${
                isFestival ? "text-[#00529C]" : "text-[#10B981]"
              }`}
            >
              {isFestival ? "Festival" : "Performer"}
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold text-[#003366]">
              {pin?.performerName || "Untitled set"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pin?.genre ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#00529C]/30 bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#00529C]">
                  <Music2 className="h-3 w-3" />
                  {pin.genre}
                </span>
              ) : null}
              {pin ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    isFestival
                      ? "border-[#FFE317] bg-[#FFE317]/30 text-[#003366]"
                      : "border-[#10B981]/40 bg-[#10B981]/10 text-[#0f766e]"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {formatLiveCountdown(pin.liveUntil, now)}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#00529C]/25 p-2 text-[#00529C] transition hover:bg-[#F8FAFC]"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">
              Performer / Band Name
            </span>
            <input
              value={pin?.performerName ?? ""}
              onChange={(event) => onChange({ performerName: event.target.value })}
              placeholder="Who is playing?"
              className={FIELD_CLASS}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">Location Name</span>
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#E0144C]" />
              <input
                value={pin?.locationName ?? ""}
                onChange={(event) => onChange({ locationName: event.target.value })}
                placeholder="Street, intersection, or venue"
                className={`${FIELD_CLASS} pl-10`}
              />
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-[#00529C]">Tip Amount ($)</span>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#E0144C]" />
              <input
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                value={pin?.tipAmount ?? ""}
                onChange={(event) => onChange({ tipAmount: event.target.value })}
                placeholder="5"
                className={`${FIELD_CLASS} pl-10`}
              />
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[#00529C]">Cash App ($)</span>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[#00529C]/30 bg-[#F8FAFC] px-3 text-sm text-[#00529C]">
                  $
                </span>
                <input
                  value={pin?.cashApp ?? ""}
                  onChange={(event) =>
                    onChange({ cashApp: event.target.value.replace(/^\$+/, "") })
                  }
                  placeholder="handle"
                  className={`${FIELD_CLASS} rounded-l-none`}
                />
              </div>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[#00529C]">Venmo (@)</span>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[#00529C]/30 bg-[#F8FAFC] px-3 text-sm text-[#00529C]">
                  @
                </span>
                <input
                  value={pin?.venmo ?? ""}
                  onChange={(event) =>
                    onChange({ venmo: event.target.value.replace(/^@+/, "") })
                  }
                  placeholder="handle"
                  className={`${FIELD_CLASS} rounded-l-none`}
                />
              </div>
            </label>
          </div>

          {isFestival && pin?.stages ? (
            <div className="grid gap-2">
              {pin.stages.map((stage) => (
                <div
                  key={stage.name}
                  className="rounded-xl border border-[#00529C]/15 bg-[#F8FAFC] px-3 py-2"
                >
                  <p className="text-[11px] font-semibold tracking-wide text-[#00529C] uppercase">
                    {stage.name}
                  </p>
                  <ul className="mt-1.5 grid gap-1 text-sm text-[#003366]">
                    {stage.sets.map((set) => (
                      <li
                        key={`${stage.name}-${set.artist}`}
                        className="flex justify-between gap-2"
                      >
                        <span>{set.artist}</span>
                        <span className="text-xs text-slate-500">
                          {set.startTime} – {set.endTime}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onSendTip}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E0144C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c41243]"
          >
            <Send className="h-4 w-4" />
            Send Tip
          </button>
        </div>
      </section>
    </>
  );
}
