import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { setBaasAdapter } from "@/services/baas";
import { creditVault } from "@/modules/vaults/engine";
import { POST } from "./route";

vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  setBaasAdapter(null);
  resetRateLimits();
});

describe("POST /api/v1/vaults/payout", () => {
  it("pays the full available_balance when amount is omitted", async () => {
    creditVault(mockedGetStore(), "c1", "Yeshua Throne", 2500, "available");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payee_id: "c1", rail: "rtp" }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.vault.available_balance).toBe(0);
    expect(body.transfer.amount_cents).toBe(2500);
  });

  it("returns 422 when available_balance is empty", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payee_id: "missing", amount_cents: 1 }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "nope",
      }),
    );
    expect(response.status).toBe(400);
  });
});
