import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, filterPins, isActive, type PinFilter } from "@/lib/filters";
import { GENRES, type Pin } from "@/lib/types";

// Seeded pins covering every Genre value, the "" unspecified bucket, and all
// three PinSource values, with names crafted for substring/case tests.
const pins: Pin[] = [
  {
    id: "p1",
    lat: 30.27,
    lng: -97.74,
    performerName: "Sarah Belle",
    locationName: "The Mohawk",
    genre: "Acoustic",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "live",
  },
  {
    id: "p2",
    lat: 30.26,
    lng: -97.74,
    performerName: "MC Rowdy",
    locationName: "Elephant Room",
    genre: "Hip-Hop",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "search",
  },
  {
    id: "p3",
    lat: 30.25,
    lng: -97.75,
    performerName: "Blue Steel",
    locationName: "Continental Club",
    genre: "Blues/Rock",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "map",
  },
  {
    id: "p4",
    lat: 30.28,
    lng: -97.73,
    performerName: "Brass Tacks",
    locationName: "Antone's",
    genre: "Brass",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "live",
  },
  {
    id: "p5",
    lat: 30.29,
    lng: -97.72,
    performerName: "Dusty Trails",
    locationName: "White Horse",
    genre: "Country",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "search",
  },
  {
    id: "p6",
    lat: 30.24,
    lng: -97.76,
    performerName: "Unknown Act",
    locationName: "Sixth Street Stage",
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "map",
  },
  {
    id: "p7",
    lat: 30.23,
    lng: -97.77,
    performerName: "Jane Doe",
    locationName: "Mohawk Rooftop",
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "live",
  },
  {
    id: "p8",
    lat: 30.22,
    lng: -97.78,
    performerName: "Acoustic Duo",
    locationName: "Cactus Cafe",
    genre: "Acoustic",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "search",
  },
];

const idsOf = (result: Pin[]) => result.map((pin) => pin.id).sort();

describe("EMPTY_FILTER", () => {
  it("returns all pins", () => {
    expect(idsOf(filterPins(pins, EMPTY_FILTER))).toEqual(idsOf(pins));
  });

  it("is not active", () => {
    expect(isActive(EMPTY_FILTER)).toBe(false);
  });
});

describe("genre chips", () => {
  it.each(GENRES)("filters to only %s pins", (genre) => {
    const filter: PinFilter = { ...EMPTY_FILTER, genres: [genre] };
    const expected = pins.filter((pin) => pin.genre === genre);
    expect(idsOf(filterPins(pins, filter))).toEqual(idsOf(expected));
  });

  it("Unspecified chip (genre '') catches only genre: '' pins", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, genres: [""] };
    expect(idsOf(filterPins(pins, filter))).toEqual(["p6", "p7"]);
  });

  it("selecting multiple genre chips is OR within the genre dimension", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, genres: ["Acoustic", ""] };
    expect(idsOf(filterPins(pins, filter))).toEqual(["p1", "p6", "p7", "p8"]);
  });
});

describe("source / status toggles", () => {
  it("sources: ['live'] keeps only live pins", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, sources: ["live"] };
    expect(idsOf(filterPins(pins, filter))).toEqual(["p1", "p4", "p7"]);
  });

  it("'dropped' maps to sources ['search', 'map'] and keeps both, excluding live", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, sources: ["search", "map"] };
    expect(idsOf(filterPins(pins, filter))).toEqual([
      "p2",
      "p3",
      "p5",
      "p6",
      "p8",
    ]);
  });
});

describe("text query", () => {
  it("matches case-insensitively", () => {
    const lower = filterPins(pins, { ...EMPTY_FILTER, query: "mohawk" });
    const upper = filterPins(pins, { ...EMPTY_FILTER, query: "MOHAWK" });
    expect(idsOf(lower)).toEqual(["p1", "p7"]);
    expect(idsOf(upper)).toEqual(["p1", "p7"]);
  });

  it("matches a partial substring", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, query: "moha" };
    expect(idsOf(filterPins(pins, filter))).toEqual(["p1", "p7"]);
  });

  it("matches on locationName alone when performerName does not contain the query", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, query: "cafe" };
    const result = filterPins(pins, filter);
    expect(idsOf(result)).toEqual(["p8"]);
    expect(
      result.every((pin) => !pin.performerName.toLowerCase().includes("cafe")),
    ).toBe(true);
  });

  it("treats a whitespace-only query as inactive (no filtering)", () => {
    const filter: PinFilter = { ...EMPTY_FILTER, query: "   " };
    expect(isActive(filter)).toBe(false);
    expect(idsOf(filterPins(pins, filter))).toEqual(idsOf(pins));
  });
});

describe("combined filters", () => {
  it("ANDs genre, source, and query together", () => {
    const filter: PinFilter = {
      genres: ["Acoustic"],
      sources: ["search"],
      query: "duo",
    };
    // p1 is Acoustic but source "live" -> excluded by source.
    // p8 is Acoustic + search + performerName contains "duo" -> matches.
    expect(idsOf(filterPins(pins, filter))).toEqual(["p8"]);
    expect(isActive(filter)).toBe(true);
  });

  it("returns nothing when one dimension excludes every remaining candidate", () => {
    const filter: PinFilter = {
      genres: ["Acoustic"],
      sources: ["map"],
      query: "",
    };
    expect(idsOf(filterPins(pins, filter))).toEqual([]);
  });
});
