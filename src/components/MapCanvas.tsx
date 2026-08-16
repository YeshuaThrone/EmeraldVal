"use client";

import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  AmbientLight,
  FlyToInterpolator,
  LightingEffect,
  TerrainController,
  _SunLight as SunLight,
  type Layer,
  type MapViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { Tile3DLayer, TileLayer } from "@deck.gl/geo-layers";
import { Tiles3DLoader } from "@loaders.gl/3d-tiles";
import { BitmapLayer, ColumnLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  DEFAULT_BEARING,
  DEFAULT_PITCH,
  DEFAULT_ZOOM,
  DOWNTOWN_AUSTIN,
  pinElevationMeters,
  pinGlowPixels,
  pinRadiusMeters,
} from "@/lib/constants";
import type { FlyToTarget, Pin, PinKind } from "@/lib/types";

const GOOGLE_3D_TILES_URL = "https://tile.googleapis.com/v1/3dtiles/root.json";
const LIGHT_FALLBACK_TILES =
  "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";

type AustinViewState = MapViewState & {
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator;
};

type MapCanvasProps = {
  pins: Pin[];
  selectedPinId: string | null;
  flyTo: FlyToTarget | null;
  onSelectPin: (id: string) => void;
  onMapClick: (lat: number, lng: number) => void;
};

const KIND_COLORS: Record<
  PinKind,
  { fill: [number, number, number, number]; glow: [number, number, number, number] }
> = {
  live: { fill: [16, 185, 129, 255], glow: [16, 185, 129, 110] },
  festival: { fill: [255, 227, 23, 255], glow: [255, 227, 23, 120] },
  drop: { fill: [0, 82, 156, 245], glow: [0, 82, 156, 90] },
};

function isPinObject(value: unknown): value is Pin {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.lat === "number" &&
    typeof record.lng === "number"
  );
}

function createLightBasemap() {
  return new TileLayer({
    id: "light-fallback-tiles",
    data: LIGHT_FALLBACK_TILES,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    pickable: false,
    renderSubLayers: (props) => {
      const bbox = props.tile.boundingBox;
      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]],
      });
    },
  });
}

