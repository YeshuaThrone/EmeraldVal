import { describe, expect, it } from "vitest";
import {
  validateLivePingPayload,
  validateShowPayload,
} from "@/lib/validation";

// Wire payloads exactly as the ATXLiveArtistSDK builds them
// (buildUploadShowPayload / buildLivePingPayload field names).
const VALID_SHOW = {
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
};

const VALID_PING = {
  artist_id: "artist-42",
  latitude: 30.2674,
  longitude: -97.7398,
  timestamp: "2026-08-30T20:00:00.000Z",
  status: "ON_STAGE",
};

describe("validateShowPayload", () => {
  it("accepts a fully valid external-ticketing payload", () => {
    const result = validateShowPayload(VALID_SHOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(VALID_SHOW);
    }
  });

  it("accepts a valid native-ticketing payload with price and capacity", () => {
    const result = validateShowPayload({
      ...VALID_SHOW,
      ticketing_type: "native",
      ticket_url: "",
      native_ticket_price: 15,
      native_ticket_capacity: 80,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.native_ticket_price).toBe(15);
      expect(result.value.native_ticket_capacity).toBe(80);
    }
  });

  it("defaults omitted coordinates to null and trims the council label", () => {
    const result = validateShowPayload({
      artist_id: "artist-42",
      artist_name: "The Night Owls",
      venue_name: "Continental Club",
      address: "",
      district: "South",
      set_time: "2026-09-05T21:00:00.000Z",
      ticket_url: "",
      created_at: "2026-08-30T12:00:00.000Z",
      ticketing_type: "",
      native_ticket_price: null,
      native_ticket_capacity: null,
      council_district: "  District 5  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.latitude).toBeNull();
      expect(result.value.longitude).toBeNull();
      expect(result.value.council_district).toBe("District 5");
    }
  });

  it("rejects out-of-range additive coordinates", () => {
    expect(
      validateShowPayload({ ...VALID_SHOW, latitude: 91 }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
    expect(
      validateShowPayload({ ...VALID_SHOW, longitude: -181 }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
  });

  it("rejects a non-object body", () => {
    expect(validateShowPayload("nope")).toMatchObject({
      ok: false,
      code: "malformed_body",
    });
    expect(validateShowPayload(null)).toMatchObject({
      ok: false,
      code: "malformed_body",
    });
    expect(validateShowPayload([VALID_SHOW])).toMatchObject({
      ok: false,
      code: "malformed_body",
    });
  });

  it("rejects a missing or blank artist_id", () => {
    expect(validateShowPayload({ ...VALID_SHOW, artist_id: "" })).toMatchObject({
      ok: false,
      code: "missing_artist_id",
    });
    expect(validateShowPayload({ ...VALID_SHOW, artist_id: "   " })).toMatchObject({
      ok: false,
      code: "missing_artist_id",
    });
  });

  it("rejects a missing venue name", () => {
    expect(validateShowPayload({ ...VALID_SHOW, venue_name: "" })).toMatchObject({
      ok: false,
      code: "missing_venue",
    });
  });

  it("rejects a missing artist name", () => {
    expect(validateShowPayload({ ...VALID_SHOW, artist_name: "" })).toMatchObject({
      ok: false,
      code: "missing_artist_name",
    });
  });

  it("rejects a district outside the five tracked districts", () => {
    expect(validateShowPayload({ ...VALID_SHOW, district: "Central" })).toMatchObject({
      ok: false,
      code: "invalid_district",
    });
  });

  it("rejects a missing and an unparseable set_time", () => {
    expect(validateShowPayload({ ...VALID_SHOW, set_time: "" })).toMatchObject({
      ok: false,
      code: "missing_set_time",
    });
    expect(validateShowPayload({ ...VALID_SHOW, set_time: "not-a-date" })).toMatchObject({
      ok: false,
      code: "invalid_set_time",
    });
  });

  it("rejects an unparseable created_at", () => {
    expect(validateShowPayload({ ...VALID_SHOW, created_at: "nope" })).toMatchObject({
      ok: false,
      code: "invalid_created_at",
    });
  });

  it("rejects an unknown ticketing_type", () => {
    expect(
      validateShowPayload({ ...VALID_SHOW, ticketing_type: "comped" }),
    ).toMatchObject({ ok: false, code: "invalid_ticketing" });
  });

  it("rejects native ticketing with a negative or non-numeric price", () => {
    expect(
      validateShowPayload({
        ...VALID_SHOW,
        ticketing_type: "native",
        native_ticket_price: -1,
        native_ticket_capacity: 80,
      }),
    ).toMatchObject({ ok: false, code: "invalid_ticket_price" });
    expect(
      validateShowPayload({
        ...VALID_SHOW,
        ticketing_type: "native",
        native_ticket_price: "15",
        native_ticket_capacity: 80,
      }),
    ).toMatchObject({ ok: false, code: "invalid_ticket_price" });
  });

  it("rejects native ticketing with a capacity below 1 or non-integer", () => {
    expect(
      validateShowPayload({
        ...VALID_SHOW,
        ticketing_type: "native",
        native_ticket_price: 15,
        native_ticket_capacity: 0,
      }),
    ).toMatchObject({ ok: false, code: "invalid_ticket_capacity" });
    expect(
      validateShowPayload({
        ...VALID_SHOW,
        ticketing_type: "native",
        native_ticket_price: 15,
        native_ticket_capacity: 12.5,
      }),
    ).toMatchObject({ ok: false, code: "invalid_ticket_capacity" });
  });

  it("normalizes: trims strings, ISO-formats dates, defaults created_at, nulls native fields", () => {
    const result = validateShowPayload({
      ...VALID_SHOW,
      venue_name: "  Continental Club  ",
      set_time: "2026-09-05T21:00",
      created_at: undefined,
      ticketing_type: "",
      ticket_url: undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.venue_name).toBe("Continental Club");
      expect(result.value.set_time).toBe(new Date("2026-09-05T21:00").toISOString());
      expect(new Date(result.value.created_at).getTime()).not.toBeNaN();
      expect(result.value.ticket_url).toBe("");
      expect(result.value.native_ticket_price).toBeNull();
      expect(result.value.native_ticket_capacity).toBeNull();
    }
  });
});

describe("validateLivePingPayload", () => {
  it("accepts a valid ON_STAGE ping", () => {
    const result = validateLivePingPayload(VALID_PING);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(VALID_PING);
    }
  });

  it("rejects a missing artist_id", () => {
    expect(validateLivePingPayload({ ...VALID_PING, artist_id: "" })).toMatchObject({
      ok: false,
      code: "missing_artist_id",
    });
  });

  it("rejects non-finite and out-of-range coordinates", () => {
    expect(
      validateLivePingPayload({ ...VALID_PING, latitude: "30.2" }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
    expect(
      validateLivePingPayload({ ...VALID_PING, latitude: 91 }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
    expect(
      validateLivePingPayload({ ...VALID_PING, longitude: -181 }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
  });

  it("rejects a missing and an unparseable timestamp", () => {
    expect(
      validateLivePingPayload({ ...VALID_PING, timestamp: "" }),
    ).toMatchObject({ ok: false, code: "missing_timestamp" });
    expect(
      validateLivePingPayload({ ...VALID_PING, timestamp: "nope" }),
    ).toMatchObject({ ok: false, code: "invalid_timestamp" });
  });

  it("rejects a status other than ON_STAGE", () => {
    expect(
      validateLivePingPayload({ ...VALID_PING, status: "OFF_STAGE" }),
    ).toMatchObject({ ok: false, code: "invalid_status" });
  });

  it("defaults omitted coordinates to null and trims the council label", () => {
    const result = validateShowPayload({
      artist_id: "artist-42",
      artist_name: "The Night Owls",
      venue_name: "Continental Club",
      address: "",
      district: "South",
      set_time: "2026-09-05T21:00:00.000Z",
      ticket_url: "",
      created_at: "2026-08-30T12:00:00.000Z",
      ticketing_type: "",
      native_ticket_price: null,
      native_ticket_capacity: null,
      council_district: "  District 5  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.latitude).toBeNull();
      expect(result.value.longitude).toBeNull();
      expect(result.value.council_district).toBe("District 5");
    }
  });

  it("rejects out-of-range additive coordinates", () => {
    expect(
      validateShowPayload({ ...VALID_SHOW, latitude: 91 }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
    expect(
      validateShowPayload({ ...VALID_SHOW, longitude: -181 }),
    ).toMatchObject({ ok: false, code: "invalid_coords" });
  });

  it("rejects a non-object body", () => {
    expect(validateLivePingPayload(null)).toMatchObject({
      ok: false,
      code: "malformed_body",
    });
  });
});
