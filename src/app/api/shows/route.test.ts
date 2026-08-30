
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { generateApiKey } from "@/lib/server/apiKeys";
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
  // PR 22 additive fields — the client-geocoded point and council label.
  latitude: 30.2674,
  longitude: -97.7398,
  council_district: "District 9",
}

function postRequest(body: string, authHeader?: string): Request {
  return new Request("http://localhost:3000/api/shows", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authHeader === undefined ? {} : { authorization: authHeader }),
    },
    body,
  });
}

/** Registers an artist directly in the store and returns its raw key. */
function registerArtist(name: string): { key: string; id: string } {
  const generated = generateApiKey();
  const artist = mockedGetStore().insertArtist(
    name,
    generated.hash,
    generated.prefix,
  );
  return { key: generated.key, id: artist.id };
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
});

describe("POST /api/shows (PR 23 auth)", () => {
  it("returns the 401 AUTH_REQUIRED envelope without an Authorization header", async () => {
    const response = await POST(postRequest(JSON.stringify(VALID_SHOW)) as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(body.error).toBeTruthy();
    expect(mockedGetStore().listShows()).toHaveLength(0);
  });

  it("returns the 401 AUTH_INVALID envelope for an unknown key", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify(VALID_SHOW),
        "Bearer atxlive_ffffffffffffffffffffffffffffffffffffffffffffffff",
      ) as never,
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_INVALID");
    expect(mockedGetStore().listShows()).toHaveLength(0);
  });

  it("stamps the authenticated artist on the stored show, ignoring client-asserted identity", async () => {
    const { key, id } = registerArtist("The Night Owls");
    // The payload claims a different artist entirely — the server must win.
    const response = await POST(
      postRequest(JSON.stringify(VALID_SHOW), `Bearer ${key}`) as never,
    );
    expect(response.status).toBe(201);

    const stored = await response.json();
    expect(stored.artist_id).toBe(id);
    expect(stored.artist_name).toBe("The Night Owls");
    expect(stored.venue_name).toBe("Continental Club");

    const persisted = mockedGetStore().listShows()[0];
    expect(persisted.artist_id).toBe(id);
  });

  it("completes the register → write round-trip through the real endpoints", async () => {
    // Register through the actual register handler, then publish with the
    // minted key — the full PR 23 happy path with no test shortcuts.
    const { POST: register } = await import("../artists/register/route");
    const registration = await register(
      new Request("http://localhost:3000/api/artists/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artistName: "Glass House" }),
      }) as never,
    );
    expect(registration.status).toBe(201);
    const { apiKey } = await registration.json();

    const response = await POST(
      postRequest(JSON.stringify(VALID_SHOW), `Bearer ${apiKey}`) as never,
    );
    expect(response.status).toBe(201);

    const stored = await response.json();
    const artist = mockedGetStore().getArtistByKeyHash(
      (await import("@/lib/server/apiKeys")).hashApiKey(apiKey),
    );
    expect(stored.artist_id).toBe(artist?.id);
    expect(stored.artist_name).toBe("Glass House");
  });

  it("returns the 422 envelope for an invalid payload", async () => {
    const { key } = registerArtist("The Night Owls");
    const response = await POST(
      postRequest(
        JSON.stringify({ ...VALID_SHOW, district: "Central" }),
        `Bearer ${key}`,
      ) as never,
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
    const { key } = registerArtist("The Night Owls");
    const response = await POST(postRequest("{not json", `Bearer ${key}`) as never);
    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body.code).toBe("malformed_body");
    expect(body.error).toBeTruthy();
  });

  it("returns the 422 envelope for out-of-range coordinates", async () => {
    const { key } = registerArtist("The Night Owls");
    const response = await POST(
      postRequest(
        JSON.stringify({ ...VALID_SHOW, latitude: 91 }),
        `Bearer ${key}`,
      ) as never,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("invalid_coords");
    expect(mockedGetStore().listShows()).toHaveLength(0);
  });

  it("returns the 500 envelope when the store fails", async () => {
    const { key } = registerArtist("The Night Owls");
    mockedGetStore.mockReturnValue({
      // Auth must succeed so the failure lands on insertShow, not the gate.
      getArtistByKeyHash: (keyHash: string) => ({
        id: "artist-x",
        name: "The Night Owls",
        key_hash: keyHash,
        key_prefix: "",
      }),
      insertShow: () => {
        throw new Error("db down");
      },
    } as unknown as Store);

    const response = await POST(
      postRequest(JSON.stringify(VALID_SHOW), `Bearer ${key}`) as never,
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Failed to store the show.", code: "store_failure" });
  });
});

describe("GET /api/shows (public fan-map feed)", () => {
  it("lists stored shows newest first without credentials", async () => {
    const store = mockedGetStore();
    registerArtist("The Night Owls");
    store.insertShow({ ...VALID_SHOW, artist_id: "seeded" });
    store.insertShow({ ...VALID_SHOW, venue_name: "Mohawk", artist_id: "seeded", created_at: "2026-08-31T09:00:00.000Z" });

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
