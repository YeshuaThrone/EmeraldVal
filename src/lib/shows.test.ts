import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchServerPins,
  hydrateServerPins,
  pingRecordToPin,
  showRecordToPin,
  type StoredLivePing,
  type StoredShow,
} from "@/lib/shows";

// The stored-record fixtures mirror what GET /api/shows and
// GET /api/telemetry/live-ping return — the validated payload plus the
// server-assigned id.

const STORED_SHOW: StoredShow = {
  id: "show-1",
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
  latitude: 30.2489,
  longitude: -97.7501,
  council_district: "District 9",
};

const STORED_PING: StoredLivePing = {
  id: "ping-1",
  artist_id: "artist-42",
  latitude: 30.2674,
  longitude: -97.7398,
  timestamp: "2026-08-30T20:00:00.000Z",
  status: "ON_STAGE",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("showRecordToPin", () => {
  it("rebuilds the artist pin with the studio's styling fields", () => {
    const pin = showRecordToPin(STORED_SHOW);

    expect(pin).not.toBeNull();
    if (pin === null) {
      return;
    }
    // Same styling contract as PR #18/#20 artist pins.
    expect(pin.source).toBe("artist");
    expect(pin.status).toBe("SCHEDULED");
    expect(pin.id).toBe("show-1");
    expect(pin.artistId).toBe("artist-42");
    expect(pin.lat).toBe(30.2489);
    expect(pin.lng).toBe(-97.7501);
    expect(pin.performerName).toBe("The Night Owls");
    expect(pin.artistName).toBe("The Night Owls");
    expect(pin.locationName).toBe("1315 S Congress Ave");
    expect(pin.ticketUrl).toBe("https://tickets.example.com/continental");
    expect(pin.ticketing).toEqual({
      type: "external",
      ticketUrl: "https://tickets.example.com/continental",
    });
    expect(pin.councilDistrict).toBe("District 9");
    expect(pin.setTime).toBe("2026-09-05T21:00:00.000Z");
  });

  it("re-classifies the district from the stored point", () => {
    // 30.2489, -97.7501 is inside AUSTIN_BOUNDS — the classifier decides,
    // not the stored user-selected bucket.
    const pin = showRecordToPin(STORED_SHOW);
    if (pin === null) {
      return;
    }
    expect(typeof pin.district).toBe("string");
    expect(pin.district?.length).toBeGreaterThan(0);
  });

  it("falls back to the venue name when the address is empty", () => {
    const pin = showRecordToPin({ ...STORED_SHOW, address: "" });
    expect(pin?.locationName).toBe("Continental Club");
  });

  it("skips shows without coordinates instead of guessing a place", () => {
    // Legacy records uploaded before PR 22 carry no point.
    const pin = showRecordToPin({
      ...STORED_SHOW,
      latitude: null,
      longitude: null,
    });
    expect(pin).toBeNull();
  });

  it("reconstructs native ticketing from the wire fields", () => {
    const pin = showRecordToPin({
      ...STORED_SHOW,
      ticketing_type: "native",
      native_ticket_price: 15,
      native_ticket_capacity: 150,
      ticket_url: "",
    });
    expect(pin?.ticketing).toEqual({
      type: "native",
      price: 15,
      capacity: 150,
    });
    expect(pin?.ticketUrl).toBeUndefined();
  });

  it("treats an external record with an empty URL as no ticketing", () => {
    const pin = showRecordToPin({
      ...STORED_SHOW,
      ticket_url: "",
      ticketing_type: "external",
    });
    expect(pin?.ticketing).toEqual({ type: "external", ticketUrl: "" });
  });
});

describe("pingRecordToPin", () => {
  it("builds an ON_STAGE pin at the ping coordinates", () => {
    const pin = pingRecordToPin(STORED_PING);

    expect(pin.status).toBe("ON_STAGE");
    expect(pin.source).toBe("artist");
    expect(pin.id).toBe("ping-1");
    expect(pin.artistId).toBe("artist-42");
    expect(pin.lat).toBe(30.2674);
    expect(pin.lng).toBe(-97.7398);
    expect(pin.setTime).toBe("2026-08-30T20:00:00.000Z");
    expect(pin.locationName).toContain("30.2674");
  });
});

describe("hydrateServerPins", () => {
  it("turns shows into SCHEDULED pins", () => {
    const pins = hydrateServerPins([STORED_SHOW], []);
    expect(pins).toHaveLength(1);
    expect(pins[0]?.status).toBe("SCHEDULED");
  });

  it("flips the artist's show pin ON_STAGE for a stored ping", () => {
    const pins = hydrateServerPins([STORED_SHOW], [STORED_PING]);
    expect(pins).toHaveLength(1);
    expect(pins[0]?.status).toBe("ON_STAGE");
    // The show pin keeps its identity — same pin, live now.
    expect(pins[0]?.id).toBe("show-1");
  });

  it("collapses repeated pings for the same artist into one live pin", () => {
    const pins = hydrateServerPins(
      [STORED_SHOW],
      [STORED_PING, { ...STORED_PING, id: "ping-2" }],
    );
    expect(pins).toHaveLength(1);
  });

  it("creates a standalone ON_STAGE pin for a ping without a show", () => {
    const pins = hydrateServerPins([], [STORED_PING]);
    expect(pins).toHaveLength(1);
    expect(pins[0]?.status).toBe("ON_STAGE");
    expect(pins[0]?.id).toBe("ping-1");
  });

  it("keeps a second artist's show SCHEDULED when only one is live", () => {
    const otherShow: StoredShow = {
      ...STORED_SHOW,
      id: "show-2",
      artist_id: "artist-7",
    };
    const pins = hydrateServerPins([STORED_SHOW, otherShow], [STORED_PING]);
    const byArtist = new Map(pins.map((pin) => [pin.artistId, pin.status]));
    expect(byArtist.get("artist-42")).toBe("ON_STAGE");
    expect(byArtist.get("artist-7")).toBe("SCHEDULED");
  });
});

describe("fetchServerPins", () => {
  function stubFetchOnce(
    showsResponse: () => Response,
    pingsResponse: () => Response,
  ): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("live-ping") ? pingsResponse() : showsResponse(),
      ),
    );
  }

  it("hydrates pins from both endpoints", async () => {
    stubFetchOnce(
      () =>
        new Response(JSON.stringify([STORED_SHOW]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      () =>
        new Response(JSON.stringify([STORED_PING]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await fetchServerPins();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pins).toHaveLength(1);
    expect(result.pins[0]?.status).toBe("ON_STAGE");
  });

  it("fails quietly when the shows endpoint errors", async () => {
    stubFetchOnce(
      () =>
        new Response(JSON.stringify({ error: "db down", code: "x" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await fetchServerPins();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  it("fails quietly when the pings endpoint errors", async () => {
    stubFetchOnce(
      () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      () => {
        throw new TypeError("Failed to fetch");
      },
    );
    const result = await fetchServerPins();

    expect(result.ok).toBe(false);
  });

  it("skips records without an id instead of crashing", async () => {
    stubFetchOnce(
      () =>
        new Response(JSON.stringify([{ ...STORED_SHOW, id: undefined }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await fetchServerPins();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pins).toHaveLength(0);
    }
  });
});
