import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeQuery, reverseGeocode } from "@/lib/geocode";
import {
  ARTIST_SDK_DISTRICTS,
  ATXLiveArtistSDK,
  buildLivePingPayload,
  buildUploadShowPayload,
  COUNCIL_DISTRICTS,
  councilDistrictBucket,
  normalizeTicketing,
  validateUploadShowInput,
  type UploadShowInput,
} from "@/lib/artistSdk";
import type { District, Ticketing } from "@/lib/types";

// No network in tests: the geocoders are the app's client-side utilities
// (the same flow the Go-Live modal uses), mocked at the module boundary.
vi.mock("@/lib/geocode", () => ({
  geocodeQuery: vi.fn(),
  reverseGeocode: vi.fn(),
}));

const mockedGeocodeQuery = vi.mocked(geocodeQuery);
const mockedReverseGeocode = vi.mocked(reverseGeocode);

// Transport boundary (PR 22): the SDK POSTs to the same-origin /api
// endpoints through global fetch. Stubbed here so tests observe the exact
// wire bytes without network. Default: 201 with a server-assigned id.
const mockedFetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(): void {
  mockedFetch.mockReset();
  mockedFetch.mockImplementation(async (url: string) =>
    jsonResponse(201, {
      id: url.includes("live-ping") ? "ping-server-1" : "show-server-1",
    }),
  );
  vi.stubGlobal("fetch", mockedFetch);
}

// East 6th & San Jacinto — inside AUSTIN_BOUNDS, classifies to Downtown
// (30.2674 >= 30.24, < 30.32; -97.7398 between -97.75 and -97.73).
const SIXTH_STREET = {
  lat: 30.2674,
  lng: -97.7398,
  displayName: "508 East 6th Street, Austin, Travis County, Texas",
};

const VALID_INPUT: UploadShowInput = {
  venueName: "Continental Club",
  artistName: "The Night Owls",
  address: "1315 S Congress Ave",
  district: "South",
  setTime: "2026-09-05T21:00",
  ticketUrl: "https://tickets.example.com/continental",
};

function initializedSdk(artistId = "artist-42"): ATXLiveArtistSDK {
  const sdk = new ATXLiveArtistSDK();
  sdk.init(artistId);
  return sdk;
}

beforeEach(() => {
  mockedGeocodeQuery.mockReset();
  mockedReverseGeocode.mockReset();
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("validateUploadShowInput", () => {
  it("accepts a fully valid input", () => {
    expect(validateUploadShowInput(VALID_INPUT)).toBeNull();
  });

  it("rejects a missing venue name", () => {
    expect(
      validateUploadShowInput({ ...VALID_INPUT, venueName: "" }),
    ).toBe("missing_venue");
  });

  it("rejects a whitespace-only venue name", () => {
    expect(
      validateUploadShowInput({ ...VALID_INPUT, venueName: "   " }),
    ).toBe("missing_venue");
  });

  it("rejects a district outside the app's five districts", () => {
    // "Red River Cultural District" is a real Austin corridor but not one
    // of the five District values this app tracks.
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        district: "Red River Cultural District" as UploadShowInput["district"],
      }),
    ).toBe("invalid_district");
  });

  it("accepts every one of the five districts", () => {
    for (const district of ARTIST_SDK_DISTRICTS) {
      expect(validateUploadShowInput({ ...VALID_INPUT, district })).toBeNull();
    }
  });

  it("rejects a missing set time", () => {
    expect(validateUploadShowInput({ ...VALID_INPUT, setTime: "" })).toBe(
      "missing_set_time",
    );
  });

  it("rejects an unparseable set time", () => {
    expect(
      validateUploadShowInput({ ...VALID_INPUT, setTime: "not-a-date" }),
    ).toBe("invalid_set_time");
  });
});

