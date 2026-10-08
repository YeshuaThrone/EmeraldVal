import type { DayPhase } from "./dayPhase";

/**
 * Phase-keyed basemap for the fan map (Skylight spec art_NqnJMLfh, Move S1).
 *
 * Both phases come from Esri's Canvas family on the same host and tile
 * scheme ({z}/{y}/{x}) as the Operator Pass dark basemap — no new provider,
 * no key. Night is byte-identical to the merged Operator Pass head
 * (1351201); day swaps to Esri Light Gray Canvas. The attribution string is
 * shared by both services, so it is preserved across the swap (the
 * MapCanvas comment records the CARTO history that moved the app to Esri).
 */

export interface BasemapLayer {
  url: string;
  attribution?: string;
}

export interface BasemapTiles {
  base: BasemapLayer;
  reference: BasemapLayer;
}

const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';

// Night: the Operator Pass dark civic basemap, verbatim.
const DARK_TILES: BasemapTiles = {
  base: {
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: ESRI_ATTRIBUTION,
  },
  reference: {
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  },
};

// Day: the light counterpart from the same Canvas family.
const LIGHT_TILES: BasemapTiles = {
  base: {
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: ESRI_ATTRIBUTION,
  },
  reference: {
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  },
};

export function basemapTilesFor(phase: DayPhase): BasemapTiles {
  return phase === "day" ? LIGHT_TILES : DARK_TILES;
}
