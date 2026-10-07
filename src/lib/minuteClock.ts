/**
 * Minute-clock store for `useSyncExternalStore`.
 *
 * `getSnapshot` MUST return a stable value between store updates; passing
 * `() => Date.now()` hands React a fresh number on every render check, so
 * the component re-renders forever ("Maximum update depth exceeded" on
 * /venue first load). This module caches the latest tick and the interval
 * advances the cache BEFORE notifying listeners — the same set-then-notify
 * shape as the artist pin store — so each 60-second tick exposes exactly
 * one new snapshot and every read in between gets the same number.
 */

let lastNow = 0;

/** Subscribes a listener that fires once per minute, after the tick value advances. */
export function subscribeToMinuteClock(onStoreChange: () => void): () => void {
  const timer = setInterval(() => {
    lastNow = Date.now();
    onStoreChange();
  }, 60_000);
  return () => clearInterval(timer);
}

/**
 * Client snapshot: returns the cached tick value, identical across every
 * call within a single tick window.
 */
export function getMinuteClockNow(): number {
  // First client read seeds the window; the value stays fixed until the
  // interval fires and the subscribers are notified with it.
  if (lastNow === 0) {
    lastNow = Date.now();
  }
  return lastNow;
}

/** Server snapshot: the clock is client-only, so the server hydrates as null. */
export function getMinuteClockServerSnapshot(): null {
  return null;
}
