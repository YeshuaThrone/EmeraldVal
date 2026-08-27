import { describe, expect, it } from "vitest";
import {
  festivalLineups,
  filterLineupsByGenre,
  type FestivalLineup,
} from "@/lib/festival";
import { CITY_PINS } from "@/lib/seedData";
import { GENRES, type Pin } from "@/lib/types";

// Independently computed expectations via reduce over CITY_PINS, so the
// grouping module is verified against the seed rather than against itself
// (same approach as analytics.test.ts).

describe("festivalLineups", () => {
  it("groups CITY_PINS's live pins by venue matching an independent tally", () => {
    const livePins = CITY_PINS.filter((pin) => pin.source === "live");
    expect(livePins.length).toBeGreaterThan(0);

    const expectedByVenue = new Map<
      string,
      { genres: Set<string>; pinIds: string[]; district: string | undefined }
    >();
    for (const pin of livePins) {
      const entry = expectedByVenue.get(pin.locationName) ?? {
        genres: new Set<string>(),
        pinIds: [],
        district: pin.district,
      };
      if (pin.genre !== "") {
        entry.genres.add(pin.genre);
      }
      entry.pinIds.push(pin.id);
      expectedByVenue.set(pin.locationName, entry);
    }

    const result = festivalLineups(CITY_PINS);

    expect(result.length).toBe(expectedByVenue.size);

    for (const lineup of result) {
      const expected = expectedByVenue.get(lineup.venue);
      expect(expected).toBeDefined();
      expect(new Set(lineup.genres)).toEqual(expected!.genres);
      expect([...lineup.pinIds].sort()).toEqual([...expected!.pinIds].sort());
      expect(lineup.district).toBe(expected!.district);
    }
  });

  it("sorts lineups alphabetically by venue", () => {
    const venues = festivalLineups(CITY_PINS).map((lineup) => lineup.venue);
    expect(venues).toEqual([...venues].sort((a, b) => a.localeCompare(b)));
  });

  it("excludes venues with no live pins", () => {
    const liveVenues = new Set(
      CITY_PINS.filter((pin) => pin.source === "live").map(
        (pin) => pin.locationName,
      ),
    );
    const nonLiveOnlyVenues = new Set(
      CITY_PINS.filter((pin) => pin.source !== "live").map(
        (pin) => pin.locationName,
      ),
    );

    const result = festivalLineups(CITY_PINS);
    for (const lineup of result) {
      expect(liveVenues.has(lineup.venue)).toBe(true);
    }
    // Sanity check the seed actually exercises the exclusion: at least one
    // venue exists that has only non-live pins and never appears live.
    const excludedSomewhere = [...nonLiveOnlyVenues].some(
      (venue) => !liveVenues.has(venue),
    );
    expect(excludedSomewhere).toBe(true);
  });

  it("returns an empty array for a pin set with no live pins", () => {
    const noLivePins = CITY_PINS.filter((pin) => pin.source !== "live");
    expect(festivalLineups(noLivePins)).toEqual([]);
  });

  it("counts a pin with an unspecified genre without adding a genre entry", () => {
    const pins: Pin[] = [
      {
        id: "x1",
        lat: 30.27,
        lng: -97.74,
        performerName: "Test Act",
        locationName: "Test Venue",
        genre: "",
        tipAmount: "",
        cashApp: "",
        venmo: "",
        source: "live",
      },
    ];
    expect(festivalLineups(pins)).toEqual([
      { venue: "Test Venue", genres: [], district: undefined, pinIds: ["x1"] },
    ]);
  });

  it("aggregates multiple live pins at the same venue into one lineup", () => {
    const pins: Pin[] = [
      {
        id: "a1",
        lat: 30.27,
        lng: -97.74,
        performerName: "Act One",
        locationName: "Shared Venue",
        genre: "Acoustic",
        tipAmount: "",
        cashApp: "",
        venmo: "",
        source: "live",
        district: "Downtown",
      },
      {
        id: "a2",
        lat: 30.27,
        lng: -97.74,
        performerName: "Act Two",
        locationName: "Shared Venue",
        genre: "Hip-Hop",
        tipAmount: "",
        cashApp: "",
        venmo: "",
        source: "live",
        district: "Downtown",
      },
    ];
    const result = festivalLineups(pins);
    expect(result).toEqual([
      {
        venue: "Shared Venue",
        genres: ["Acoustic", "Hip-Hop"],
        district: "Downtown",
        pinIds: ["a1", "a2"],
      },
    ]);
  });
});

describe("filterLineupsByGenre", () => {
  const lineups: FestivalLineup[] = festivalLineups(CITY_PINS);

  it("returns every lineup for 'All'", () => {
    expect(filterLineupsByGenre(lineups, "All")).toEqual(lineups);
  });

  it("matches an independent filter for each genre", () => {
    for (const genre of GENRES) {
      const expected = lineups.filter((lineup) =>
        lineup.genres.includes(genre),
      );
      expect(filterLineupsByGenre(lineups, genre)).toEqual(expected);
    }
  });

  it("returns an empty array when no lineup has the selected genre", () => {
    expect(filterLineupsByGenre([], "Acoustic")).toEqual([]);
  });

  it("'Unspecified' matches only lineups with zero genres recorded", () => {
    const withUnspecified: FestivalLineup[] = [
      { venue: "A", genres: [], district: undefined, pinIds: ["p1"] },
      { venue: "B", genres: ["Acoustic"], district: undefined, pinIds: ["p2"] },
    ];
    expect(filterLineupsByGenre(withUnspecified, "Unspecified")).toEqual([
      withUnspecified[0],
    ]);
  });

  it("'Unspecified' matches nothing in CITY_PINS — every live venue has a genre", () => {
    // Independent check: generateCityPins() assigns every generated venue a
    // real genre and all three ORIGINAL_PINS carry one too, so no live pin
    // is ever genre === "". This is what makes the hub's empty state
    // reachable through the "Unspecified" chip in the running app.
    const anyLiveUnspecified = CITY_PINS.some(
      (pin) => pin.source === "live" && pin.genre === "",
    );
    expect(anyLiveUnspecified).toBe(false);
    expect(filterLineupsByGenre(lineups, "Unspecified")).toEqual([]);
  });
});
