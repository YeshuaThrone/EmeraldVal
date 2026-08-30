
import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import {
  StripeCheckoutProvider,
  getCheckoutProvider,
  isCheckoutConfigured,
  setCheckoutProvider,
} from "./checkout";

// No network, no keys: the stripe module itself is mocked so the provider's
// parameter construction is asserted directly. The suite runs green with no
// STRIPE_SECRET_KEY present — that gating is itself under test.
const { createMock, retrieveMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  retrieveMock: vi.fn(),
}));

vi.mock("stripe", () => ({
  // Constructor-style: the provider calls `new Stripe(key)`, so the mock's
  // default export must be constructible, not a plain arrow function.
  default: vi.fn(function () {
    return {
      checkout: { sessions: { create: createMock, retrieve: retrieveMock } },
    };
  }),
}));

const mockedStripe = vi.mocked(Stripe);

const PARAMS = {
  showId: "show-1",
  showTitle: "The Night Owls — Continental Club",
  unitAmountCents: 2500,
  quantity: 2,
  successUrl:
    "http://localhost:3000/?checkout=success&show=show-1&session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "http://localhost:3000/?checkout=cancelled&show=show-1",
};

beforeEach(() => {
  createMock.mockReset();
  retrieveMock.mockReset();
  mockedStripe.mockClear();
  setCheckoutProvider(null);
  delete process.env.STRIPE_SECRET_KEY;
});

describe("checkout gating", () => {
  it("reports not configured without STRIPE_SECRET_KEY", () => {
    expect(isCheckoutConfigured()).toBe(false);
    expect(getCheckoutProvider()).toBeNull();
  });

  it("ignores a whitespace-only key", () => {
    process.env.STRIPE_SECRET_KEY = "   ";
    expect(isCheckoutConfigured()).toBe(false);
    expect(getCheckoutProvider()).toBeNull();
  });

  it("reports configured and builds a provider with the key", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(isCheckoutConfigured()).toBe(true);
    const provider = getCheckoutProvider();
    expect(provider).toBeInstanceOf(StripeCheckoutProvider);
    expect(mockedStripe).toHaveBeenCalledWith("sk_test_123");
  });

  it("memoizes the provider singleton", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(getCheckoutProvider()).toBe(getCheckoutProvider());
  });
});

describe("StripeCheckoutProvider.createSession", () => {
  it("sends cents, usd currency, show metadata, and both URLs", async () => {
    createMock.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    const provider = new StripeCheckoutProvider("sk_test_123");

    const session = await provider.createSession(PARAMS);

    expect(session).toEqual({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const params = createMock.mock.calls[0][0];
    expect(params.mode).toBe("payment");
    expect(params.line_items[0].price_data.currency).toBe("usd");
    // Price in cents from the show record — 25 dollars → 2500 cents.
    expect(params.line_items[0].price_data.unit_amount).toBe(2500);
    expect(params.line_items[0].price_data.product_data.name).toBe(
      PARAMS.showTitle,
    );
    expect(params.line_items[0].quantity).toBe(2);
    // Quantity is fixed by our drawer (capped server-side), not Stripe's.
    expect(params.line_items[0].adjustable_quantity).toEqual({
      enabled: false,
    });
    expect(params.metadata).toEqual({ show_id: "show-1", quantity: "2" });
    expect(params.success_url).toContain("{CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toContain("checkout=cancelled");
  });

  it("throws when Stripe returns a session without a URL", async () => {
    createMock.mockResolvedValue({ id: "cs_test_2", url: null });
    const provider = new StripeCheckoutProvider("sk_test_123");
    await expect(provider.createSession(PARAMS)).rejects.toThrow(
      /without a URL/,
    );
  });
});

describe("StripeCheckoutProvider.retrieveSession", () => {
  it("maps payment_status and metadata", async () => {
    retrieveMock.mockResolvedValue({
      id: "cs_test_3",
      payment_status: "paid",
      metadata: { show_id: "show-1", quantity: "2" },
    });
    const provider = new StripeCheckoutProvider("sk_test_123");

    const status = await provider.retrieveSession("cs_test_3");

    expect(status).toEqual({
      id: "cs_test_3",
      paymentStatus: "paid",
      metadata: { show_id: "show-1", quantity: "2" },
    });
    expect(retrieveMock).toHaveBeenCalledWith("cs_test_3");
  });

  it("treats missing metadata as an empty record", async () => {
    retrieveMock.mockResolvedValue({
      id: "cs_test_4",
      payment_status: "unpaid",
      metadata: null,
    });
    const provider = new StripeCheckoutProvider("sk_test_123");
    const status = await provider.retrieveSession("cs_test_4");
    expect(status.paymentStatus).toBe("unpaid");
    expect(status.metadata).toEqual({});
  });

  it("rejects an unexpected payment_status rather than guessing", async () => {
    retrieveMock.mockResolvedValue({
      id: "cs_test_5",
      payment_status: "something_new",
      metadata: {},
    });
    const provider = new StripeCheckoutProvider("sk_test_123");
    await expect(provider.retrieveSession("cs_test_5")).rejects.toThrow(
      /Unexpected Stripe payment_status/,
    );
  });
});
