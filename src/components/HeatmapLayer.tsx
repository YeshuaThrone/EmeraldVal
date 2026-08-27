"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { HeatPoint } from "@/lib/heat";

/** Cool-blue (low density) → hot-red (peak foot traffic), matching the legend swatch. */
const HEAT_GRADIENT: Record<number, string> = {
  0.2: "#00a8e8",
  0.4: "#00c2d1",
  0.6: "#ffd23f",
  0.8: "#ff7a3d",
  1.0: "#9b1b30",
};

/**
 * leaflet.heat's UMD build reads the plugin-global `L` directly rather than
 * taking an ES import, so it needs `L` on `window` before the plugin module
 * evaluates. Cached as a module-level promise so this side-effecting import
 * only ever runs once, no matter how many times HeatmapLayer mounts.
 */
let heatPluginLoad: Promise<void> | null = null;

function ensureHeatPlugin(): Promise<void> {
  if (!heatPluginLoad) {
    heatPluginLoad = (async () => {
      (window as typeof window & { L?: typeof L }).L = L;
      await import("leaflet.heat");
    })();
  }
  return heatPluginLoad;
}

function toLatLngTuples(points: HeatPoint[]): L.HeatLatLngTuple[] {
  return points.map((point) => [point.lat, point.lng, point.intensity]);
}

type HeatmapLayerProps = {
  points: HeatPoint[];
};

/**
 * Renders `points` as a leaflet.heat canvas overlay. Mounting/unmounting
 * this component is what turns the heat layer on and off — see the
 * "Heatmap" toggle in LiveMapApp, which conditionally renders this inside
 * MapCanvas rather than hiding it with CSS.
 */
export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.HeatLayer | null>(null);
  // Kept alongside layerRef so the mount effect (which only depends on
  // `map`) can seed the layer with whatever points are current by the time
  // the async plugin import resolves, without re-running on every prop change.
  const latestPoints = useRef(points);
  useEffect(() => {
    latestPoints.current = points;
  }, [points]);

  useEffect(() => {
    let cancelled = false;

    ensureHeatPlugin().then(() => {
      if (cancelled) {
        return;
      }
      const heatLayer = L.heatLayer(toLatLngTuples(latestPoints.current), {
        radius: 28,
        blur: 22,
        maxZoom: 17,
        gradient: HEAT_GRADIENT,
      });
      heatLayer.addTo(map);
      layerRef.current = heatLayer;
    });

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map]);

  // Refresh the existing layer's data in place when the visible pins (and
  // therefore the heat points) change, instead of tearing the layer down.
  useEffect(() => {
    layerRef.current?.setLatLngs(toLatLngTuples(points));
  }, [points]);

  return null;
}
