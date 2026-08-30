import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { generateApiKey } from "@/lib/server/apiKeys";
import { GET, POST } from "./route";
import type { ValidLivePingPayload } from "@/lib/validation";

// No network: the handler is invoked directly with the store swapped for
// an in-memory SQLite instance (or a throwing stub for the 500 path).
vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

const VALID_PING: ValidLivePingPayload = {
  artist_id: "artist-42",
  latitude: 30.2674,
  longitude: -97.7398,
  timestamp: "2026-08-30T20:00:00.000Z",
  status: "ON_STAGE",
};

function postRequest(body: string, authHeader?: string): Request {
  return new Request("http://localhost:3000/api/telemetry/live-ping", {
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

describe("POST /api/telemetry/live-ping (PR 23 auth)", () => {
  it("returns the 401 AUTH_REQUIRED envelope without an Authorization header", async () => {
    const response = await POST(postRequest(JSON.stringify(VALID_PING)) as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(body.error).toBeTruthy();
    expect(mockedGetStore().listLivePings()).toHaveLength(0);
  });

  it("returns the 401 AUTH_INVALID envelope for an unknown key", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify(VALID_PING),
        "Bearer atxlive_ffffffffffffffffffffffffffffffffffffffffffffffff",
      ) as never,
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_INVALID");
    expect(mockedGetStore().listLivePings()).toHaveLength(0);
  });

  it("stamps the authenticated artist on the stored ping, ignoring client-asserted identity", async () => {
    const { key, id } = registerArtist("The Night Owls");
    // The payload claims a different artist — the server must win.
    const response = await POST(
      postRequest(JSON.stringify(VALID_PING), `Bearer ${key}`) as never,
    );
    expect(response.status).toBe(201);

    const stored = await response.json();
    expect(stored.id).toBeTruthy();
    expect(stored.artist_id).toBe(id);
    expect(stored.status).toBe("ON_STAGE");

    const persisted = mockedGetStore().listLivePings()[0];
    expect(persisted.artist_id).toBe(id);
  });

  it("returns the 422 envelope for out-of-range coordinates", async () => {
    const { key } = registerArtist("The Night Owls");
    const response = await POST(
      postRequest(
        JSON.stringify({ ...VALID_PING, latitude: 91 }),
        `Bearer ${key}`,
      ) as never,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("invalid_coords");
    expect(body.error).toBeTruthy();
    expect(mockedGetStore().listLivePings()).toHaveLength(0);
  });

  it("returns the 400 envelope for a malformed JSON body", async () => {
    const { key } = registerArtist("The Night Owls");
    const response = await POST(postRequest("[[[", `Bearer ${key}`) as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("malformed_body");
  });

  it("returns the 500 envelope when the store fails", async () => {
    const { key } = registerArtist("The Night Owls");
    mockedGetStore.mockReturnValue({
      // Auth must succeed so the failure lands on insertLivePing, not the gate.
      getArtistByKeyHash: (keyHash: string) => ({
        id: "artist-x",
        name: "The Night Owls",
        key_hash: keyHash,
        key_prefix: "",
      }),
      insertLivePing: () => {
        throw new Error("db down");
      },
    } as unknown as Store);

    const response = await POST(
      postRequest(JSON.stringify(VALID_PING), `Bearer ${key}`) as never,
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: "Failed to store the live ping.",
      code: "store_failure",
    });
  });
});

describe("GET /api/telemetry/live-ping (public fan-map feed)", () => {
  it("lists stored pings newest first without credentials", async () => {
    const store = mockedGetStore();
    store.insertLivePing(VALID_PING);
    store.insertLivePing({
      ...VALID_PING,
      artist_id: "artist-7",
      timestamp: "2026-08-30T21:00:00.000Z",
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const pings = await response.json();
    expect(pings.map((p: { artist_id: string }) => p.artist_id)).toEqual([
      "artist-7",
      "artist-42",
    ]);
  });

  it("returns the 500 envelope when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      listLivePings: () => {
        throw new Error("db down");
      },
    } as unknown as Store);

    const response = await GET();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: "Failed to list live pings.",
      code: "store_failure",
    });
  });
});
