import Stripe from "stripe";

/**
 * Checkout provider interface (PR 24) — every Stripe interaction lives
 * behind this thin boundary so tests mock it and the app runs fully green
 * with NO keys configured.
 *
 * Gating contract (the spec's locked decision: "Checkout ships gated, not
 * fake"): `getCheckoutProvider()` returns null unless STRIPE_SECRET_KEY is
 * set. Callers treat null as "checkout not configured" and respond with the
 * honest 501 CHECKOUT_NOT_CONFIGURED envelope — never a fake session URL.
 * Going live is a user action: add STRIPE_SECRET_KEY via workspace
 * secrets / environment and the same code path activates.
 *
 * WEBHOOK UPGRADE PATH: this sandbox has no public webhook URL, so capacity
 * is confirmed poll-safe instead — the success redirect carries
 * `session_id` back to the map, which calls the confirm endpoint; the
 * server retrieves the session from Stripe and decrements capacity
 * idempotently (see SqliteStore.recordCheckoutPurchase). When the app is
 * deployed somewhere Stripe can reach, add a
 * `checkout.session.completed` webhook endpoint that calls the same
 * `recordCheckoutPurchase` and keep the redirect confirm as the fallback —
 * the idempotency table makes double-processing harmless.
 */

/** Parameters for one checkout session — everything pricing-related resolved. */
export type CheckoutSessionParams = {
  /** The stored show this purchase is for (session metadata + idempotency). */
  showId: string;
  /** Human-readable line-item name (artist — venue). */
  showTitle: string;
  /** Unit price in cents (the show's native_ticket_price dollars × 100). */
  unitAmountCents: number;
  /** Tickets in this purchase — capped at remaining capacity by the caller. */
  quantity: number;
  /** Absolute URLs; success_url should contain the {CHECKOUT_SESSION_ID} template. */
  successUrl: string;
  cancelUrl: string;
};

/** The two fields the client needs to hand the browser to Stripe. */
export type CheckoutSession = {
  id: string;
  url: string;
};

/** Server-side view of a session, for confirming the success redirect. */
export type CheckoutSessionStatus = {
  id: string;
  /** Stripe's payment_status: "paid" is the only value that decrements capacity. */
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  /** The metadata the session was created with (show_id, quantity). */
  metadata: Record<string, string>;
};

export interface CheckoutProvider {
  createSession(params: CheckoutSessionParams): Promise<CheckoutSession>;
  retrieveSession(sessionId: string): Promise<CheckoutSessionStatus>;
}

/** Stripe payment_status values we understand — anything else is rejected. */
const KNOWN_PAYMENT_STATUSES: Record<
  string,
  CheckoutSessionStatus["paymentStatus"]
> = {
  paid: "paid",
  unpaid: "unpaid",
  no_payment_required: "no_payment_required",
};

/**
 * Stripe-backed implementation. Constructed lazily — importing this module
 * never touches the network or requires a key.
 */
export class StripeCheckoutProvider implements CheckoutProvider {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          // Price is computed from the show record (dollars → cents), not
          // a Stripe Price object, so publishing a show is all the setup.
          price_data: {
            currency: "usd",
            unit_amount: params.unitAmountCents,
            product_data: { name: params.showTitle },
          },
          quantity: params.quantity,
          // The quantity selector lives in our drawer (capped at remaining
          // capacity server-side); Stripe's own adjuster stays off so the
          // recorded quantity always matches what capacity was decremented.
          adjustable_quantity: { enabled: false },
        },
      ],
      metadata: {
        show_id: params.showId,
        quantity: String(params.quantity),
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    if (!session.url) {
      throw new Error("Stripe returned a session without a URL.");
    }
    return { id: session.id, url: session.url };
  }

  async retrieveSession(sessionId: string): Promise<CheckoutSessionStatus> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    const paymentStatus = session.payment_status;
    // Stripe's PaymentStatus is a branded union that TypeScript can't
    // narrow against plain literals, so map through a validated table and
    // reject anything unknown rather than guessing.
    const mappedStatus = KNOWN_PAYMENT_STATUSES[paymentStatus];
    if (mappedStatus === undefined) {
      throw new Error(`Unexpected Stripe payment_status: ${paymentStatus}`);
    }
    return {
      id: session.id,
      paymentStatus: mappedStatus,
      metadata: (session.metadata ?? {}) as Record<string, string>,
    };
  }
}

/** Whether checkout is configured — the single gate every path consults. */
export function isCheckoutConfigured(): boolean {
  return (
    typeof process.env.STRIPE_SECRET_KEY === "string" &&
    process.env.STRIPE_SECRET_KEY.trim() !== ""
  );
}

let providerInstance: CheckoutProvider | null = null;

/**
 * Process-wide provider singleton. Null when STRIPE_SECRET_KEY is absent —
 * the caller answers 501 CHECKOUT_NOT_CONFIGURED rather than faking a URL.
 * Tests replace this with `setCheckoutProvider(mock)`.
 */
export function getCheckoutProvider(): CheckoutProvider | null {
  if (providerInstance !== null) {
    return providerInstance;
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (typeof key !== "string" || key.trim() === "") {
    return null;
  }
  providerInstance = new StripeCheckoutProvider(key);
  return providerInstance;
}

/** Test/ops hook: replace or clear the singleton (null restores env-based). */
export function setCheckoutProvider(provider: CheckoutProvider | null): void {
  providerInstance = provider;
}
