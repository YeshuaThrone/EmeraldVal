"use client";

import { DollarSign, MapPin, Music2, Send, X } from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import type { Pin } from "@/lib/types";

type PerformerDrawerProps = {
  pin: Pin | null;
  onChange: (patch: Partial<Pin>) => void;
  onClose: () => void;
  onSendTip: () => void;
};

export default function PerformerDrawer({
  pin,
  onChange,
  onClose,
  onSendTip,
}: PerformerDrawerProps) {
  const open = pin !== null;

  return (
    <>
      <button
        type="button"
        aria-label="Close performer details"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <section
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl rounded-t-3xl border border-atx-line border-b-0 bg-atx-paper px-5 pt-3 pb-6 shadow-[0_-20px_80px_rgba(28,25,23,0.12)] transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!open}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-atx-line" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-atx-red uppercase">
              Performer
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold text-atx-ink">
              {pin?.performerName || "Untitled set"}
            </h2>
            {pin?.genre ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-atx-blue/40 bg-atx-blue/15 px-2.5 py-1 text-xs text-atx-blue-deep">
                <Music2 className="h-3 w-3" />
                {pin.genre}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-atx-line p-2 text-stone-400 transition hover:text-atx-ink"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-stone-500">
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
            <span className="text-xs font-medium text-stone-500">Location Name</span>
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-atx-red" />
              <input
                value={pin?.locationName ?? ""}
                onChange={(event) => onChange({ locationName: event.target.value })}
                placeholder="Street, intersection, or venue"
                className={`${FIELD_CLASS} pl-10`}
              />
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-stone-500">Tip Amount ($)</span>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-atx-red" />
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
              <span className="text-xs font-medium text-stone-500">Cash App ($)</span>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-atx-line bg-atx-paper px-3 text-sm text-atx-red">
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
              <span className="text-xs font-medium text-stone-500">Venmo (@)</span>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-atx-line bg-atx-paper px-3 text-sm text-atx-blue">
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

          <button
            type="button"
            onClick={onSendTip}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-atx-red px-4 py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(155,27,48,0.35)] transition hover:bg-atx-red-deep"
          >
            <Send className="h-4 w-4" />
            Send Tip
          </button>
        </div>
      </section>
    </>
  );
}
