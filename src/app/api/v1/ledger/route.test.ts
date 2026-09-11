import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { GET } from "./route";

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

describe("GET /api/v1/ledger", () => {
  it("returns an empty immutable log", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/v1/ledger"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.journals).toEqual([]);
    expect(body.immutable.valid).toBe(true);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      listGlJournals: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await GET(
      new NextRequest("http://localhost:3000/api/v1/ledger"),
    );
    expect(response.status).toBe(500);
  });
});
