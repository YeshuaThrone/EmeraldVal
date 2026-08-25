"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AudioLines, LoaderCircle, Plus } from "lucide-react";
import { INITIAL_PINS, PIN_ZOOM } from "@/lib/constants";
import { LIVE_TTL_MS, isPinExpired } from "@/lib/countdown";
import {
  geocodeQuery,
  parseTipHandle,
  reverseGeocode,
  shortenDisplayName,
} from "@/lib/geocode";
import type {
  FlyToTarget,
  GenreFilter,
  MapViewMode,
  Pin,
  ToastMessage,
} from "@/lib/types";
import SearchBar from "@/components/SearchBar";
import PerformerDrawer from "@/components/PerformerDrawer";
import GoLiveModal from "@/components/GoLiveModal";
import Toast from "@/components/Toast";
import ViewToggle from "@/components/ViewToggle";
import GenreChips from "@/components/GenreChips";
import FestivalFinder from "@/components/FestivalFinder";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F8FAFC] text-[#00529C]">
      <LoaderCircle className="h-8 w-8 animate-spin text-[#E0144C]" />
      <p className="text-sm tracking-wide">Loading 3D Austin map…</p>
    </div>
  ),
});

function createPin(partial: Pick<Pin, "lat" | "lng" | "source"> & Partial<Pin>): Pin {
  const liveAt = partial.liveAt ?? Date.now();
  const kind =
    partial.kind ??
    (partial.source === "live"
      ? "live"
      : partial.source === "festival"
        ? "festival"
        : "drop");

  return {
    id: crypto.randomUUID(),
    performerName: "",
    locationName: "",
    genre: "",
    tipAmount: "",
    cashApp: "",
    venmo: "",
    kind,
    liveAt,
    liveUntil: partial.liveUntil ?? liveAt + LIVE_TTL_MS,
    ...partial,
  };
}

function matchesGenreFilter(pin: Pin, filter: GenreFilter): boolean {
  if (filter === "All") {
    return true;
  }
  if (filter === "Festivals") {
    return pin.kind === "festival";
  }
  if (pin.kind === "festival") {
    return (pin.stages ?? []).some((stage) =>
      stage.sets.some((set) => set.genre === filter),
    );
  }
  return pin.genre === filter;
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
  const [viewMode, setViewMode] = useState<MapViewMode>("map");
  const [genreFilter, setGenreFilter] = useState<GenreFilter>("All");
  const [now, setNow] = useState(() => Date.now());

  const visiblePins = useMemo(
    () =>
      pins.filter(
        (pin) => !isPinExpired(pin.liveUntil, now) && matchesGenreFilter(pin, genreFilter),
      ),
    [genreFilter, now, pins],
  );

  const selectedPin = useMemo(
    () => visiblePins.find((pin) => pin.id === selectedPinId) ?? null,
    [selectedPinId, visiblePins],
  );

  const festivals = useMemo(
    () =>
      pins.filter(
        (pin) =>
          pin.kind === "festival" &&
          !isPinExpired(pin.liveUntil, now) &&
          matchesGenreFilter(pin, genreFilter === "Festivals" ? "All" : genreFilter),
      ),
    [genreFilter, now, pins],
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      setPins((existing) => {
        const next = existing.filter((pin) => !isPinExpired(pin.liveUntil, current));
        return next.length === existing.length ? existing : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
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
        return;
      }
      if (viewMode === "festivals") {
        setViewMode("map");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goLiveOpen, selectedPinId, viewMode]);

  const addPinAndFocus = useCallback((pin: Pin) => {
    setPins((current) => [...current, pin]);
    setSelectedPinId(pin.id);
    setViewMode("map");
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
          kind: "drop",
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

      if (viewMode === "festivals") {
        setSelectedPinId(null);
        setViewMode("map");
        return;
      }

      if (selectedPinId) {
        setSelectedPinId(null);
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
            kind: "drop",
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
    [addPinAndFocus, goLiveOpen, isClicking, selectedPinId, viewMode],
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
            kind: "live",
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

  const handleSelectPin = useCallback((pin: Pin) => {
    setViewMode("map");
    setSelectedPinId(pin.id);
    setFlyTo({ lat: pin.lat, lng: pin.lng, zoom: PIN_ZOOM });
  }, []);

  const handleClosePerformerDrawer = useCallback(() => {
    setSelectedPinId(null);
  }, []);

  const handleCloseFestivalFinder = useCallback(() => {
    setSelectedPinId(null);
    setViewMode("map");
  }, []);

  const handleSelectFestival = useCallback(
    (id: string) => {
      const festival = pins.find((pin) => pin.id === id);
      if (!festival) {
        return;
      }
      handleSelectPin(festival);
    },
    [handleSelectPin, pins],
  );

  const festivalFinderOpen = viewMode === "festivals" && !selectedPin;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#F8FAFC] text-[#003366]">
      <div className="absolute inset-0 z-0">
        <MapCanvas
          pins={visiblePins}
          selectedPinId={selectedPinId}
          flyTo={flyTo}
          onSelectPin={handleSelectPin}
          onMapClick={handleMapClick}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 md:p-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-[#00529C]/25 bg-white px-3 py-2 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00529C]">
                <AudioLines className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-[#003366] md:text-2xl">
                  ATX Live
                </h1>
                <p className="text-xs text-[#00529C] md:text-sm">
                  Austin Live Music Map · 6th · Rainey · South Congress
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewToggle
                mode={viewMode}
                onModeChange={(mode) => {
                  setSelectedPinId(null);
                  setViewMode(mode);
                }}
              />
              <div className="hidden items-center gap-3 rounded-2xl border border-[#00529C]/25 bg-white px-3 py-2 text-xs text-[#00529C] shadow-sm sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                  Live
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FFE317] shadow-[0_0_8px_#FFE317]" />
                  Festivals
                </span>
              </div>
            </div>
          </div>
          <GenreChips value={genreFilter} onChange={setGenreFilter} />
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
        className={`fixed right-5 bottom-6 z-30 inline-flex items-center gap-2 rounded-full bg-[#E0144C] px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#c41243] md:bottom-8 ${
          selectedPin || festivalFinderOpen ? "pointer-events-none opacity-0" : ""
        }`}
      >
        <Plus className="h-5 w-5" />
        Drop Pin / Go Live
      </button>

      <FestivalFinder
        open={festivalFinderOpen}
        festivals={festivals}
        now={now}
        genreFilter={genreFilter}
        onClose={handleCloseFestivalFinder}
        onSelect={handleSelectFestival}
      />

      <PerformerDrawer
        pin={selectedPin}
        now={now}
        onChange={handlePinChange}
        onClose={handleClosePerformerDrawer}
        onSendTip={handleSendTip}
      />

      {goLiveOpen ? (
        <GoLiveModal
          isSubmitting={isGoingLive}
          onClose={() => setGoLiveOpen(false)}
          onSubmit={handleGoLive}
        />
      ) : null}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
