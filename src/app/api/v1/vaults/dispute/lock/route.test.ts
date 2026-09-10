import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
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
  resetRateLimits();
});

describe("POST /api/v1/vaults/dispute/lock", () => {
  it("locks a vault and moves funds into reserve", async () => {
    creditVault(mockedGetStore(), "c1", "Yeshua Throne", 800, "available");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/dispute/lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payee_id: "c1", locked: true }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.frozen_cents).toBe(800);
    expect(body.dispute.locked).toBe(1);
  });

  it("returns 404 for a missing vault", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/dispute/lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payee_id: "ghost", locked: true }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/dispute/lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      getVault: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults/dispute/lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payee_id: "c1", locked: true }),
      }),
    );
    expect(response.status).toBe(500);
  });
});
