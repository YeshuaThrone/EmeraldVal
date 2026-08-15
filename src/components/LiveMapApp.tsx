"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AudioLines, LoaderCircle, Plus } from "lucide-react";
import { INITIAL_PINS, PIN_ZOOM } from "@/lib/constants";
import {
  geocodeQuery,
  parseTipHandle,
  reverseGeocode,
  shortenDisplayName,
} from "@/lib/geocode";
import type { FlyToTarget, Pin, ToastMessage } from "@/lib/types";
import SearchBar from "@/components/SearchBar";
import PerformerDrawer from "@/components/PerformerDrawer";
import GoLiveModal from "@/components/GoLiveModal";
import Toast from "@/components/Toast";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0B0F17] text-[#c4b5fd]">
      <LoaderCircle className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      <p className="text-sm tracking-wide">Loading Austin map…</p>
    </div>
  ),
});

function createPin(partial: Pick<Pin, "lat" | "lng" | "source"> & Partial<Pin>): Pin {
  return {
    id: crypto.randomUUID(),
    performerName: "",
    locationName: "",
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    ...partial,
  };
}

export default function LiveMapApp() {
  const [pins, setPins] = useState<Pin[]>(INITIAL_PINS);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const selectedPin = useMemo(
    () => pins.find((pin) => pin.id === selectedPinId) ?? null,
    [pins, selectedPinId],
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (goLiveOpen) {
        setGoLiveOpen(false);
        return;
      }
      if (selectedPinId) {
        setSelectedPinId(null);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goLiveOpen, selectedPinId]);

  const addPinAndFocus = useCallback((pin: Pin) => {
    setPins((current) => [...current, pin]);
    setSelectedPinId(pin.id);
    setFlyTo({ lat: pin.lat, lng: pin.lng, zoom: PIN_ZOOM });
  }, []);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setToast({
        type: "error",
        message: "Type any Austin street or intersection first.",
      });
      return;
    }

    setIsSearching(true);
    try {
      const result = await geocodeQuery(query);
      if (!result.ok) {
        setToast({ type: "error", message: result.error });
        return;
      }

      addPinAndFocus(
        createPin({
          lat: result.lat,
          lng: result.lng,
          locationName: shortenDisplayName(result.displayName),
          source: "search",
        }),
      );
      setToast({
        type: "success",
        message: `Pinned ${shortenDisplayName(result.displayName)}.`,
      });
    } catch {
      setToast({
        type: "error",
        message: "Search failed. Please try again.",
      });
    } finally {
      setIsSearching(false);
    }
  }, [addPinAndFocus, searchQuery]);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (isClicking || goLiveOpen) {
        return;
      }

      setIsClicking(true);
      try {
        const result = await reverseGeocode(lat, lng);
        const locationName = result.ok
          ? shortenDisplayName(result.displayName)
          : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        addPinAndFocus(
          createPin({
            lat,
            lng,
            locationName,
            source: "map",
          }),
        );
      } catch {
        setToast({
          type: "error",
          message: "Could not drop a pin at that spot.",
        });
      } finally {
        setIsClicking(false);
      }
    },
    [addPinAndFocus, goLiveOpen, isClicking],
  );

  const handleGoLive = useCallback(
    async (values: {
      performerName: string;
      genre: Pin["genre"];
      streetAddress: string;
      handle: string;
    }) => {
      setIsGoingLive(true);
      try {
        const result = await geocodeQuery(values.streetAddress);
        if (!result.ok) {
          setToast({ type: "error", message: result.error });
          return;
        }

        const handles = parseTipHandle(values.handle);
        addPinAndFocus(
          createPin({
            lat: result.lat,
            lng: result.lng,
            performerName: values.performerName.trim(),
            locationName: values.streetAddress.trim(),
            genre: values.genre,
            cashApp: handles.cashApp,
            venmo: handles.venmo,
            source: "live",
          }),
        );
        setGoLiveOpen(false);
        setToast({
          type: "success",
          message: `${values.performerName.trim()} is live on the map.`,
        });
      } catch {
        setToast({
          type: "error",
          message: "Could not go live. Try another address.",
        });
      } finally {
        setIsGoingLive(false);
      }
    },
    [addPinAndFocus],
  );

  const handleSendTip = useCallback(() => {
    if (!selectedPin) {
      return;
    }

    const amount = Number(selectedPin.tipAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast({
        type: "error",
        message: "Enter a tip amount in dollars first.",
      });
      return;
    }

    const name = selectedPin.performerName.trim() || "the performer";
    const cash = selectedPin.cashApp.trim();
    const venmo = selectedPin.venmo.trim();
    let method = "your saved handle";
    if (cash && venmo) {
      method = `Cash App $${cash} and Venmo @${venmo}`;
    } else if (cash) {
      method = `Cash App $${cash}`;
    } else if (venmo) {
      method = `Venmo @${venmo}`;
    } else {
      setToast({
        type: "error",
        message: "Add a Cash App ($) or Venmo (@) handle before sending.",
      });
      return;
    }

    setToast({
      type: "success",
      message: `Sent $${amount} to ${name} via ${method}.`,
    });
  }, [selectedPin]);

  const handleClearAll = useCallback(() => {
    setPins([]);
    setSelectedPinId(null);
    setSearchQuery("");
    setFlyTo(null);
    setToast({ type: "success", message: "All pins cleared." });
  }, []);

  const handlePinChange = useCallback(
    (patch: Partial<Pin>) => {
      if (!selectedPinId) {
        return;
      }
      setPins((current) =>
        current.map((pin) =>
          pin.id === selectedPinId ? { ...pin, ...patch } : pin,
        ),
      );
    },
    [selectedPinId],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0B0F17] text-white">
      <div className="absolute inset-0 z-0">
        <MapCanvas
          pins={pins}
          selectedPinId={selectedPinId}
          flyTo={flyTo}
          onSelectPin={setSelectedPinId}
          onMapClick={handleMapClick}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 md:p-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8B5CF6] shadow-[0_0_24px_rgba(139,92,246,0.55)]">
                <AudioLines className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-white md:text-2xl">
                  ATX Live
                </h1>
                <p className="text-xs text-zinc-400 md:text-sm">
                  Austin Live Music Map · 6th · Rainey · South Congress
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#0B0F17]/80 px-3 py-2 text-xs text-zinc-400 backdrop-blur-md sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6] shadow-[0_0_10px_#8B5CF6]" />
                Live
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_10px_#F59E0B]" />
                Dropped
              </span>
            </div>
          </div>
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearch={handleSearch}
            onClearAll={handleClearAll}
            isSearching={isSearching}
            pinCount={pins.length}
          />
        </div>
      </header>

      <button
        type="button"
        onClick={() => setGoLiveOpen(true)}
        className={`fixed right-5 bottom-6 z-30 inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.55)] transition hover:bg-[#7c4eef] md:bottom-8 ${
          selectedPin ? "pointer-events-none opacity-0" : ""
        }`}
      >
        <Plus className="h-5 w-5" />
        Drop Pin / Go Live
      </button>

      <PerformerDrawer
        pin={selectedPin}
        onChange={handlePinChange}
        onClose={() => setSelectedPinId(null)}
        onSendTip={handleSendTip}
      />

      <GoLiveModal
        open={goLiveOpen}
        isSubmitting={isGoingLive}
        onClose={() => setGoLiveOpen(false)}
        onSubmit={handleGoLive}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
