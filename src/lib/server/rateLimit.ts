/**
 * Light in-memory rate limiting for the registration endpoint (PR 23).
 *
 * Deliberately trivial: a fixed-window counter per client key, held in
 * process memory. Documented limits of this approach — it resets when the
 * server restarts and does not share state across serverless instances.
 * That is the right strength for a sandbox deployment (it stops a runaway
 * loop from flooding the artists table) without adding a dependency; a
 * shared store (Vercel KV) is the upgrade path when real hosting lands.
 */

export type RateLimitRule = {
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitVerdict = {
  ok: boolean;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfterSeconds: number;
};

const DEFAULT_RULE: RateLimitRule = { limit: 10, windowMs: 10 * 60_000 };

/** Registration is a rare, human-paced action — 10 per 10 minutes per IP. */
export const REGISTER_RATE_LIMIT: RateLimitRule = DEFAULT_RULE;

type WindowState = { count: number; windowStart: number };

const buckets = new Map<string, WindowState>();

/**
 * Counts one request against `identity` under `rule`. Pure in its inputs
 * except for the module-level bucket map — tests reset it via `resetRateLimits`.
 */
export function checkRateLimit(
  identity: string,
  rule: RateLimitRule = DEFAULT_RULE,
  now: number = Date.now(),
): RateLimitVerdict {
  const existing = buckets.get(identity);
  if (existing === undefined || now - existing.windowStart >= rule.windowMs) {
    buckets.set(identity, { count: 1, windowStart: now });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count <= rule.limit) {
    return { ok: true, retryAfterSeconds: 0 };
  }
  return {
    ok: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((existing.windowStart + rule.windowMs - now) / 1000),
    ),
  };
}

/** Test/ops hook: clear every counter. */
export function resetRateLimits(): void {
  buckets.clear();
}