export default function MapCanvas({
  pins,
  selectedPinId,
  flyTo,
  onSelectPin,
  onMapClick,
}: MapCanvasProps) {
  const googleMapsApiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
  const [credits, setCredits] = useState("© Google");
  const [tilesFailed, setTilesFailed] = useState(false);
  const [viewState, setViewState] = useState<AustinViewState>({
    latitude: DOWNTOWN_AUSTIN.latitude,
    longitude: DOWNTOWN_AUSTIN.longitude,
    zoom: DEFAULT_ZOOM,
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    minZoom: 11,
    maxZoom: 20,
    minPitch: 0,
    maxPitch: 85,
  });
  const [appliedFlyTo, setAppliedFlyTo] = useState<FlyToTarget | null>(null);

  if (flyTo && flyTo !== appliedFlyTo) {
    setAppliedFlyTo(flyTo);
    setViewState((current) => ({
      ...current,
      latitude: flyTo.lat,
      longitude: flyTo.lng,
      zoom: flyTo.zoom,
      pitch: DEFAULT_PITCH,
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }),
    }));
  }

  const zoom = viewState.zoom ?? DEFAULT_ZOOM;
  const radius = pinRadiusMeters(zoom);
  const elevation = pinElevationMeters(zoom);
  const useGoogle3d = Boolean(googleMapsApiKey) && !tilesFailed;

  const daylightEffect = useMemo(() => {
    const ambientLight = new AmbientLight({
      color: [255, 255, 255],
      intensity: 1.9,
    });
    const sunLight = new SunLight({
      timestamp: Date.UTC(2026, 7, 16, 19, 0, 0),
      color: [255, 244, 214],
      intensity: 2.2,
    });
    return new LightingEffect({ ambientLight, sunLight });
  }, []);

  const layers = useMemo(() => {
    let basemap: Layer = createLightBasemap();

    if (useGoogle3d) {
      try {
        basemap = new Tile3DLayer({
          id: "google-3d-tiles",
          data: GOOGLE_3D_TILES_URL,
          loader: Tiles3DLoader,
          operation: "terrain+draw",
          pickable: false,
          loadOptions: {
            worker: false,
            fetch: {
              headers: {
                "X-GOOG-API-KEY": process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
              },
            },
          },
          onTileError: () => {
            setTilesFailed(true);
          },
          onTilesetLoad: (tileset) => {
            try {
              const tileset3d = tileset as {
                options: {
                  onTraversalComplete?: (tiles: unknown[]) => unknown[];
                };
              };
              tileset3d.options.onTraversalComplete = (selectedTiles) => {
                const names = new Set<string>();
                for (const tile of selectedTiles) {
                  const copyright = (
                    tile as {
                      content?: { gltf?: { asset?: { copyright?: string } } };
                    }
                  ).content?.gltf?.asset?.copyright;
                  if (copyright) {
                    copyright.split(";").forEach((entry) => names.add(entry.trim()));
                  }
                }
                if (names.size > 0) {
                  setCredits([...names].join("; "));
                }
                return selectedTiles;
              };
            } catch {
              setTilesFailed(true);
            }
          },
        });
      } catch {
        basemap = createLightBasemap();
      }
    }

    const glow = new ScatterplotLayer<Pin>({
      id: "pin-glow",
      data: pins,
      pickable: false,
      radiusUnits: "pixels",
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      lineWidthMaxPixels: 5,
      getPosition: (pin) => [pin.lng, pin.lat],
      getRadius: (pin) => pinGlowPixels(zoom, pin.id === selectedPinId) + 2,
      getFillColor: (pin) => KIND_COLORS[pin.kind].glow,
      getLineColor: (pin) => KIND_COLORS[pin.kind].fill,
    });

    const columns = new ColumnLayer<Pin>({
      id: "pin-columns",
      data: pins,
      pickable: true,
      extruded: true,
      diskResolution: 18,
      radius,
      radiusUnits: "meters",
      elevationScale: 1,
      coverage: 1,
      getPosition: (pin) => [pin.lng, pin.lat],
      getFillColor: (pin) => KIND_COLORS[pin.kind].fill,
      getElevation: (pin) =>
        pin.id === selectedPinId ? elevation * 1.35 : elevation,
      material: {
        ambient: 0.62,
        diffuse: 0.78,
        shininess: 40,
        specularColor: [255, 255, 255],
      },
    });

    return [basemap, glow, columns];
  }, [useGoogle3d, pins, radius, elevation, selectedPinId, zoom]);

  return (
    <div className="relative h-full w-full bg-[#F8FAFC]">
      <DeckGL
        viewState={viewState}
        controller={{
          type: TerrainController,
          touchRotate: true,
          dragRotate: true,
          inertia: true,
        }}
        effects={[daylightEffect]}
        layers={layers}
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
        }
        onViewStateChange={({ viewState: next }) => {
          setViewState(next as AustinViewState);
        }}
        onClick={(info: PickingInfo) => {
          if (isPinObject(info.object)) {
            onSelectPin(info.object.id);
            return;
          }
          const coordinate = info.coordinate;
          if (coordinate && coordinate.length >= 2) {
            onMapClick(coordinate[1], coordinate[0]);
          }
        }}
        style={{ width: "100%", height: "100%", background: "#F8FAFC" }}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[70%] rounded-lg border border-[#00529C]/20 bg-white/90 px-2.5 py-1.5 text-[10px] leading-4 text-[#00529C] shadow-sm backdrop-blur-sm">
        <p>Drag to pan · Ctrl/right-drag to orbit · Scroll to zoom</p>
        <p className="mt-0.5 text-slate-500">
          {useGoogle3d
            ? credits
            : "Light OSM/Carto basemap · add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google 3D Tiles"}
        </p>
      </div>
    </div>
  );
}
