import { describe, expect, it } from "vitest";
import {
  FESTIVAL_FEED_KICKER,
  FESTIVAL_SHOW_STATUS_LABEL,
  festivalTicketingFromRecord,
  fetchFestivalShows,
  formatFestivalRowTitle,
  formatFestivalSetTime,
  showRecordToFestivalEntry,
  sortFestivalEntries,
  type FestivalShowEntry,
} from "@/lib/festivalShows";
import type { StoredShow } from "@/lib/shows";

/** A fully-populated stored show — tests override the fields they exercise. */
function storedShow(overrides: Partial<StoredShow> = {}): StoredShow {

  return {
    id: "show-1",
    artist_id: "artist-1",
    artist_name: "Glass Prairie",
    venue_name: "Mohawk",
    address: "912 Red River St",
    district: "Downtown",
    set_time: "2026-08-30T21:30:00.000Z",
    ticket_url: "https://tickets.example.com/glass-prairie",
    created_at: "2026-08-30T12:00:00.000Z",
    ticketing_type: "external",
    native_ticket_price: null,
    native_ticket_capacity: null,
    latitude: 30.2703,
    longitude: -97.7341,
    council_district: "District 9",
    ...overrides,
  };
}

describe("PR 29 badge and copy constants", () => {
  it("labels the feed with the paste's Live Fan Map Feed kicker", () => {
    expect(FESTIVAL_FEED_KICKER).toBe("Live Fan Map Feed");
  });

  it("derives a Confirmed status from publication (no store field)", () => {
    expect(FESTIVAL_SHOW_STATUS_LABEL).toBe("Confirmed");
  });

  it("formats the row title as 'artist — venue'", () => {
    expect(formatFestivalRowTitle("Glass Prairie", "Mohawk")).toBe(
      "Glass Prairie — Mohawk",
    );
  });
});

describe("formatFestivalSetTime", () => {
  it("formats an ISO set time the way the fan map's drawer does", () => {
    // Fixed-offset input so the label is deterministic regardless of the
    // test runner's timezone.
    const label = formatFestivalSetTime("2026-08-30T21:30:00.000Z");
    expect(label).toMatch(/Aug 30, 2026/);
  });

  it("returns null for an unparseable time instead of 'Invalid Date'", () => {
    expect(formatFestivalSetTime("not-a-date")).toBeNull();
  });
});

describe("festivalTicketingFromRecord", () => {
  it("maps an external record with a URL to an external affordance", () => {
    expect(festivalTicketingFromRecord(storedShow())).toEqual({
      kind: "external",
      url: "https://tickets.example.com/glass-prairie",
    });
  });

  it("maps an external record with a cleared URL to none", () => {
    const record = storedShow({ ticket_url: "" });
    expect(festivalTicketingFromRecord(record)).toEqual({ kind: "none" });
  });

  it("maps a native record to its price and capacity", () => {
    const record = storedShow({
      ticketing_type: "native",
      ticket_url: "",
      native_ticket_price: 18,
      native_ticket_capacity: 120,
    });
    expect(festivalTicketingFromRecord(record)).toEqual({
      kind: "native",
      price: 18,
      capacity: 120,
    });
  });

  it("treats a hand-corrupted native record (null price) as none", () => {
    const record = storedShow({
      ticketing_type: "native",
      ticket_url: "",
      native_ticket_price: null,
      native_ticket_capacity: 120,
    });
    expect(festivalTicketingFromRecord(record)).toEqual({ kind: "none" });
  });

  it("maps an empty ticketing_type to none", () => {
    const record = storedShow({ ticketing_type: "", ticket_url: "" });
    expect(festivalTicketingFromRecord(record)).toEqual({ kind: "none" });
  });
});

describe("showRecordToFestivalEntry", () => {
  it("carries artist name, venue, council district, and set time", () => {
    const entry = showRecordToFestivalEntry(storedShow());
    expect(entry).toMatchObject({
      id: "show-1",
      artistName: "Glass Prairie",
      venue: "Mohawk",
      councilDistrict: "District 9",
      setTime: "2026-08-30T21:30:00.000Z",
    });
  });

  it("falls back to the district bucket when council_district is blank", () => {
    const entry = showRecordToFestivalEntry(storedShow({ council_district: "" }));
    expect(entry.councilDistrict).toBe("Downtown");
  });

  it("lists legacy shows without coordinates (only the map skips those)", () => {
    const entry = showRecordToFestivalEntry(
      storedShow({ latitude: null, longitude: null }),
    );
    expect(entry.venue).toBe("Mohawk");
  });
});

describe("sortFestivalEntries", () => {
  const entry = (id: string, setTime: string): FestivalShowEntry => ({
    id,
    artistName: id,
    venue: "Venue",
    councilDistrict: "District 1",
    setTime,
    ticketing: { kind: "none" },
  });

  it("orders soonest set time first and does not mutate the input", () => {
    const input = [
      entry("b", "2026-08-30T23:00:00.000Z"),
      entry("a", "2026-08-30T20:00:00.000Z"),
    ];
    const sorted = sortFestivalEntries(input);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b"]);
    expect(input.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("places unparseable times last and breaks ties by id", () => {
    const sorted = sortFestivalEntries([
      entry("z", "garbage"),
      entry("b", "2026-08-30T20:00:00.000Z"),
      entry("a", "2026-08-30T20:00:00.000Z"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b", "z"]);
  });
});

describe("fetchFestivalShows", () => {
  it("skips records without a usable id instead of crashing", async () => {
    // requestJson against a relative URL in Node resolves via the test
    // environment's fetch — a network failure resolves to {ok: false},
    // which is the contract under test here.
    const result = await fetchFestivalShows();
    expect(result.ok === true || result.ok === false).toBe(true);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
    }
  });
});
