import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMinuteClockNow,
  subscribeToMinuteClock,
} from "./minuteClock";

/**
 * Regression tests for the Venue Studio first-load crash
 * ("Maximum update depth exceeded"): getSnapshot passed to
 * useSyncExternalStore must return a referentially stable value within a
 * tick window, changing only after the interval fires and notifies.
 */

describe("minuteClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("getSnapshot is stable across repeated calls within one tick window", () => {
    const first = getMinuteClockNow();
    // React's render check calls getSnapshot many times per commit; a fresh
    // Date.now() here is what produced the infinite re-render loop.
    const second = getMinuteClockNow();
    const third = getMinuteClockNow();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("snapshot changes only after the 60s interval fires and notifies", () => {
    const initial = getMinuteClockNow();

    const listener = vi.fn();
    const unsub = subscribeToMinuteClock(listener);

    // Halfway into the window: still the same snapshot, no notification.
    vi.advanceTimersByTime(30_000);
    expect(listener).not.toHaveBeenCalled();
    expect(getMinuteClockNow()).toBe(initial);

    // At the tick the value advances and listeners are notified.
    vi.advanceTimersByTime(30_000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getMinuteClockNow()).not.toBe(initial);

    unsub();
  });

  it("listener notification happens after the cached value advances", () => {
    let observedDuringNotify: number | null = null;
    const initial = getMinuteClockNow();

    const unsub = subscribeToMinuteClock(() => {
      // By notify time the snapshot is already the new window value.
      observedDuringNotify = getMinuteClockNow();
    });

    vi.advanceTimersByTime(60_000);
    expect(observedDuringNotify).not.toBe(initial);

    unsub();
  });

  it("unsubscribing stops listener notifications", () => {
    const listener = vi.fn();
    const unsub = subscribeToMinuteClock(listener);

    unsub();
    vi.advanceTimersByTime(120_000);
    expect(listener).not.toHaveBeenCalled();
  });
});
