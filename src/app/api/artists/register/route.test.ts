import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import type { Store } from "@/lib/server/store";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { hashApiKey } from "@/lib/server/apiKeys";
import { POST } from "./route";

// No network: the handler is invoked directly with the store swapped for
// an in-memory SQLite instance (or a throwing stub for the 500 path).
vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/artists/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
  resetRateLimits();
});

describe("POST /api/artists/register", () => {
  it("mints a key, returns it exactly once, and stores only the hash", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ artistName: "The Night Owls" })) as never,
    );
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.artistName).toBe("The Night Owls");
    expect(body.keyPrefix).toMatch(/^atxlive_/);
    expect(body.apiKey).toMatch(/^atxlive_[0-9a-f]{48}$/);

    // Hash at rest: the stored row carries the SHA-256 digest and the
    // display prefix — the raw key appears nowhere in the database.
    const store = mockedGetStore();
    const artist = store.getArtist(body.id);
    expect(artist).toBeDefined();
    expect(artist?.key_hash).toBe(hashApiKey(body.apiKey));
    expect(artist?.key_prefix).toBe(body.keyPrefix);
    expect(JSON.stringify(store.getArtist(body.id))).not.toContain(body.apiKey);
  });

  it("gives duplicate names distinct identities and distinct keys", async () => {
    const first = await POST(
      postRequest(JSON.stringify({ artistName: "Duo" })) as never,
    );
    const second = await POST(
      postRequest(JSON.stringify({ artistName: "Duo" })) as never,
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.id).not.toBe(secondBody.id);
    expect(firstBody.apiKey).not.toBe(secondBody.apiKey);

    const store = mockedGetStore();
    expect(store.getArtistByKeyHash(hashApiKey(firstBody.apiKey))?.id).toBe(
      firstBody.id,
    );
    expect(store.getArtistByKeyHash(hashApiKey(secondBody.apiKey))?.id).toBe(
      secondBody.id,
    );
  });

  it("returns the 422 envelope for a missing or blank artist name", async () => {
    for (const body of [{}, { artistName: "   " }, { artistName: 42 }]) {
      const response = await POST(postRequest(JSON.stringify(body)) as never);
      expect(response.status).toBe(422);
      const envelope = await response.json();
      expect(envelope.code).toBe("invalid_artist_name");
      expect(envelope.error).toBeTruthy();
    }
  });

  it("returns the 400 envelope for a malformed JSON body", async () => {
    const response = await POST(postRequest("{not json") as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("malformed_body");
  });

  it("rate-limits runaway registration from one address", async () => {
    // Exhaust the production rule for the route's fallback identity
    // (no forwarded headers in a bare Request → "unknown").
    const { checkRateLimit, REGISTER_RATE_LIMIT } = await import(
      "@/lib/server/rateLimit"
    );
    for (let i = 0; i < REGISTER_RATE_LIMIT.limit; i += 1) {
      checkRateLimit("register:unknown", REGISTER_RATE_LIMIT);
    }

    const response = await POST(
      postRequest(JSON.stringify({ artistName: "Spam Band" })) as never,
    );
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.code).toBe("rate_limited");
  });

  it("returns the 500 envelope when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      insertArtist: () => {
        throw new Error("db down");
      },
    } as unknown as Store);

    const response = await POST(
      postRequest(JSON.stringify({ artistName: "The Night Owls" })) as never,
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: "Failed to register the artist.",
      code: "store_failure",
    });
  });
});
