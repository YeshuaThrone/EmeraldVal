import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { calculateUdrSplits } from "@/lib/server/udrSplits";
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

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/splits/reverse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/v1/splits/reverse", () => {
  it("reverses a posted split run", async () => {
    const split = await calculateUdrSplits(mockedGetStore(), {
      source: "spotify",
      period: "2026-08",
      currency: "USD",
      settle: false,
      rail: "rtp",
      line_items: [
        {
          work_id: "trk_01",
          work_title: "Midnight",
          amount_cents: 100,
          splits: [
            {
              payee_id: "c1",
              payee_name: "Yeshua Throne",
              role: "creator",
              share_bps: 10_000,
            },
          ],
        },
      ],
    });
    expect(split.ok).toBe(true);
    if (!split.ok) {
      return;
    }
    const response = await POST(post({ split_run_id: split.value.split_run.id }));
    expect(response.status).toBe(201);
    const replay = await POST(post({ split_run_id: split.value.split_run.id }));
    expect(replay.status).toBe(200);
  });

  it("returns 400/422/404 for bad payloads", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(422);
    expect((await POST(post({ split_run_id: "missing" }))).status).toBe(404);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      getSplitRun: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(post({ split_run_id: "x" }));
    expect(response.status).toBe(500);
  });
});
