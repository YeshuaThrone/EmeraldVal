import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStore, SqliteStore } from "@/lib/server/store";
import { POST } from "./route";
import type { ValidLivePingPayload } from "@/lib/validation";

// No network: the handler is invoked directly with the store swapped for
// an in-memory SQLite instance.
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

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/telemetry/live-ping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  mockedGetStore.mockReset();
  mockedGetStore.mockReturnValue(new SqliteStore(":memory:"));
});

describe("POST /api/telemetry/live-ping", () => {
  it("persists a valid ping and returns it with an id (201)", async () => {
    const response = await POST(postRequest(JSON.stringify(VALID_PING)) as never);
    expect(response.status).toBe(201);

    const stored = await response.json();
    expect(stored.id).toBeTruthy();
    expect(stored).toMatchObject(VALID_PING);
  });

  it("returns the 422 envelope for out-of-range coordinates", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...VALID_PING, latitude: 91 })) as never,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("invalid_coords");
    expect(body.error).toBeTruthy();
  });

  it("returns the 400 envelope for a malformed JSON body", async () => {
    const response = await POST(postRequest("[[[") as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("malformed_body");
  });

  it("returns the 500 envelope when the store fails", async () => {
    mockedGetStore.mockReturnValue({
      insertLivePing: () => {
        throw new Error("db down");
      },
    } as never);

    const response = await POST(postRequest(JSON.stringify(VALID_PING)) as never);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: "Failed to store the live ping.",
      code: "store_failure",
    });
  });
});
