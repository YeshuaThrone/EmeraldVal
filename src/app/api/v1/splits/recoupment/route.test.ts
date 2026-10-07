import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
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

describe("POST /api/v1/splits/recoupment", () => {
  it("records an unearned advance", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/splits/recoupment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creator_id: "c1",
          creator_name: "Yeshua Throne",
          recoupment_target_cents: 50_000,
          recoupment_bps: 5000,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.recoupment_target_cents).toBe(50_000);
    expect(body.recoupment_bps).toBe(5000);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/splits/recoupment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      getRecoupmentAdvance: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(
      new NextRequest("http://localhost:3000/api/v1/splits/recoupment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creator_id: "c1",
          recoupment_target_cents: 100,
        }),
      }),
    );
    expect(response.status).toBe(500);
  });
});

describe("GET /api/v1/splits/recoupment", () => {
  it("reads the current advance snapshot", async () => {
    await POST(
      new NextRequest("http://localhost:3000/api/v1/splits/recoupment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creator_id: "c1",
          recoupment_target_cents: 1000,
        }),
      }),
    );
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/v1/splits/recoupment?creator_id=c1",
      ),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).active).toBe(true);
  });

  it("requires creator_id", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/v1/splits/recoupment"),
    );
    expect(response.status).toBe(422);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      getRecoupmentAdvance: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/v1/splits/recoupment?creator_id=c1",
      ),
    );
    expect(response.status).toBe(500);
  });
});
