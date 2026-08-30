import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import {
  setCheckoutProvider,
  type CheckoutProvider,
} from "@/lib/server/checkout";
import type { ValidShowPayload } from "@/lib/validation";
import { POST, GET } from "./route";

// No network, no keys: handlers are invoked directly with the store swapped
// for an in-memory SQLite instance and the checkout provider for a stub
// (the same singleton seam production uses for the env-based instance).
vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

const NATIVE_SHOW: ValidShowPayload = {
  artist_id: "artist-42",
  artist_name: "The Night Owls",
  venue_name: "Continental Club",
  address: "1315 S Congress Ave",
  district: "South",
  set_time: "2026-09-05T21:00:00.000Z",
  ticket_url: "",
  created_at: "2026-08-30T12:00:00.000Z",
  ticketing_type: "native",
  native_ticket_price: 25,
  native_ticket_capacity: 4,
  latitude: 30.2674,
  longitude: -97.7398,
  council_district: "District 9",
};

const EXTERNAL_SHOW: ValidShowPayload = {
  ...NATIVE_SHOW,
  ticketing_type: "external",
  native_ticket_price: null,
  native_ticket_capacity: null,
};

function makeProviderMock(): CheckoutProvider {
  return {
    createSession: vi.fn(),
    retrieveSession: vi.fn(),
  };
}

function postRequest(id: string, body?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/shows/${id}/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body } : {}),
  });
}

function confirmRequest(id: string, sessionId?: string): NextRequest {
  const query = sessionId === undefined ? "" : `?session_id=${sessionId}`;
  return new NextRequest(
    `http://localhost:3000/api/shows/${id}/checkout${query}`,
  );
}

async function insertShow(payload: ValidShowPayload): Promise<string> {
  const stored = mockedGetStore().insertShow(payload);
  return stored.id;
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  setCheckoutProvider(null);
  delete process.env.STRIPE_SECRET_KEY;
});

describe("POST /api/shows/[id]/checkout", () => {
  it("returns the 501 envelope without STRIPE_SECRET_KEY — never a fake URL", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const response = await POST(postRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: expect.any(String),
      code: "checkout_not_configured",
    });
  });

  it("404s for an unknown show", async () => {
    const response = await POST(postRequest("nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "show_not_found",
    });
  });

  it("422s for a non-native-ticketing show", async () => {
    const id = await insertShow(EXTERNAL_SHOW);
    const response = await POST(postRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "not_native_ticketing",
    });
  });

  it("409s for a sold-out show", async () => {
    const id = await insertShow({ ...NATIVE_SHOW, native_ticket_capacity: 0 });
    const response = await POST(postRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "sold_out" });
  });

  it("422s for a non-integer quantity", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const response = await POST(postRequest(id, '{"quantity":1.5}'), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_quantity",
    });
  });

  it("creates a session with cents, usd, show metadata, and map URLs", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const provider = makeProviderMock();
    (provider.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs_test_9",
      url: "https://checkout.stripe.com/c/pay/cs_test_9",
    });
    setCheckoutProvider(provider);

    const response = await POST(postRequest(id, '{"quantity":2}'), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "cs_test_9",
      url: "https://checkout.stripe.com/c/pay/cs_test_9",
    });

    expect(provider.createSession).toHaveBeenCalledTimes(1);
    const params = (provider.createSession as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(params.showId).toBe(id);
    // Price in cents from the show record: 25 dollars → 2500 cents.
    expect(params.unitAmountCents).toBe(2500);
    expect(params.quantity).toBe(2);
    expect(params.successUrl).toContain("checkout=success");
    expect(params.successUrl).toContain(`show=${id}`);
    expect(params.successUrl).toContain("{CHECKOUT_SESSION_ID}");
    expect(params.cancelUrl).toContain("checkout=cancelled");
  });

  it("caps the requested quantity at remaining capacity", async () => {
    const id = await insertShow({ ...NATIVE_SHOW, native_ticket_capacity: 3 });
    const provider = makeProviderMock();
    (provider.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs",
      url: "https://s",
    });
    setCheckoutProvider(provider);

    await POST(postRequest(id, '{"quantity":10}'), {
      params: Promise.resolve({ id }),
    });
    expect(
      (provider.createSession as ReturnType<typeof vi.fn>).mock.calls[0][0]
        .quantity,
    ).toBe(3);
  });
});

describe("GET /api/shows/[id]/checkout (success-redirect confirm)", () => {
  it("400s without a session_id", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const response = await GET(confirmRequest(id), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "missing_session_id",
    });
  });

  it("501s without STRIPE_SECRET_KEY", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const response = await GET(confirmRequest(id, "cs_1"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      code: "checkout_not_configured",
    });
  });

  it("decrements capacity once on a paid session and is idempotent on repeat", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const provider = makeProviderMock();
    (provider.retrieveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs_paid",
      paymentStatus: "paid",
      metadata: { show_id: id, quantity: "2" },
    });
    setCheckoutProvider(provider);

    const first = await GET(confirmRequest(id, "cs_paid"), {
      params: Promise.resolve({ id }),
    });
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      confirmed: true,
      remaining: 2,
      alreadyRecorded: false,
    });

    // Poll-safe: the redirect may hit the endpoint again — no double decrement.
    const repeat = await GET(confirmRequest(id, "cs_paid"), {
      params: Promise.resolve({ id }),
    });
    expect(repeat.status).toBe(200);
    await expect(repeat.json()).resolves.toEqual({
      confirmed: true,
      remaining: 2,
      alreadyRecorded: true,
    });
    expect(mockedGetStore().getShow(id)?.native_ticket_capacity).toBe(2);
  });

  it("does not decrement an unpaid session", async () => {
    const id = await insertShow(NATIVE_SHOW);
    const provider = makeProviderMock();
    (provider.retrieveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs_unpaid",
      paymentStatus: "unpaid",
      metadata: {},
    });
    setCheckoutProvider(provider);

    const response = await GET(confirmRequest(id, "cs_unpaid"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      confirmed: false,
      paymentStatus: "unpaid",
    });
    expect(mockedGetStore().getShow(id)?.native_ticket_capacity).toBe(4);
  });

  it("rejects a paid session for a show with no remaining capacity", async () => {
    const id = await insertShow({ ...NATIVE_SHOW, native_ticket_capacity: 1 });
    const provider = makeProviderMock();
    (provider.retrieveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs_late",
      paymentStatus: "paid",
      metadata: { show_id: id, quantity: "2" },
    });
    setCheckoutProvider(provider);

    const response = await GET(confirmRequest(id, "cs_late"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "capacity_exhausted",
    });
    // The session row is recorded so retries stay no-ops.
    expect(mockedGetStore().getShow(id)?.native_ticket_capacity).toBe(1);
  });
});
