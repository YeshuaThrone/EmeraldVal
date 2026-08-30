"use client";

import { useState } from "react";
import {
  CalendarDays,
  DollarSign,
  ExternalLink,
  MapPin,
  Music2,
  Send,
  ShoppingBag,
  Ticket,
  X,
} from "lucide-react";
import { FIELD_CLASS } from "@/lib/constants";
import { startCheckout } from "@/lib/checkoutClient";
import type { Pin } from "@/lib/types";

type PerformerDrawerProps = {
  pin: Pin | null;
  onChange: (patch: Partial<Pin>) => void;
  onClose: () => void;
  onSendTip: () => void;
  /**
   * True only when the server reports STRIPE_SECRET_KEY configured — the
   * gate that decides between the real Buy button and the PR #20
   * data-only treatment. Defaults false so every other caller keeps the
   * honest no-checkout rendering.
   */
  checkoutEnabled?: boolean;
};

export default function PerformerDrawer({
  pin,
  onChange,
  onClose,
  onSendTip,
  checkoutEnabled = false,
}: PerformerDrawerProps) {
  const open = pin !== null;

  // Artist show pins (from the Artist Studio) render as show data — venue,
  // council district, set time, and ticketing — instead of the fan-facing
  // tip editor. Native ticketing is data, not checkout: no buy button.
  const isArtistShow = pin?.source === "artist";
  // Artist-only metadata (setTime, ticketUrl) lives on ArtistShowPin, not
  // the shared Pin type — narrow with `in` checks like MapCanvas does.
  const legacyTicketUrl =
    pin !== null && "ticketUrl" in pin && typeof pin.ticketUrl === "string"
      ? pin.ticketUrl
      : undefined;
  const ticketing =
    pin?.ticketing ??
    (legacyTicketUrl
      ? ({ type: "external", ticketUrl: legacyTicketUrl } as const)
      : undefined);
  const externalTicketUrl =
    ticketing?.type === "external" ? (ticketing.ticketUrl ?? "") : "";
  const nativeTicketing = ticketing?.type === "native" ? ticketing : null;
  // Checkout addresses the show by its stored id — hydrated pins carry it
  // as pin.id; session pins carry it as serverId (PR 24).
  const showId =
    pin !== null && "serverId" in pin && typeof pin.serverId === "string"
      ? pin.serverId
      : pin?.id;
  const soldOut = nativeTicketing !== null && nativeTicketing.capacity <= 0;
  const checkoutReady =
    checkoutEnabled && nativeTicketing !== null && !soldOut && showId != null;
  // Purchase state keyed to the selected pin: when the drawer opens a
  // different show, state resets during render (React's documented
  // "adjust state when props change" pattern — no effect, no cascading
  // render), so a stale quantity/error never leaks between shows.
  const [purchase, setPurchase] = useState<{
    pinId: string | undefined;
    quantity: number;
    buying: boolean;
    buyError: string | null;
  }>({ pinId: pin?.id, quantity: 1, buying: false, buyError: null });
  if (pin?.id !== purchase.pinId) {
    setPurchase({ pinId: pin?.id, quantity: 1, buying: false, buyError: null });
  }
  const { quantity, buying, buyError } = purchase;
  const setQuantity = (next: number) =>
    setPurchase((current) => ({ ...current, quantity: next }));

  const handleBuy = async () => {
    if (showId == null || nativeTicketing === null || buying) {
      return;
    }
    setPurchase((current) => ({ ...current, buying: true, buyError: null }));
    const result = await startCheckout(showId, quantity);
    setPurchase((current) => ({ ...current, buying: false }));
    if (!result.ok) {
      setPurchase((current) => ({ ...current, buyError: result.error }));
      return;
    }
    // The Stripe session opens in a new tab; the map page stays put and
    // confirms the purchase when Stripe's success redirect returns.
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const rawSetTime =
    pin !== null && "setTime" in pin && typeof pin.setTime === "string"
      ? pin.setTime
      : undefined;
  const setTimeLabel =
    rawSetTime === undefined || Number.isNaN(new Date(rawSetTime).getTime())
      ? null
      : new Date(rawSetTime).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

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
            <p
              className={`text-xs font-semibold tracking-[0.2em] uppercase ${
                isArtistShow ? "text-atx-electric" : "text-atx-red"
              }`}
            >
              {isArtistShow ? "Artist Show" : "Performer"}
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold text-atx-ink">
              {(isArtistShow
                ? (pin?.artistName || pin?.performerName)
                : pin?.performerName) || "Untitled set"}
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

        {isArtistShow ? (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
            <div className="grid gap-3 rounded-2xl border border-atx-electric/30 bg-atx-electric/5 p-4 text-sm">
              {pin?.councilDistrict ? (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-atx-electric/40 bg-atx-paper px-2.5 py-1 text-xs font-medium text-atx-electric-deep">
                  <MapPin className="h-3 w-3" />
                  {pin.councilDistrict}
                </span>
              ) : null}
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-atx-electric" />
                <p className="text-atx-ink">
                  <span className="text-stone-500">Venue: </span>
                  {pin?.locationName || "—"}
                </p>
              </div>
              {setTimeLabel !== null ? (
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-atx-electric" />
                  <p className="text-atx-ink">
                    <span className="text-stone-500">Set time: </span>
                    {setTimeLabel}
                  </p>
                </div>
              ) : null}
            </div>

            {nativeTicketing !== null && soldOut ? (
              // Sold out (PR 24 capacity accounting decremented the stored
              // remaining count to zero) — no Buy affordance at all.
              <div className="rounded-2xl border border-atx-line bg-atx-paper p-4">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-atx-ink">
                  <Ticket className="h-4 w-4 text-stone-400" />
                  Direct ATXLive Ticketing · ${nativeTicketing.price.toFixed(2)}
                </p>
                <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Sold out
                </p>
              </div>
            ) : checkoutReady && nativeTicketing !== null ? (
              // Checkout is configured (STRIPE_SECRET_KEY set): a real,
              // themed Buy button with a quantity selector capped at the
              // show's remaining capacity. The session URL opens in a new
              // tab; the map confirms the purchase on the success redirect.
              <div className="rounded-2xl border border-atx-electric/30 bg-atx-electric/5 p-4">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-atx-ink">
                  <Ticket className="h-4 w-4 text-atx-electric" />
                  Direct ATXLive Ticketing · ${nativeTicketing.price.toFixed(2)}{" "}
                  · {nativeTicketing.capacity} tickets left
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-stone-500">
                    Qty
                    <input
                      type="number"
                      min="1"
                      max={nativeTicketing.capacity}
                      step="1"
                      value={quantity}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        if (Number.isInteger(next) && next >= 1) {
                          setQuantity(Math.min(next, nativeTicketing.capacity));
                        }
                      }}
                      className="w-16 rounded-xl border border-atx-line bg-atx-paper px-2 py-1.5 text-sm text-atx-ink"
                      aria-label="Ticket quantity"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={buying}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-atx-electric px-4 py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(0,85,255,0.35)] transition hover:bg-atx-electric-deep disabled:opacity-60"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {buying ? "Opening checkout…" : "Buy Tickets"}
                  </button>
                </div>
                {buyError !== null ? (
                  <p className="mt-2 text-xs font-medium text-atx-red">{buyError}</p>
                ) : null}
              </div>
            ) : nativeTicketing !== null ? (
              // Native ticketing is data, not checkout — the price/capacity
              // line plus an explicit checkout-pending note, never a Buy
              // button (there is no payment backend to point it at).
              <div className="rounded-2xl border border-atx-line bg-atx-paper p-4">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-atx-ink">
                  <Ticket className="h-4 w-4 text-atx-electric" />
                  Direct ATXLive Ticketing · ${nativeTicketing.price.toFixed(2)}{" "}
                  · {nativeTicketing.capacity} tickets
                </p>
                <p className="mt-1.5 text-xs text-stone-400">
                  Checkout coming with the ATXLive backend.
                </p>
              </div>
            ) : externalTicketUrl !== "" ? (
              <a
                href={externalTicketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-atx-electric px-4 py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(0,85,255,0.35)] transition hover:bg-atx-electric-deep"
              >
                <ExternalLink className="h-4 w-4" />
                Get Tickets — External Site
              </a>
            ) : (
              <p className="text-xs text-stone-400">
                No ticket link provided for this show.
              </p>
            )}
          </div>
        ) : (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-stone-500">
                Performer / Band Name
              </span>
              <input
                value={pin?.performerName ?? ""}
                onChange={(event) =>
                  onChange({ performerName: event.target.value })
                }
                placeholder="Who is playing?"
                className={FIELD_CLASS}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-stone-500">
                Location Name
              </span>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-atx-red" />
                <input
                  value={pin?.locationName ?? ""}
                  onChange={(event) =>
                    onChange({ locationName: event.target.value })
                  }
                  placeholder="Street, intersection, or venue"
                  className={`${FIELD_CLASS} pl-10`}
                />
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-stone-500">
                Tip Amount ($)
              </span>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-atx-red" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  value={pin?.tipAmount ?? ""}
                  onChange={(event) =>
                    onChange({ tipAmount: event.target.value })
                  }
                  placeholder="5"
                  className={`${FIELD_CLASS} pl-10`}
                />
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-stone-500">
                  Cash App ($)
                </span>
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
        )}
      </section>
    </>
  );
}
