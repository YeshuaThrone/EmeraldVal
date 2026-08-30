import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import { generateApiKey } from "@/lib/server/apiKeys";
import { GET } from "./route";

// No network: the handler is invoked directly with the store swapped for
// an in-memory SQLite instance.
vi.mock("@/lib/server/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/store")>();
  return { ...actual, getStore: vi.fn() };
});

const mockedGetStore = vi.mocked(getStore);

function getRequest(authHeader?: string): Request {
  return new Request("http://localhost:3000/api/artists/verify", {
    method: "GET",
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  });
}

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

describe("GET /api/artists/verify", () => {
  it("resolves a valid key to the safe profile", async () => {
    const { key, id } = registerArtist("The Night Owls");
    const response = await GET(getRequest(`Bearer ${key}`) as never);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(id);
    expect(body.artistName).toBe("The Night Owls");
    expect(body.keyPrefix).toMatch(/^atxlive_/);
    // The raw key can never come back — the server only has the hash.
    expect(JSON.stringify(body)).not.toContain(key);
  });

  it("returns the 401 AUTH_REQUIRED envelope without a header", async () => {
    const response = await GET(getRequest() as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(body.error).toBeTruthy();
  });

  it("returns the 401 AUTH_REQUIRED envelope for a malformed header", async () => {
    const response = await GET(getRequest("Token atxlive_abc") as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns the 401 AUTH_INVALID envelope for an unknown key", async () => {
    const response = await GET(
      getRequest(
        "Bearer atxlive_ffffffffffffffffffffffffffffffffffffffffffffffff",
      ) as never,
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("AUTH_INVALID");
    expect(body.error).toBeTruthy();
  });
});
