"use client";

import { useEffect } from "react";
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
import type { FlyToTarget, Pin } from "@/lib/types";

type MapCanvasProps = {
  pins: Pin[];
  selectedPinId: string | null;
  flyTo: FlyToTarget | null;
  onSelectPin: (id: string) => void;
  onMapClick: (lat: number, lng: number) => void;
};

function glowIcon(pin: Pin, selected: boolean): L.DivIcon {
  const size = selected ? 36 : 28;
  const kind = pin.source === "live" ? "live" : "drop";
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
}: {
  flyTo: FlyToTarget | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
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
}: MapCanvasProps) {
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
      className="h-full w-full bg-[#0B0F17]"
      style={{ height: "100%", width: "100%", background: "#0B0F17" }}
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapController flyTo={flyTo} onMapClick={onMapClick} />
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
