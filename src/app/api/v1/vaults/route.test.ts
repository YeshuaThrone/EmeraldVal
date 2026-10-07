import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { creditVault } from "@/modules/vaults/engine";
import { GET, POST } from "./route";

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

describe("GET /api/v1/vaults", () => {
  it("lists vaults and fetches one by payee_id", async () => {
    creditVault(mockedGetStore(), "c1", "Yeshua Throne", 500, "pending");
    const listed = await GET(
      new NextRequest("http://localhost:3000/api/v1/vaults"),
    );
    expect((await listed.json()).vaults).toHaveLength(1);
    const one = await GET(
      new NextRequest("http://localhost:3000/api/v1/vaults?payee_id=c1"),
    );
    expect((await one.json()).pending_balance).toBe(500);
  });

  it("returns 404 for a missing payee", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/v1/vaults?payee_id=ghost"),
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/vaults", () => {
  it("releases pending into available", async () => {
    creditVault(mockedGetStore(), "c1", "Yeshua Throne", 500, "pending");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "release", payee_id: "c1" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.vault.available_balance).toBe(500);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/vaults", {
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
      new NextRequest("http://localhost:3000/api/v1/vaults", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "release", payee_id: "c1" }),
      }),
    );
    expect(response.status).toBe(500);
  });
});