describe("buildUploadShowPayload", () => {
  it("shapes the exact wire fields the pasted SDK POSTed", () => {
    const createdAt = new Date("2026-08-28T18:00:00.000Z");
    const payload = buildUploadShowPayload(
      VALID_INPUT,
      "artist-42",
      createdAt,
    );

    expect(Object.keys(payload).sort()).toEqual(
      [
        "address",
        "artist_id",
        "artist_name",
        "created_at",
        "district",
        "native_ticket_capacity",
        "native_ticket_price",
        "set_time",
        "ticket_url",
        "ticketing_type",
        "venue_name",
        // PR 22 additive fields — the original eleven keep their names and
        // value shapes byte-compatible.
        "latitude",
        "longitude",
        "council_district",
      ].sort(),
    );
    expect(payload).toEqual({
      artist_id: "artist-42",
      venue_name: "Continental Club",
      address: "1315 S Congress Ave",
      district: "South",
      set_time: "2026-09-05T21:00:00.000Z",
      ticket_url: "https://tickets.example.com/continental",
      created_at: "2026-08-28T18:00:00.000Z",
      artist_name: "The Night Owls",
      ticketing_type: "external",
      native_ticket_price: null,
      native_ticket_capacity: null,
      latitude: null,
      longitude: null,
      council_district: "",
    });
  });

  it("carries the geocoded point and council label in the additive fields", () => {
    const payload = buildUploadShowPayload(
      { ...VALID_INPUT, councilDistrict: "  District 9  " },
      "artist-42",
      new Date("2026-08-28T18:00:00.000Z"),
      { latitude: 30.2674, longitude: -97.7398 },
    );
    expect(payload.latitude).toBe(30.2674);
    expect(payload.longitude).toBe(-97.7398);
    expect(payload.council_district).toBe("District 9");
  });

  it("emits empty strings for omitted optional fields", () => {
    const payload = buildUploadShowPayload(
      {
        venueName: "Saxon Pub",
        artistName: "The Night Owls",
        district: "South",
        setTime: "2026-09-05T20:00",
      },
      "artist-42",
      new Date("2026-08-28T18:00:00.000Z"),
    );
    expect(payload.address).toBe("");
    expect(payload.ticket_url).toBe("");
    // No ticketing given at all — the v2 fields say so explicitly.
    expect(payload.ticketing_type).toBe("");
    expect(payload.native_ticket_price).toBeNull();
    expect(payload.native_ticket_capacity).toBeNull();
    // PR 22 additive fields default to "unplaced" when no coords are given.
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
    expect(payload.council_district).toBe("");
  });
});

describe("buildLivePingPayload", () => {
  it("shapes the exact wire fields the pasted SDK POSTed", () => {
    const payload = buildLivePingPayload(
      { lat: 30.2674, lng: -97.7398 },
      "artist-42",
      new Date("2026-08-28T22:00:00.000Z"),
    );

    expect(Object.keys(payload).sort()).toEqual(
      ["artist_id", "latitude", "longitude", "status", "timestamp"].sort(),
    );
    expect(payload).toEqual({
      artist_id: "artist-42",
      latitude: 30.2674,
      longitude: -97.7398,
      timestamp: "2026-08-28T22:00:00.000Z",
      status: "ON_STAGE",
    });
  });
});

