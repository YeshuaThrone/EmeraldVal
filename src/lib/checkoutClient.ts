import { requestJson } from "@/lib/transport";

/**
 * Client-side checkout calls (PR 24) — the fan-map side of the gated
 * Stripe checkout. Same never-throw contract as the rest of the transport
 * layer: every failure resolves to a typed result so the drawer can render
 * themed inline feedback instead of crashing.
 *
 * Framework-agnostic: no React imports.
 */

export type CheckoutStartResult =
  | { ok: true; url: string }
  | { ok: false; error: string; code?: string };

export type CheckoutConfirmResult =
  | { ok: true; confirmed: boolean; remaining?: number }
  | { ok: false; error: string; code?: string };

/**
 * Asks the server whether checkout is configured (STRIPE_SECRET_KEY set).
 * Any failure — network, non-2xx, unexpected body — means "not enabled":
 * the map then keeps the data-only treatment, which is the honest default.
 */
export async function fetchCheckoutStatus(): Promise<boolean> {
  const result = await requestJson("/api/checkout-status");
  if (!result.ok) {
    return false;
  }
  return (
    typeof result.body === "object" &&
    result.body !== null &&
    (result.body as { enabled?: unknown }).enabled === true
  );
}

/**
 * Starts checkout for a native-ticketing show: POST returns the Stripe
 * Checkout Session URL, which the caller opens in a new tab. A 501
 * (checkout_not_configured) surfaces as a typed failure — the button
 * should not have been visible, but the failure stays honest.
 */
export async function startCheckout(
  showId: string,
  quantity: number,
): Promise<CheckoutStartResult> {
  const result = await requestJson(
    `/api/shows/${encodeURIComponent(showId)}/checkout`,
    {
      method: "POST",
      body: { quantity },
    },
  );
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.serverCode !== undefined ? { code: result.serverCode } : {}),
    };
  }
  const url =
    typeof result.body === "object" &&
    result.body !== null &&
    typeof (result.body as { url?: unknown }).url === "string"
      ? (result.body as { url: string }).url
      : null;
  if (url === null) {
    return { ok: false, error: "Server returned an unexpected response." };
  }
  return { ok: true, url };
}

/**
 * Confirms a success-redirect checkout server-side (poll-safe capacity
 * accounting — see src/app/api/shows/[id]/checkout/route.ts). Never
 * throws; the caller decides what to show based on `confirmed`.
 */
export async function confirmCheckout(
  showId: string,
  sessionId: string,
): Promise<CheckoutConfirmResult> {
  const result = await requestJson(
    `/api/shows/${encodeURIComponent(showId)}/checkout?session_id=${encodeURIComponent(sessionId)}`,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.serverCode !== undefined ? { code: result.serverCode } : {}),
    };
  }
  const body = result.body as { confirmed?: unknown; remaining?: unknown };
  if (typeof body?.confirmed !== "boolean") {
    return { ok: false, error: "Server returned an unexpected response." };
  }
  return {
    ok: true,
    confirmed: body.confirmed,
    ...(typeof body.remaining === "number" ? { remaining: body.remaining } : {}),
  };
}
