import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  REGISTER_RATE_LIMIT,
  resetRateLimits,
} from "@/lib/server/rateLimit";

afterEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit and blocks past it", () => {
    const now = 1_000_000;
    for (let i = 0; i < REGISTER_RATE_LIMIT.limit; i += 1) {
      expect(checkRateLimit("ip-1", REGISTER_RATE_LIMIT, now).ok).toBe(true);
    }
    const blocked = checkRateLimit("ip-1", REGISTER_RATE_LIMIT, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks identities independently", () => {
    const now = 1_000_000;
    for (let i = 0; i < REGISTER_RATE_LIMIT.limit; i += 1) {
      checkRateLimit("ip-1", REGISTER_RATE_LIMIT, now);
    }
    expect(checkRateLimit("ip-1", REGISTER_RATE_LIMIT, now).ok).toBe(false);
    expect(checkRateLimit("ip-2", REGISTER_RATE_LIMIT, now).ok).toBe(true);
  });

  it("opens a fresh window after windowMs elapses", () => {
    const start = 1_000_000;
    for (let i = 0; i < REGISTER_RATE_LIMIT.limit; i += 1) {
      checkRateLimit("ip-1", REGISTER_RATE_LIMIT, start);
    }
    expect(
      checkRateLimit("ip-1", REGISTER_RATE_LIMIT, start + 1).ok,
    ).toBe(false);
    expect(
      checkRateLimit(
        "ip-1",
        REGISTER_RATE_LIMIT,
        start + REGISTER_RATE_LIMIT.windowMs,
      ).ok,
    ).toBe(true);
  });

  it("reports retry-after as the seconds remaining in the window", () => {
    const start = 1_000_000;
    for (let i = 0; i < REGISTER_RATE_LIMIT.limit; i += 1) {
      checkRateLimit("ip-1", REGISTER_RATE_LIMIT, start);
    }
    const blocked = checkRateLimit(
      "ip-1",
      REGISTER_RATE_LIMIT,
      start + 30_000,
    );
    expect(blocked.retryAfterSeconds).toBe(
      Math.ceil((start + REGISTER_RATE_LIMIT.windowMs - (start + 30_000)) / 1000),
    );
  });
});
