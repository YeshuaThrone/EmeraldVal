"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  AUSTIN_BOUNDS,
  DEFAULT_ZOOM,
  DOWNTOWN_AUSTIN,
} from "@/lib/constants";
import { generateHeatPoints } from "@/lib/heat";
import type { FlyToTarget, Pin } from "@/lib/types";
import HeatmapLayer from "@/components/HeatmapLayer";

type MapCanvasProps = {
  pins: Pin[];
  selectedPinId: string | null;
  flyTo: FlyToTarget | null;
  onSelectPin: (id: string) => void;
  onMapClick: (lat: number, lng: number) => void;
  /** Fired the moment the user starts dragging/panning the map. */
  onPanStart?: () => void;
  /** Mounts/unmounts the corridor heat overlay; reflects the currently visible pins. */
  heatmapOn?: boolean;
};

/**
 * Marker variant per pin. Artist pins (from the Artist Studio) get their own
 * electric-blue accent; an artist pin marked ON_STAGE pulses in the dark-red
 * stage color like the Go-Live live pins. `status` lives on ArtistShowPin
 * (artistSdk.ts), so it is narrowed with an `in` check rather than widening
 * the shared Pin type.
 */
function markerKind(pin: Pin): string {
  if (pin.source === "artist") {
    // Sold-out native shows (PR 24 capacity accounting) get their own
    // muted marker so fans can tell at a glance that buying is closed.
    if (pin.ticketing?.type === "native" && pin.ticketing.capacity <= 0) {
      return "artist-soldout";
    }
    return "status" in pin && pin.status === "ON_STAGE"
      ? "artist-live"
      : "artist";
  }
  return pin.source === "live" ? "live" : "drop";
}

function glowIcon(pin: Pin, selected: boolean): L.DivIcon {
  const size = selected ? 36 : 28;
  const kind = markerKind(pin);
  return L.divIcon({
    className: "atx-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="atx-pin atx-pin-${kind}${selected ? " is-on" : ""}"></span>`,
  });
}

function MapController({
  flyTo,
  onMapClick,
  onPanStart,
}: {
  flyTo: FlyToTarget | null;
  onMapClick: (lat: number, lng: number) => void;
  onPanStart?: () => void;
}) {
  const map = useMap();

  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
    movestart() {
      onPanStart?.();
    },
  });

  useEffect(() => {
    if (!flyTo) {
      return;
    }
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom, { duration: 0.85 });
  }, [flyTo, map]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

export default function MapCanvas({
  pins,
  selectedPinId,
  flyTo,
  onSelectPin,
  onMapClick,
  onPanStart,
  heatmapOn = false,
}: MapCanvasProps) {
  // Heat reflects whatever pins are currently visible (post-filter); the
  // five corridor clusters themselves are filter-independent (see heat.ts).
  const heatPoints = useMemo(() => generateHeatPoints(pins), [pins]);

  return (
    <MapContainer
      center={DOWNTOWN_AUSTIN}
      zoom={DEFAULT_ZOOM}
      minZoom={11}
      maxZoom={18}
      maxBounds={AUSTIN_BOUNDS}
      maxBoundsViscosity={0.7}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full bg-atx-paper"
      style={{ height: "100%", width: "100%", background: "#ffffff" }}
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController flyTo={flyTo} onMapClick={onMapClick} onPanStart={onPanStart} />
      {heatmapOn ? <HeatmapLayer points={heatPoints} /> : null}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={glowIcon(pin, pin.id === selectedPinId)}
          eventHandlers={{
            click: (event) => {
              L.DomEvent.stopPropagation(event.originalEvent);
              onSelectPin(pin.id);
            },
          }}
          zIndexOffset={pin.id === selectedPinId ? 1000 : 0}
        />
      ))}
    </MapContainer>
  );
}