describe("ATXLiveArtistSDK.uploadShow", () => {
  it("returns a not_initialized failure instead of throwing", async () => {
    const result = await new ATXLiveArtistSDK().uploadShow(VALID_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("not_initialized");
    }
  });

  it("returns a typed failure for a missing venue without geocoding", async () => {
    const sdk = initializedSdk();
    const result = await sdk.uploadShow({ ...VALID_INPUT, venueName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("missing_venue");
    }
    expect(mockedGeocodeQuery).not.toHaveBeenCalled();
  });

  it("returns a typed failure for a bad district", async () => {
    const sdk = initializedSdk();
    const result = await sdk.uploadShow({
      ...VALID_INPUT,
      district: "Rainey Street" as UploadShowInput["district"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("invalid_district");
    }
    expect(mockedGeocodeQuery).not.toHaveBeenCalled();
  });

  it("returns a typed failure for a missing set time", async () => {
    const sdk = initializedSdk();
    const result = await sdk.uploadShow({ ...VALID_INPUT, setTime: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("missing_set_time");
    }
  });

  it("returns the geocoder's error for an unresolvable venue", async () => {
    mockedGeocodeQuery.mockResolvedValue({
      ok: false,
      error: "Location not found",
    });
    const result = await initializedSdk().uploadShow(VALID_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("geocode_failed");
      expect(result.error).toBe("Location not found");
    }
  });

  it("creates a SCHEDULED artist pin at the geocoded location", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = initializedSdk("artist-42");
    const result = await sdk.uploadShow(VALID_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    // Independently computed: 30.2674, -97.7398 falls in the Downtown band
    // (south of 30.32, north of 30.24, between the -97.75/-97.73 meridians).
    expect(result.pin.district).toBe("Downtown");
    expect(result.pin.source).toBe("artist");
    expect(result.pin.status).toBe("SCHEDULED");
    expect(result.pin.artistId).toBe("artist-42");
    expect(result.pin.lat).toBe(SIXTH_STREET.lat);
    expect(result.pin.lng).toBe(SIXTH_STREET.lng);
    expect(result.pin.locationName).toBe(SIXTH_STREET.displayName);
    expect(result.pin.setTime).toBe("2026-09-05T21:00:00.000Z");
    expect(result.pin.ticketUrl).toBe(
      "https://tickets.example.com/continental",
    );
    expect(result.pin.artistName).toBe("The Night Owls");
    expect(result.pinId).toBe(result.pin.id);
    expect(sdk.artistPins).toHaveLength(1);
  });

  it("geocodes the address when given, else the venue name", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    await initializedSdk().uploadShow(VALID_INPUT);
    expect(mockedGeocodeQuery).toHaveBeenCalledWith("1315 S Congress Ave");

    mockedGeocodeQuery.mockClear();
    await initializedSdk().uploadShow({
      venueName: "Saxon Pub",
      artistName: "The Night Owls",
      district: "South",
      setTime: "2026-09-05T20:00",
    });
    expect(mockedGeocodeQuery).toHaveBeenCalledWith("Saxon Pub");
  });

  it("falls back to the user-selected district for out-of-bounds points", async () => {
    // Geocoder resolved somewhere outside AUSTIN_BOUNDS (classifier returns
    // undefined there) — the selected district stands rather than a guess.
    mockedGeocodeQuery.mockResolvedValue({
      ok: true,
      lat: 40.7128,
      lng: -74.006,
      displayName: "Somewhere far away",
    });
    const result = await initializedSdk().uploadShow({
      ...VALID_INPUT,
      district: "East",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pin.district).toBe("East");
    }
  });
});

describe("ATXLiveArtistSDK.triggerLivePing", () => {
  it("throws when init was never called", async () => {
    const sdk = new ATXLiveArtistSDK();
    await expect(
      sdk.triggerLivePing({ lat: 30.2674, lng: -97.7398 }),
    ).rejects.toThrow(/init/i);
  });

  it("returns a typed failure for non-finite coordinates", async () => {
    const result = await initializedSdk().triggerLivePing({
      lat: Number.NaN,
      lng: -97.7398,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("invalid_coords");
    }
  });

  it("marks the artist's most recent show pin ON_STAGE", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = initializedSdk("artist-42");
    const upload = await sdk.uploadShow(VALID_INPUT);
    expect(upload.success).toBe(true);

    const ping = await sdk.triggerLivePing({ lat: 30.2674, lng: -97.7398 });
    expect(ping.success).toBe(true);
    if (!ping.success || !upload.success) {
      return;
    }

    // Same pin, now ON_STAGE — not a second pin.
    expect(ping.pinId).toBe(upload.pinId);
    expect(ping.pin.status).toBe("ON_STAGE");
    expect(sdk.artistPins).toHaveLength(1);
    expect(ping.payload.status).toBe("ON_STAGE");
    expect(ping.payload.artist_id).toBe("artist-42");
  });

  it("creates an ON_STAGE pin at the ping coordinates when no show exists", async () => {
    mockedReverseGeocode.mockResolvedValue({
      ok: true,
      lat: 30.2674,
      lng: -97.7398,
      displayName: "Mohawk, 912 Red River Street, Austin",
    });
    const sdk = initializedSdk("artist-42");
    const ping = await sdk.triggerLivePing({ lat: 30.2674, lng: -97.7398 });

    expect(ping.success).toBe(true);
    if (!ping.success) {
      return;
    }
    expect(ping.pin.status).toBe("ON_STAGE");
    expect(ping.pin.source).toBe("artist");
    expect(ping.pin.lat).toBe(30.2674);
    expect(ping.pin.lng).toBe(-97.7398);
    expect(ping.pin.locationName).toBe("Mohawk, 912 Red River Street, Austin");
    // Independently computed: this point classifies to Downtown.
    expect(ping.pin.district).toBe("Downtown");
    expect(sdk.artistPins).toHaveLength(1);
  });

  it("still pings when the reverse geocoder fails, naming the raw coords", async () => {
    mockedReverseGeocode.mockResolvedValue({
      ok: false,
      error: "Could not reverse-geocode that point.",
    });
    const ping = await initializedSdk("artist-42").triggerLivePing({
      lat: 30.2674,
      lng: -97.7398,
    });
    expect(ping.success).toBe(true);
    if (ping.success) {
      expect(ping.pin.locationName).toBe("Live position (30.2674, -97.7398)");
    }
  });

  it("keeps artists' pins separate", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    mockedReverseGeocode.mockResolvedValue({
      ok: true,
      lat: 30.2674,
      lng: -97.7398,
      displayName: "Mohawk, 912 Red River Street, Austin",
    });
    const sdkA = initializedSdk("artist-a");
    const sdkB = initializedSdk("artist-b");
    const uploadA = await sdkA.uploadShow(VALID_INPUT);
    const pingB = await sdkB.triggerLivePing({ lat: 30.2674, lng: -97.7398 });

    expect(uploadA.success).toBe(true);
    expect(pingB.success).toBe(true);
    if (uploadA.success && pingB.success) {
      // B has no show pin, so B's ping creates its own; A's stays SCHEDULED.
      expect(pingB.pinId).not.toBe(uploadA.pinId);
      expect(uploadA.pin.status).toBe("SCHEDULED");
      expect(pingB.pin.status).toBe("ON_STAGE");
    }
  });
});

describe("ATXLiveArtistSDK construction", () => {
  it("treats a constructor artistId as initialized", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = new ATXLiveArtistSDK({ artistId: "artist-42" });
    const result = await sdk.uploadShow(VALID_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.artist_id).toBe("artist-42");
    }
  });

  it("accepts baseUrl without using it client-side", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = new ATXLiveArtistSDK({
      artistId: "artist-42",
      baseUrl: "https://api.atxlive.app/v1",
    });
    // The client-side backing never fetches the base URL — no network.
    const result = await sdk.uploadShow(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("rejects an empty init artistId", () => {
    expect(() => new ATXLiveArtistSDK().init("   ")).toThrow(/artistId/i);
  });

  it("lets init override the constructor artist", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = new ATXLiveArtistSDK({ artistId: "artist-a" });
    sdk.init("artist-b");
    const result = await sdk.uploadShow(VALID_INPUT);
    if (result.success) {
      expect(result.payload.artist_id).toBe("artist-b");
    } else {
      expect.unreachable("uploadShow should have succeeded");
    }
  });
});

describe("COUNCIL_DISTRICTS", () => {
  // Independently transcribed from the v2 panel's pasted select options —
  // deliberately not derived from the implementation table.
  const EXPECTED: ReadonlyArray<{
    label: string;
    area: string;
    district: District;
  }> = [
    { label: "District 1", area: "East Austin", district: "East" },
    { label: "District 2", area: "Southeast Austin", district: "East" },
    { label: "District 3", area: "East / South Central", district: "East" },
    { label: "District 4", area: "North Central", district: "North" },
    { label: "District 5", area: "South Austin", district: "South" },
    { label: "District 6", area: "Northwest / Lakeline", district: "North" },
    { label: "District 7", area: "North Austin / Burnet", district: "North" },
    { label: "District 8", area: "Southwest / Oak Hill", district: "South" },
    { label: "District 9", area: "Downtown / UT Campus", district: "Downtown" },
    { label: "District 10", area: "West Austin / NW", district: "West" },
  ];

  it("lists all ten council districts verbatim, in order", () => {
    expect(COUNCIL_DISTRICTS).toHaveLength(10);
    expect([...COUNCIL_DISTRICTS]).toEqual(EXPECTED);
  });

  it("maps every council district to the app's five-district buckets", () => {
    for (const { label, district } of EXPECTED) {
      expect(councilDistrictBucket(label)).toBe(district);
    }
  });

  it("returns undefined for a label outside the ten options", () => {
    expect(councilDistrictBucket("District 11")).toBeUndefined();
    expect(councilDistrictBucket("")).toBeUndefined();
  });
});

describe("ticketing validation", () => {
  it("accepts a valid native ticketing block", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: 15, capacity: 150 },
      }),
    ).toBeNull();
  });

  it("accepts a zero price (free show)", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: 0, capacity: 1 },
      }),
    ).toBeNull();
  });

  it("rejects a negative native price", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: -1, capacity: 150 },
      }),
    ).toBe("invalid_ticket_price");
  });

  it("rejects a non-finite native price", () => {
    for (const price of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validateUploadShowInput({
          ...VALID_INPUT,
          ticketing: { type: "native", price, capacity: 150 },
        }),
      ).toBe("invalid_ticket_price");
    }
  });

  it("rejects a fractional capacity", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: 15, capacity: 149.5 },
      }),
    ).toBe("invalid_ticket_capacity");
  });

  it("rejects a zero or negative capacity", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: 15, capacity: 0 },
      }),
    ).toBe("invalid_ticket_capacity");
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: 15, capacity: -5 },
      }),
    ).toBe("invalid_ticket_capacity");
  });

  it("rejects a native block missing capacity at runtime (JS callers)", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "native", price: 15 } as unknown as Ticketing,
      }),
    ).toBe("invalid_ticket_capacity");
  });

  it("rejects a malformed union type", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "bogus" } as unknown as Ticketing,
      }),
    ).toBe("invalid_ticketing");
  });

  it("accepts an external block with an empty URL (no link)", () => {
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "external", ticketUrl: "" },
      }),
    ).toBeNull();
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "external", ticketUrl: "   " },
      }),
    ).toBeNull();
    expect(
      validateUploadShowInput({
        ...VALID_INPUT,
        ticketing: { type: "external" },
      }),
    ).toBeNull();
  });

  it("rejects an artist name that is empty or whitespace", () => {
    expect(validateUploadShowInput({ ...VALID_INPUT, artistName: "" })).toBe(
      "missing_artist_name",
    );
    expect(validateUploadShowInput({ ...VALID_INPUT, artistName: "   " })).toBe(
      "missing_artist_name",
    );
  });
});

