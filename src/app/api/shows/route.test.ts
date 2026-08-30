import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { POST, GET } from "./route";
import type { ValidShowPayload } from "@/lib/validation";

// No network: handlers are invoked directly with the store swapped for an
// in-memory SQLite instance (or a throwing stub for the 500 path).
vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

const VALID_SHOW: ValidShowPayload = {
  artist_id: "artist-42",
  artist_name: "The Night Owls",
  venue_name: "Continental Club",
  address: "1315 S Congress Ave",
  district: "South",
  set_time: "2026-09-05T21:00:00.000Z",
  ticket_url: "https://tickets.example.com/continental",
  created_at: "2026-08-30T12:00:00.000Z",
  ticketing_type: "external",
  native_ticket_price: null,
  native_ticket_capacity: null,
};

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/shows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
});

describe("POST /api/shows", () => {
  it("creates a show and returns it with an id (201)", async () => {
    const response = await POST(postRequest(JSON.stringify(VALID_SHOW)) as never);
    expect(response.status).toBe(201);

    const stored = await response.json();
    expect(stored.id).toBeTruthy();
    expect(stored).toMatchObject(VALID_SHOW);

    // The show actually landed in the store.
    expect(mockedGetStore().listShows()).toHaveLength(1);
  });

  it("returns the 422 envelope for an invalid payload", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...VALID_SHOW, district: "Central" })) as never,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toEqual({
      error: "district must be one of the five Austin districts.",
      code: "invalid_district",
    });
    expect(mockedGetStore().listShows()).toHaveLength(0);
  });

  it("returns the 400 envelope for a malformed JSON body", async () => {
    const response = await POST(postRequest("{not json") as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("malformed_body");
    expect(body.error).toBeTruthy();
  });

  it("returns the 500 envelope when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      insertShow: () => {
        throw new Error("db down");
      },
    } as unknown as Store);

    const response = await POST(postRequest(JSON.stringify(VALID_SHOW)) as never);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Failed to store the show.", code: "store_failure" });
  });
});

describe("GET /api/shows", () => {
  it("lists stored shows newest first", async () => {
    const store = mockedGetStore();
    store.insertShow(VALID_SHOW);
    store.insertShow({ ...VALID_SHOW, venue_name: "Mohawk", created_at: "2026-08-31T09:00:00.000Z" });

    const response = await GET();
    expect(response.status).toBe(200);
    const shows = await response.json();
    expect(shows.map((s: { venue_name: string }) => s.venue_name)).toEqual([
      "Mohawk",
      "Continental Club",
    ]);
  });

  it("returns the 500 envelope when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      listShows: () => {
        throw new Error("db down");
      },
    } as unknown as Store);

    const response = await GET();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Failed to list shows.", code: "store_failure" });
  });
});
