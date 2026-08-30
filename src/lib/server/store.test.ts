import { beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "@/lib/server/store";
import type { ValidShowPayload } from "@/lib/validation";

// In-memory SQLite — no files, no network, fresh schema per test.
function newStore(): SqliteStore {
  return new SqliteStore(":memory:");
}

const SHOW_A: ValidShowPayload = {
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

const SHOW_B: ValidShowPayload = {
  ...SHOW_A,
  artist_id: "artist-7",
  artist_name: "Glass House",
  venue_name: "Mohawk",
  district: "Downtown",
  created_at: "2026-08-31T09:00:00.000Z",
};

const PING = {
  artist_id: "artist-42",
  latitude: 30.2674,
  longitude: -97.7398,
  timestamp: "2026-08-30T20:00:00.000Z",
  status: "ON_STAGE" as const,
};

let store: SqliteStore;

beforeEach(() => {
  store = newStore();
});

describe("shows", () => {
  it("round-trips a native-ticketing show with all fields intact", () => {
    const inserted = store.insertShow({
      ...SHOW_A,
      ticketing_type: "native",
      ticket_url: "",
      native_ticket_price: 15,
      native_ticket_capacity: 80,
    });

    expect(inserted.id).toBeTruthy();
    const [read] = store.listShows();
    expect(read).toEqual(inserted);
    expect(read.native_ticket_price).toBe(15);
    expect(read.native_ticket_capacity).toBe(80);
    expect(read.ticketing_type).toBe("native");
  });

  it("round-trips an external-ticketing show with null native fields", () => {
    const inserted = store.insertShow(SHOW_A);
    const [read] = store.listShows();
    expect(read).toEqual(inserted);
    expect(read.native_ticket_price).toBeNull();
    expect(read.native_ticket_capacity).toBeNull();
    expect(read.ticket_url).toBe("https://tickets.example.com/continental");
  });

  it("lists shows newest first, with insertion order as the tiebreak", () => {
    store.insertShow(SHOW_A);
    store.insertShow(SHOW_B);
    const shows = store.listShows();
    expect(shows.map((s) => s.venue_name)).toEqual(["Mohawk", "Continental Club"]);

    // Same created_at: the most recently inserted row still leads.
    store.insertShow({ ...SHOW_A, venue_name: "Empire", created_at: SHOW_B.created_at });
    const tied = store.listShows();
    expect(tied[0].venue_name).toBe("Empire");
  });

  it("caps listShows at the requested limit", () => {
    for (let i = 0; i < 5; i += 1) {
      store.insertShow({ ...SHOW_A, venue_name: `Venue ${i}` });
    }
    expect(store.listShows(3)).toHaveLength(3);
    expect(store.listShows()).toHaveLength(5);
  });

  it("rejects malformed input at the store boundary (NOT NULL constraints)", () => {
    // The route validators guarantee typed input; a malformed record reaching
    // the store is a programming error and must fail loudly, not silently.
    expect(() =>
      store.insertShow({} as unknown as ValidShowPayload),
    ).toThrow();
  });
});

describe("live pings", () => {
  it("round-trips a ping with all fields intact", () => {
    const inserted = store.insertLivePing(PING);
    expect(inserted.id).toBeTruthy();
    expect(inserted.status).toBe("ON_STAGE");

    const second = store.insertLivePing({ ...PING, artist_id: "artist-7" });
    expect(second.id).not.toBe(inserted.id);
  });
});

describe("artists (schema + CRUD stub for PR 23)", () => {
  it("round-trips insert and get", () => {
    const artist = store.insertArtist("The Night Owls", "2026-08-30T00:00:00.000Z");
    expect(artist.id).toBeTruthy();
    expect(artist.name).toBe("The Night Owls");

    const read = store.getArtist(artist.id);
    expect(read).toEqual(artist);
  });

  it("returns undefined for an unknown artist id", () => {
    expect(store.getArtist("no-such-id")).toBeUndefined();
  });
});