describe("normalizeTicketing", () => {
  it("normalizes the legacy flat ticketUrl to an external block", () => {
    expect(
      normalizeTicketing({ ticketUrl: "https://tickets.example.com/x" }),
    ).toEqual({ type: "external", ticketUrl: "https://tickets.example.com/x" });
  });

  it("passes the v2 union through untouched", () => {
    const native: Ticketing = { type: "native", price: 15, capacity: 150 };
    expect(normalizeTicketing({ ticketing: native })).toBe(native);
  });

  it("returns undefined when neither form is given", () => {
    expect(normalizeTicketing({})).toBeUndefined();
  });

  it("lets the v2 union take precedence over the legacy flat form", () => {
    const native: Ticketing = { type: "native", price: 15, capacity: 150 };
    expect(
      normalizeTicketing({
        ticketing: native,
        ticketUrl: "https://legacy.example.com",
      }),
    ).toBe(native);
  });
});

describe("buildUploadShowPayload v2 fields", () => {
  const CREATED_AT = new Date("2026-08-28T18:00:00.000Z");

  it("emits native price and capacity with an empty ticket_url", () => {
    const payload = buildUploadShowPayload(
      {
        ...VALID_INPUT,
        ticketing: { type: "native", price: 15.5, capacity: 150 },
      },
      "artist-42",
      CREATED_AT,
    );
    expect(payload.ticketing_type).toBe("native");
    expect(payload.native_ticket_price).toBe(15.5);
    expect(payload.native_ticket_capacity).toBe(150);
    expect(payload.ticket_url).toBe("");
    expect(payload.artist_name).toBe("The Night Owls");
  });

  it("emits null native fields for external ticketing and trims the URL", () => {
    const payload = buildUploadShowPayload(
      {
        ...VALID_INPUT,
        ticketing: {
          type: "external",
          ticketUrl: "  https://t.example.com/x  ",
        },
      },
      "artist-42",
      CREATED_AT,
    );
    expect(payload.ticketing_type).toBe("external");
    expect(payload.ticket_url).toBe("https://t.example.com/x");
    expect(payload.native_ticket_price).toBeNull();
    expect(payload.native_ticket_capacity).toBeNull();
  });

  it("normalizes the legacy flat ticketUrl to external in the payload", () => {
    const payload = buildUploadShowPayload(
      {
        ...VALID_INPUT,
        ticketing: undefined,
        ticketUrl: "https://legacy.example.com",
      },
      "artist-42",
      CREATED_AT,
    );
    expect(payload.ticketing_type).toBe("external");
    expect(payload.ticket_url).toBe("https://legacy.example.com");
    expect(payload.native_ticket_price).toBeNull();
    expect(payload.native_ticket_capacity).toBeNull();
  });
});

