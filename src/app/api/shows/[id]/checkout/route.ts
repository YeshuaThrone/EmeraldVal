import { NextRequest, NextResponse } from "next/server";
import { getCheckoutProvider } from "@/lib/server/checkout";
import { getStore } from "@/lib/server/store";
import { jsonError } from "@/lib/server/http";

/**
 * Native-ticketing checkout (PR 24) — gated on STRIPE_SECRET_KEY.
 *
 * POST /api/shows/[id]/checkout — create a Stripe Checkout Session for a
 * native-ticketing show. Body: { quantity?: number } (default 1, capped at
 * remaining capacity). Returns { id, url } — the client opens `url` in a
 * new tab. Without the key: 501 {error, code: "checkout_not_configured"} —
 * never a fake URL (the spec's locked "gated, not fake" decision).
 *
 * GET /api/shows/[id]/checkout?session_id=… — poll-safe success-redirect
 * confirmation. The sandbox has no public webhook URL, so instead of
 * relying on checkout.session.completed webhooks the map's success
 * redirect carries session_id back here; the server retrieves the session
 * from Stripe, and only payment_status "paid" decrements capacity —
 * idempotently, via the checkout_sessions table (a repeated confirm is a
 * no-op). See src/lib/server/checkout.ts for the webhook upgrade path.
 *
 * Failure paths all return the typed envelope {error, code}.
 */

/** Parses and validates the purchase quantity from the request body. */
function parseQuantity(body: unknown): number | "invalid" {
  if (body === undefined || body === null) {
    return 1;
  }
  if (
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof (body as { quantity?: unknown }).quantity !== "number"
  ) {
    return "invalid";
  }
  const quantity = (body as { quantity: number }).quantity;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return "invalid";
  }
  return quantity;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown = undefined;
  const rawBody = await request.text();
  if (rawBody !== "") {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError(
        400,
        "malformed_body",
        "Request body must be valid JSON.",
      );
    }
  }
  const quantity = parseQuantity(body);
  if (quantity === "invalid") {
    return jsonError(
      422,
      "invalid_quantity",
      "Quantity must be a whole number of at least 1.",
    );
  }

  const show = getStore().getShow(id);
  if (show === undefined) {
    return jsonError(404, "show_not_found", "That show doesn't exist.");
  }
  if (
    show.ticketing_type !== "native" ||
    show.native_ticket_price === null ||
    show.native_ticket_capacity === null
  ) {
    return jsonError(
      422,
      "not_native_ticketing",
      "Checkout is only available for native-ticketing shows.",
    );
  }
  const remaining = show.native_ticket_capacity;
  if (remaining <= 0) {
    return jsonError(409, "sold_out", "This show is sold out.");
  }

  const provider = getCheckoutProvider();
  if (provider === null) {
    return jsonError(
      501,
      "checkout_not_configured",
      "Checkout isn't configured yet — the venue owner needs to add STRIPE_SECRET_KEY.",
    );
  }

  // Quantity is capped at remaining capacity server-side; the client's
  // selector is a convenience, never the source of truth.
  const cappedQuantity = Math.min(quantity, remaining);
  const origin = request.nextUrl.origin;
  const priceCents = Math.round(show.native_ticket_price * 100);

  try {
    const session = await provider.createSession({
      showId: show.id,
      showTitle: `${show.artist_name} — ${show.venue_name}`,
      unitAmountCents: priceCents,
      quantity: cappedQuantity,
      // {CHECKOUT_SESSION_ID} is Stripe's template — the redirect carries
      // the real session id back to the map, which confirms it via GET.
      successUrl: `${origin}/?checkout=success&show=${show.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/?checkout=cancelled&show=${show.id}`,
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return jsonError(
      502,
      "checkout_provider_error",
      "The payment provider couldn't start this checkout. Try again.",
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (sessionId === null || sessionId.trim() === "") {
    return jsonError(
      400,
      "missing_session_id",
      "Confirmation requires the ?session_id= parameter from the success redirect.",
    );
  }

  const provider = getCheckoutProvider();
  if (provider === null) {
    return jsonError(
      501,
      "checkout_not_configured",
      "Checkout isn't configured yet — the venue owner needs to add STRIPE_SECRET_KEY.",
    );
  }

  let status;
  try {
    status = await provider.retrieveSession(sessionId);
  } catch (error) {
    console.error("Failed to retrieve checkout session:", error);
    return jsonError(
      502,
      "checkout_provider_error",
      "Couldn't verify this checkout with the payment provider.",
    );
  }

  if (status.paymentStatus !== "paid") {
    // Not an error — the user may have landed here before payment settled.
    // No capacity was touched; the client keeps its current view.
    return NextResponse.json({
      confirmed: false,
      paymentStatus: status.paymentStatus,
    });
  }

  const quantity = Number.parseInt(status.metadata.quantity ?? "1", 10);
  const result = getStore().recordCheckoutPurchase(
    sessionId,
    id,
    Number.isInteger(quantity) && quantity >= 1 ? quantity : 1,
  );
  if (result === null) {
    return jsonError(404, "show_not_found", "That show doesn't exist.");
  }
  if (result.outcome === "insufficient_capacity") {
    return NextResponse.json(
      {
        error:
          "Payment succeeded but this show just sold out — the venue owes you a refund or a spot.",
        code: "capacity_exhausted",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({
    confirmed: true,
    remaining: result.remaining,
    alreadyRecorded: result.outcome === "already_recorded",
  });
}
