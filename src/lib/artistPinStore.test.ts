import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArtistPins,
  patchArtistPin,
  setArtistPins,
  subscribeArtistPins,
} from "@/lib/artistPinStore";
import type { ArtistShowPin } from "@/lib/artistSdk";

function makePin(id: string): ArtistShowPin {
  return {
    id,
    lat: 30.2655,
    lng: -97.743,
    performerName: "Test Artist",
    locationName: "Empire Control Room",
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    source: "artist",
    district: "Downtown",
    artistId: "test-artist",
    status: "SCHEDULED",
    setTime: new Date().toISOString(),
  };
}

afterEach(() => {
  setArtistPins([]);
});

describe("artistPinStore", () => {
  it("starts empty", () => {
    expect(getArtistPins()).toEqual([]);
  });

  it("stores pins and returns the same snapshot reference until set again", () => {
    const pins = [makePin("pin-1")];
    setArtistPins(pins);

    expect(getArtistPins()).toBe(pins);
    expect(getArtistPins()).toHaveLength(1);
  });

  it("notifies subscribers on set and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeArtistPins(listener);

    setArtistPins([makePin("pin-1")]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setArtistPins([makePin("pin-2")]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("replacing pins notifies every active listener with the new snapshot", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeArtistPins(first);
    subscribeArtistPins(second);

    setArtistPins([makePin("pin-1"), makePin("pin-2")]);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(getArtistPins()).toHaveLength(2);

    unsubscribeFirst();
  });
});


describe("patchArtistPin", () => {
  it("merges display-field patches onto the matching pin", () => {
    setArtistPins([makePin("pin-1")]);

    patchArtistPin("pin-1", { performerName: "Renamed Artist" });

    expect(getArtistPins()[0].performerName).toBe("Renamed Artist");
    expect(getArtistPins()[0].source).toBe("artist");
  });

  it("refuses a patch that tries to re-source an artist pin", () => {
    setArtistPins([makePin("pin-1")]);

    patchArtistPin("pin-1", { source: "search" });

    expect(getArtistPins()[0].source).toBe("artist");
  });

  it("ignores unknown pin ids", () => {
    setArtistPins([makePin("pin-1")]);

    patchArtistPin("missing", { performerName: "Nope" });

    expect(getArtistPins()[0].performerName).toBe("Test Artist");
  });
});