describe("ATXLiveArtistSDK.uploadShow v2", () => {
  it("carries artistName, councilDistrict, and native ticketing onto the pin", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const result = await initializedSdk("artist-42").uploadShow({
      ...VALID_INPUT,
      ticketing: { type: "native", price: 15, capacity: 150 },
      councilDistrict: "District 9",
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.pin.artistName).toBe("The Night Owls");
    expect(result.pin.councilDistrict).toBe("District 9");
    expect(result.pin.ticketing).toEqual({
      type: "native",
      price: 15,
      capacity: 150,
    });
    expect(result.pin.ticketUrl).toBeUndefined();
    expect(result.payload.ticketing_type).toBe("native");
    expect(result.payload.native_ticket_price).toBe(15);
    expect(result.payload.native_ticket_capacity).toBe(150);
  });

  it("still accepts the legacy flat ticketUrl and normalizes it to external", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const result = await initializedSdk("artist-42").uploadShow({
      venueName: "Continental Club",
      artistName: "The Night Owls",
      district: "South",
      setTime: "2026-09-05T21:00",
      ticketUrl: "https://tickets.example.com/continental",
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.pin.ticketUrl).toBe(
      "https://tickets.example.com/continental",
    );
    expect(result.pin.ticketing).toEqual({
      type: "external",
      ticketUrl: "https://tickets.example.com/continental",
    });
    expect(result.payload.ticketing_type).toBe("external");
  });

  it("returns a typed failure for a negative native price without geocoding", async () => {
    const result = await initializedSdk().uploadShow({
      ...VALID_INPUT,
      ticketing: { type: "native", price: -1, capacity: 150 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("invalid_ticket_price");
    }
    expect(mockedGeocodeQuery).not.toHaveBeenCalled();
  });

  it("returns a typed failure for an empty artist name", async () => {
    const result = await initializedSdk().uploadShow({
      ...VALID_INPUT,
      artistName: "  ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("missing_artist_name");
    }
    expect(mockedGeocodeQuery).not.toHaveBeenCalled();
  });

  it("keeps the geocoded point driving classification alongside the council label", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const result = await initializedSdk().uploadShow({
      ...VALID_INPUT,
      ticketing: { type: "external", ticketUrl: "" },
      councilDistrict: "District 5",
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // Independently computed: the point classifies to Downtown even though
    // the selected council district (5) maps to the South bucket.
    expect(result.pin.district).toBe("Downtown");
    expect(result.pin.councilDistrict).toBe("District 5");
    expect(result.pin.ticketing).toEqual({ type: "external", ticketUrl: "" });
  });
});

describe("ATXLiveArtistSDK transport (PR 22)", () => {
  it("POSTs the builder payload byte-exact to /api/shows and carries the server id", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = initializedSdk("artist-42");
    const result = await sdk.uploadShow(VALID_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe("/api/shows");
    expect(init?.method).toBe("POST");
    // The wire body is exactly the payload builder's output — the builders
    // finally go on the wire, byte for byte.
    expect(JSON.parse(init?.body as string)).toEqual(result.payload);
    expect(result.serverId).toBe("show-server-1");
    expect(sdk.artistPins).toHaveLength(1);
  });

  it("maps a 422 envelope to validation_error with the server's message and code", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    mockedFetch.mockImplementationOnce(async () =>
      jsonResponse(422, {
        error: "district must be one of the five Austin districts.",
        code: "invalid_district",
      }),
    );
    const sdk = initializedSdk();
    const result = await sdk.uploadShow(VALID_INPUT);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.code).toBe("validation_error");
    // The server's {error, code} envelope is surfaced verbatim.
    expect(result.error).toBe(
      "district must be one of the five Austin districts.",
    );
    expect(result.serverCode).toBe("invalid_district");
    expect(result.httpStatus).toBe(422);
    // No pin on failure — the map never shows an unstored show.
    expect(sdk.artistPins).toHaveLength(0);
  });

  it("maps a 401 to auth_error", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    mockedFetch.mockImplementationOnce(async () =>
      jsonResponse(401, { error: "Invalid artist key.", code: "unauthorized" }),
    );
    const result = await initializedSdk().uploadShow(VALID_INPUT);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.code).toBe("auth_error");
    expect(result.error).toBe("Invalid artist key.");
    expect(result.serverCode).toBe("unauthorized");
    expect(result.httpStatus).toBe(401);
  });

  it("maps a 500 to server_error", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    mockedFetch.mockImplementationOnce(async () =>
      jsonResponse(500, { error: "Failed to store the show.", code: "store_failure" }),
    );
    const result = await initializedSdk().uploadShow(VALID_INPUT);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.code).toBe("server_error");
    expect(result.error).toBe("Failed to store the show.");
    expect(result.serverCode).toBe("store_failure");
    expect(result.httpStatus).toBe(500);
  });

  it("maps a network failure to network_error without throwing", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    mockedFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await initializedSdk().uploadShow(VALID_INPUT);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.code).toBe("network_error");
    expect(result.error).toBeTruthy();
  });

  it("maps a hung server to request_timeout via the AbortController", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    vi.useFakeTimers();
    mockedFetch.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    const pending = initializedSdk().uploadShow(VALID_INPUT);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.code).toBe("request_timeout");
  });

  it("does not flip a pin ON_STAGE when the ping request fails", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = initializedSdk("artist-42");
    const upload = await sdk.uploadShow(VALID_INPUT);
    expect(upload.success).toBe(true);

    mockedFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const ping = await sdk.triggerLivePing({ lat: 30.2674, lng: -97.7398 });

    expect(ping.success).toBe(false);
    if (!ping.success) {
      expect(ping.code).toBe("network_error");
    }
    // Phantom-live-state guard: the stored pin stays SCHEDULED — only a
    // stored ping flips it.
    expect(sdk.artistPins[0]?.status).toBe("SCHEDULED");
  });

  it("carries the ping's server id on success", async () => {
    mockedReverseGeocode.mockResolvedValue({
      ok: true,
      lat: 30.2674,
      lng: -97.7398,
      displayName: "Mohawk, 912 Red River Street, Austin",
    });
    const result = await initializedSdk("artist-42").triggerLivePing({
      lat: 30.2674,
      lng: -97.7398,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.serverId).toBe("ping-server-1");
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe("/api/telemetry/live-ping");
    expect(JSON.parse(init?.body as string)).toEqual(result.payload);
  });
});


