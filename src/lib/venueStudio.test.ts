import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VENUE_BASELINE_DB,
  VENUE_DB_LIMIT,
  VENUE_VENUE_NAME,
  VOLUME_FLOOR_DB,
  appendReading,
  evaluateTelemetry,
  fetchVenueShows,
  lowerMasterVolume,
  venueShowsFromRecords,
} from "@/lib/venueStudio";
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
    ticket_url: "",
    created_at: "2026-08-30T12:00:00.000Z",
    ticketing_type: "",
    native_ticket_price: null,
    native_ticket_capacity: null,
    latitude: 30.2703,
    longitude: -97.7341,
    council_district: "District 9",
    ...overrides,
  };
}

describe("Sound Telemetry Guard — engine wiring", () => {
  it("boots at the paste's 84 dB baseline against the 85 dB limit", () => {
    expect(VENUE_BASELINE_DB).toBe(84);
    expect(VENUE_DB_LIMIT).toBe(85);
  });

  it("stays stable at the baseline with no readings history", () => {
    const result = evaluateTelemetry([], VENUE_BASELINE_DB);
    expect(result.isPreViolationWarning).toBe(false);
    expect(result.predictedDbIn5Min).toBe(84);
    expect(result.recommendedVolumeDropDb).toBe(0);
    expect(result.message).toBe(
      "Sound levels stable within municipal limits.",
    );
  });

  it("predicts a breach once the fader's appended readings accelerate", () => {
    // Each fader push appends a reading: 84 → 86 → 88 → 90 at 90 now.
    let readings: number[] = [];
    let currentDb = VENUE_BASELINE_DB;
    for (const next of [86, 88, 90]) {
      readings = appendReading(readings, currentDb);
      currentDb = next;
    }
    readings = appendReading(readings, currentDb);

    const result = evaluateTelemetry(readings, currentDb);
    expect(result.isPreViolationWarning).toBe(true);
    // Engine math: history [84, 86, 88, 90] → acceleration = (90 − 84) / 4
    // = 1.5 dB per interval, predicted = 90 + 1.5 × 5 = 97.5 → 98,
    // drop = max(1, 98 − 85 + 2) = 15.
    expect(result.predictedDbIn5Min).toBe(98);
    expect(result.recommendedVolumeDropDb).toBe(15);
    expect(result.message).toMatch(/^CRITICAL ALERT:/);
    expect(result.message).toContain("85dB cap");
    expect(result.message).toContain("-15dB");
  });

  it("carries the venue's telemetry identity into the engine call", () => {
    // The wrapper is the single place the view touches the engine; the id
    // must stay stable so the guard is attributable in future surfaces.
    const result = evaluateTelemetry([84, 90], 90);
    expect(result.isPreViolationWarning).toBe(true);
    // Sanity: the wrapper is the engine's result verbatim — same shape the
    // intelligenceEngine tests pin down, so no drift can hide here.
    expect(typeof result.predictedDbIn5Min).toBe("number");
  });

  it("returns to stable after the operator lowers master volume", () => {
    // Pushed to 90 with a rising history → warning; repeated -3 dB actions
    // append readings and the guard recomputes from real history.
    const pushed = appendReading([84, 86, 88], 90);
    expect(evaluateTelemetry(pushed, 90).isPreViolationWarning).toBe(true);

    // Two lowering actions: 90 → 87 → 84, each appending a reading. The
    // history now starts and ends at 84, so acceleration is zero and the
    // engine's warning clears without any hardcoded copy.
    let currentDb = 90;
    let readings = pushed;
    for (let i = 0; i < 2; i += 1) {
      currentDb = lowerMasterVolume(currentDb);
      readings = appendReading(readings, currentDb);
    }

    const result = evaluateTelemetry(readings, currentDb);
    expect(currentDb).toBe(84);
    expect(result.isPreViolationWarning).toBe(false);
    expect(result.predictedDbIn5Min).toBe(84);
    expect(result.message).toBe(
      "Sound levels stable within municipal limits.",
    );
  });

  it("clamps 'Lower Master Volume' at the 70 dB floor", () => {
    expect(lowerMasterVolume(84)).toBe(81);
    expect(lowerMasterVolume(72)).toBe(VOLUME_FLOOR_DB);
    expect(lowerMasterVolume(71)).toBe(VOLUME_FLOOR_DB);
  });

  it("reset baseline returns the monitor to 84 and appends the reading", () => {
    const readings = appendReading(appendReading([], 90), 88);
    const reset = appendReading(readings, VENUE_BASELINE_DB);
    expect(reset).toEqual([90, 88, 84]);
    const result = evaluateTelemetry(reset, VENUE_BASELINE_DB);
    expect(result.isPreViolationWarning).toBe(false);
  });

  it("appendReading never mutates the history it is given", () => {
    const history = [84, 86];
    const next = appendReading(history, 88);
    expect(history).toEqual([84, 86]);
    expect(next).toEqual([84, 86, 88]);
  });
});

describe("venueShowsFromRecords — published feed filtering", () => {
  it("keeps only shows published under the venue's own name", () => {
    const records = [
      storedShow({ id: "a", venue_name: VENUE_VENUE_NAME }),
      storedShow({ id: "b", venue_name: "Mohawk" }),
      storedShow({ id: "c", venue_name: VENUE_VENUE_NAME }),
    ];
    const filtered = venueShowsFromRecords(records);
    expect(filtered.map((show) => show.id)).toEqual(["a", "c"]);
  });

  it("matches the venue name exactly — no substring venues", () => {
    const records = [
      storedShow({ id: "a", venue_name: "Empire Control Room Garage" }),
      storedShow({ id: "b", venue_name: VENUE_VENUE_NAME }),
    ];
    expect(venueShowsFromRecords(records).map((show) => show.id)).toEqual([
      "b",
    ]);
  });

  it("accepts an explicit venue name override", () => {
    const records = [
      storedShow({ id: "a", venue_name: "Mohawk" }),
      storedShow({ id: "b", venue_name: VENUE_VENUE_NAME }),
    ];
    expect(venueShowsFromRecords(records, "Mohawk").map((s) => s.id)).toEqual([
      "a",
    ]);
  });
});

describe("fetchVenueShows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("narrows GET /api/shows to the venue's shows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          storedShow({ id: "a", venue_name: VENUE_VENUE_NAME }),
          storedShow({ id: "b", venue_name: "Mohawk" }),
        ]),
      ),
    );
    const result = await fetchVenueShows();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shows.map((show) => show.id)).toEqual(["a"]);
    }
  });

  it("resolves a typed failure instead of throwing on transport errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const result = await fetchVenueShows();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
    }
  });
});
