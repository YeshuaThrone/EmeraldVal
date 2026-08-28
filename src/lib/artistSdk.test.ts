import { beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeQuery, reverseGeocode } from "@/lib/geocode";
import {
  ARTIST_SDK_DISTRICTS,
  ATXLiveArtistSDK,
  buildLivePingPayload,
  buildUploadShowPayload,
  validateUploadShowInput,
  type UploadShowInput,
} from "@/lib/artistSdk";

// No network in tests: the geocoders are the app's client-side utilities
// (the same flow the Go-Live modal uses), mocked at the module boundary.
vi.mock("@/lib/geocode", () => ({
  geocodeQuery: vi.fn(),
  reverseGeocode: vi.fn(),
}));

const mockedGeocodeQuery = vi.mocked(geocodeQuery);
const mockedReverseGeocode = vi.mocked(reverseGeocode);

// East 6th & San Jacinto — inside AUSTIN_BOUNDS, classifies to Downtown
// (30.2674 >= 30.24, < 30.32; -97.7398 between -97.75 and -97.73).
const SIXTH_STREET = {
  lat: 30.2674,
  lng: -97.7398,
  displayName: "508 East 6th Street, Austin, Travis County, Texas",
};

const VALID_INPUT: UploadShowInput = {
  venueName: "Continental Club",
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
        "created_at",
        "district",
        "set_time",
        "ticket_url",
        "venue_name",
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
    });
  });

  it("emits empty strings for omitted optional fields", () => {
    const payload = buildUploadShowPayload(
      {
        venueName: "Saxon Pub",
        district: "South",
        setTime: "2026-09-05T20:00",
      },
      "artist-42",
      new Date("2026-08-28T18:00:00.000Z"),
    );
    expect(payload.address).toBe("");
    expect(payload.ticket_url).toBe("");
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
