import { describe, expect, it } from "vitest";
import { basemapTilesFor } from "./basemap";

/**
 * Per-phase basemap contract (Skylight spec art_NqnJMLfh, Move S1). The
 * night strings below are copied verbatim from the Operator Pass dark
 * basemap (merged main 1351201) — night appearance must be identical.
 */

const HOST = "https://services.arcgisonline.com/arcgis/rest/services/Canvas/";

const NIGHT_BASE_URL = `${HOST}World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const NIGHT_REFERENCE_URL = `${HOST}World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const NIGHT_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';

describe("basemapTilesFor", () => {
  it("night keeps the Operator Pass dark basemap byte-identical (1351201)", () => {
    const night = basemapTilesFor("night");
    expect(night.base.url).toBe(NIGHT_BASE_URL);
    expect(night.reference.url).toBe(NIGHT_REFERENCE_URL);
    expect(night.base.attribution).toBe(NIGHT_ATTRIBUTION);
  });

  it("day swaps to Esri Light Gray Canvas on the same host and tile scheme", () => {
    const day = basemapTilesFor("day");
    expect(day.base.url).toBe(`${HOST}World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`);
    expect(day.reference.url).toBe(
      `${HOST}World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    );
    // Same provider family: {z}/{y}/{x} scheme, services.arcgisonline.com.
    expect(day.base.url.startsWith("https://services.arcgisonline.com/")).toBe(true);
    expect(day.base.url.endsWith("/{z}/{y}/{x}")).toBe(true);
  });

  it("attribution is preserved across the phase swap", () => {
    const day = basemapTilesFor("day");
    const night = basemapTilesFor("night");
    expect(day.base.attribution).toBe(NIGHT_ATTRIBUTION);
    expect(day.base.attribution).toBe(night.base.attribution);
  });

  it("phases never share a tile URL set", () => {
    const day = basemapTilesFor("day");
    const night = basemapTilesFor("night");
    expect(day.base.url).not.toBe(night.base.url);
    expect(day.reference.url).not.toBe(night.reference.url);
  });
});
