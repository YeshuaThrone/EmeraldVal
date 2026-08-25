"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_BEARING,
  DEFAULT_PITCH,
  DOWNTOWN_AUSTIN,
} from "@/lib/constants";
import {
  getMaps3d,
  hasGoogleMap3D,
  loadGoogleMapsSdk,
  type GoogleMap3DElement,
} from "@/lib/google-maps-loader";
import type { FlyToTarget, Pin, PinKind } from "@/lib/types";

type Google3DMapProps = {
  apiKey: string;
  pins: Pin[];
  selectedPinId: string | null;
  flyTo: FlyToTarget | null;
  onSelectPin: (pin: Pin) => void;
  onMapClick: (lat: number, lng: number) => void;
  onUnavailable: () => void;
};

const MARKER_COLOR: Record<PinKind, string> = {
  live: "#10B981",
  festival: "#FFE317",
  drop: "#00529C",
};

export default function Google3DMap({
  apiKey,
  pins,
  selectedPinId,
  flyTo,
  onSelectPin,
  onMapClick,
  onUnavailable,
}: Google3DMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap3DElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const onSelectRef = useRef(onSelectPin);
  const onClickRef = useRef(onMapClick);
  const onUnavailableRef = useRef(onUnavailable);
  const appliedFlyTo = useRef<FlyToTarget | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectPin;
    onClickRef.current = onMapClick;
    onUnavailableRef.current = onUnavailable;
  }, [onSelectPin, onMapClick, onUnavailable]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const loaded = await loadGoogleMapsSdk(apiKey);
        if (!loaded || !hasGoogleMap3D() || !hostRef.current) {
          onUnavailableRef.current();
          return;
        }
        try {
          const maps3d = getMaps3d();
          if (!maps3d?.Map3DElement) {
            onUnavailableRef.current();
            return;
          }
          const map3D = new maps3d.Map3DElement({
            center: {
              lat: DOWNTOWN_AUSTIN.latitude,
              lng: DOWNTOWN_AUSTIN.longitude,
              altitude: 220,
            },
            tilt: DEFAULT_PITCH,
            heading: DEFAULT_BEARING,
            range: 900,
          }) as GoogleMap3DElement;
          map3D.style.width = "100%";
          map3D.style.height = "100%";
          map3D.addEventListener("gmp-click", (event: Event) => {
            const detail = event as Event & {
              position?: { lat?: number; lng?: number };
              latLng?: { lat: () => number; lng: () => number };
            };
            const lat = detail.position?.lat ?? detail.latLng?.lat();
            const lng = detail.position?.lng ?? detail.latLng?.lng();
            if (typeof lat === "number" && typeof lng === "number") {
              onClickRef.current(lat, lng);
            }
          });
          hostRef.current.innerHTML = "";
          hostRef.current.appendChild(map3D);
          mapRef.current = map3D;
          setMapReady(true);
        } catch {
          onUnavailableRef.current();
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [apiKey]);

  useEffect(() => {
    const map3D = mapRef.current;
    const maps3d = getMaps3d();
    if (!map3D || !maps3d) {
      return;
    }
    const MarkerCtor = maps3d.Marker3DInteractiveElement ?? maps3d.Marker3DElement;
    if (!MarkerCtor) {
      return;
    }
    const stale = [...map3D.querySelectorAll("[data-atx-pin]")];
    stale.forEach((node) => node.remove());
    for (const pin of pins) {
      const marker = new MarkerCtor({
        position: { lat: pin.lat, lng: pin.lng, altitude: pin.id === selectedPinId ? 28 : 12 },
        label: pin.performerName || pin.locationName || "Live pin",
        extruded: true,
        altitudeMode: "RELATIVE_TO_GROUND",
        color: MARKER_COLOR[pin.kind],
      }) as HTMLElement;
      marker.setAttribute("data-atx-pin", pin.id);
      marker.addEventListener("gmp-click", (event) => {
        event.stopPropagation();
        onSelectRef.current(pin);
      });
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(pin);
      });
      map3D.append(marker);
    }
  }, [pins, selectedPinId, mapReady]);

  useEffect(() => {
    if (!flyTo || flyTo === appliedFlyTo.current || !mapRef.current) {
      return;
    }
    appliedFlyTo.current = flyTo;
    mapRef.current.center = {
      lat: flyTo.lat,
      lng: flyTo.lng,
      altitude: 180,
    };
    mapRef.current.tilt = DEFAULT_PITCH;
  }, [flyTo]);

  return (
    <div className="relative h-full w-full bg-[#F8FAFC]">
      <div ref={hostRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[70%] rounded-lg border border-[#00529C]/20 bg-white/90 px-2.5 py-1.5 text-[10px] leading-4 text-[#00529C] shadow-sm backdrop-blur-sm">
        <p>Drag to pan · Ctrl/right-drag to orbit · Scroll to zoom</p>
        <p className="mt-0.5 text-slate-500">Google Photorealistic 3D Map</p>
      </div>
    </div>
  );
}