describe("ATXLiveArtistSDK transport (PR 23 Bearer)", () => {
  it("sends Authorization: Bearer on uploadShow after setApiKey", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = initializedSdk("artist-42");
    sdk.setApiKey("atxlive_testkey123");

    await sdk.uploadShow(VALID_INPUT);

    const [, init] = mockedFetch.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer atxlive_testkey123",
    });
  });

  it("sends Authorization: Bearer on triggerLivePing after setApiKey", async () => {
    mockedReverseGeocode.mockResolvedValue({
      ok: true,
      lat: 30.2674,
      lng: -97.7398,
      displayName: "Mohawk, 912 Red River Street, Austin",
    });
    const sdk = initializedSdk("artist-42");
    sdk.setApiKey("atxlive_testkey123");

    await sdk.triggerLivePing({ lat: 30.2674, lng: -97.7398 });

    const [, init] = mockedFetch.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer atxlive_testkey123",
    });
  });

  it("sends no Authorization header when no key is configured", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    await initializedSdk("artist-42").uploadShow(VALID_INPUT);

    const [, init] = mockedFetch.mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("clears the credential with an empty string", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    const sdk = initializedSdk("artist-42");
    sdk.setApiKey("atxlive_testkey123");
    expect(sdk.isAuthorized).toBe(true);

    sdk.setApiKey("");
    expect(sdk.isAuthorized).toBe(false);

    await sdk.uploadShow(VALID_INPUT);
    const [, init] = mockedFetch.mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("maps a 401 AUTH_INVALID envelope to auth_error with the server code", async () => {
    mockedGeocodeQuery.mockResolvedValue({ ok: true, ...SIXTH_STREET });
    mockedFetch.mockImplementationOnce(async () =>
      jsonResponse(401, {
        error: "That artist key doesn't match any registered artist.",
        code: "AUTH_INVALID",
      }),
    );
    const sdk = initializedSdk("artist-42");
    sdk.setApiKey("atxlive_stalekey");
    const result = await sdk.uploadShow(VALID_INPUT);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.code).toBe("auth_error");
    expect(result.serverCode).toBe("AUTH_INVALID");
    expect(result.httpStatus).toBe(401);
    // No pin on failure — the map never shows an unstored show.
    expect(sdk.artistPins).toHaveLength(0);
  });
});

