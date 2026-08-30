import type { ArtistShowPin } from "@/lib/artistSdk";
import type { Pin } from "@/lib/types";

/**
 * Session-scoped store for artist show pins.
 *
 * Next.js App Router navigation unmounts LiveMapApp, so pins held only in
 * its React state would vanish the moment an artist leaves the fan map.
 * This module-level store survives client-side navigation (the module stays
 * loaded) while keeping the same persistence contract as Go-Live pins:
 * client state only — a full page reload clears it. No backend, no
 * localStorage; the Artist Studio widget writes, the fan map reads.
 *
 * Shaped for `useSyncExternalStore`: `getArtistPins` returns a stable
 * snapshot reference that only changes when `setArtistPins` is called.
 */

let pins: ArtistShowPin[] = [];

/**
 * Server-hydrated pins (PR 22 map persistence) — shows and pings restored
 * from GET /api/shows + GET /api/telemetry/live-ping on map mount. A
 * separate slice from the session `pins` above: the studio widget's
 * `setArtistPins` wholesale-replaces the session slice from its SDK
 * instance, which would clobber restored pins if they shared the array.
 * Both slices share one listener set, so one subscription drives both.
 */
let hydratedPins: ArtistShowPin[] = [];

const listeners = new Set<() => void>();

export function getArtistPins(): ArtistShowPin[] {
  return pins;
}

export function setArtistPins(next: ArtistShowPin[]): void {
  pins = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Read-only view of the server-restored pins, for the map host. */
export function getHydratedPins(): ArtistShowPin[] {
  return hydratedPins;
}

/** Replaces the hydrated slice wholesale (hydration is all-or-nothing). */
export function setHydratedPins(next: ArtistShowPin[]): void {
  hydratedPins = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeArtistPins(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Patches one artist pin in place (performer drawer edits). The drawer's
 * patch type is Partial<Pin>, which could in principle carry a foreign
 * `source`; an artist pin's identity fields are studio-owned, so a patch
 * that tries to re-source it is refused rather than silently corrupting
 * the pin. Everything else (display fields) merges over the pin.
 *
 * Covers both slices — session pins and server-hydrated pins — so a drawer
 * edit on a restored pin is applied rather than silently dropped.
 */
export function patchArtistPin(id: string, patch: Partial<Pin>): void {
  if (patch.source !== undefined && patch.source !== "artist") {
    return;
  }
  if (pins.some((pin) => pin.id === id)) {
    pins = pins.map((pin) =>
      pin.id === id ? { ...pin, ...patch, source: "artist" as const } : pin,
    );
  } else if (hydratedPins.some((pin) => pin.id === id)) {
    hydratedPins = hydratedPins.map((pin) =>
      pin.id === id ? { ...pin, ...patch, source: "artist" as const } : pin,
    );
  } else {
    return;
  }
  for (const listener of listeners) {
    listener();
  }
}
