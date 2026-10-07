import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
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

const BODY = {
  event: "royalty.report",
  event_id: "evt_dsp_1",
  source: "spotify",
  period: "2026-08",
  line_items: [
    {
      work_id: "trk_01",
      work_title: "Midnight On 6th",
      amount_cents: 10_000,
      splits: [
        {
          payee_id: "c1",
          payee_name: "Yeshua Throne",
          role: "creator",
          share_percent: 70,
        },
        {
          payee_id: "l1",
          payee_name: "Throne Records",
          role: "label",
          share_percent: 30,
        },
      ],
    },
  ],
};

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/webhooks/dsp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/v1/webhooks/dsp", () => {
  it("ingests a royalty report and replays idempotently", async () => {
    const created = await POST(post(BODY));
    expect(created.status).toBe(201);
    const payload = await created.json();
    expect(payload.split.split_run.gross_cents).toBe(10_000);
    const replay = await POST(post(BODY));
    expect(replay.status).toBe(200);
  });

  it("reverses a split run", async () => {
    const created = await POST(post(BODY));
    const body = await created.json();
    const reversed = await POST(
      post({
        event: "royalty.reversed",
        event_id: "evt_rev",
        split_run_id: body.split.split_run.id,
      }),
    );
    expect(reversed.status).toBe(201);
    expect((await reversed.json()).split_run.status).toBe("reversed");
  });

  it("returns 400 for malformed JSON and 422 for a bad event", async () => {
    expect((await POST(post("{"))).status).toBe(400);
    expect((await POST(post({ event: "payout.settled" }))).status).toBe(422);
  });

  it("returns 404 when reversing an unknown run", async () => {
    const response = await POST(
      post({ event: "royalty.reversed", split_run_id: "missing" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 500 when the store throws", async () => {
    mockedGetStore.mockReturnValue({
      getDspWebhookEvent: () => {
        throw new Error("db down");
      },
    } as unknown as Store);
    const response = await POST(post(BODY));
    expect(response.status).toBe(500);
  });
});
