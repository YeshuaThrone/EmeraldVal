"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AudioLines, Filter, Flame, LoaderCircle, Plus } from "lucide-react";
import { PIN_ZOOM } from "@/lib/constants";
import { districtForPoint } from "@/lib/district";
import {
  geocodeQuery,
  parseTipHandle,
  reverseGeocode,
  shortenDisplayName,
} from "@/lib/geocode";
import {
  DROPPED_SOURCES,
  EMPTY_FILTER,
  filterPins,
  isActive,
  toggleSources,
  type PinFilter,
} from "@/lib/filters";
import {
  getArtistPins,
  patchArtistPin,
  subscribeArtistPins,
} from "@/lib/artistPinStore";
import { CITY_PINS } from "@/lib/seedData";
import type { FlyToTarget, Pin, ToastMessage } from "@/lib/types";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import PerformerDrawer from "@/components/PerformerDrawer";
import GoLiveModal from "@/components/GoLiveModal";
import Toast from "@/components/Toast";
import ViewToggle from "@/components/ViewToggle";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-atx-paper text-atx-blue-deep">
      <LoaderCircle className="h-8 w-8 animate-spin text-atx-blue" />
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
    // districtForPoint classifies every user-created pin (search, map-drop,
    // Go-Live) the same way the seed does; isLocal is intentionally left
    // undefined here — that flag only means something for seeded venues.
    district: districtForPoint(partial.lat, partial.lng),
    ...partial,
  };
}

export default function LiveMapApp() {
  const [pins, setPins] = useState<Pin[]>(CITY_PINS);
  const [filter, setFilter] = useState<PinFilter>(EMPTY_FILTER);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [heatmapOn, setHeatmapOn] = useState(false);
  // Starts collapsed to match filtersOpen's initial true so the two never
  // overlap on first paint.
  const [searchCollapsed, setSearchCollapsed] = useState(filtersOpen);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Artist Studio pins (published shows, ON_STAGE pings) live in a
  // module-level store so they survive App Router navigation — LiveMapApp
  // unmounts when the artist leaves the fan map, plain state would not.
  // Same persistence contract as Go-Live pins: client state only, a reload
  // clears them. The studio owns these pins; the fan map renders and
  // filters them but "clear all" leaves them alone.
  // The module store is plain client state; during SSR prerender it is
  // simply empty, and the same getter serves as the server snapshot.
  const artistPins = useSyncExternalStore(
    subscribeArtistPins,
    getArtistPins,
    getArtistPins,
  );
  const allPins = useMemo(() => [...pins, ...artistPins], [pins, artistPins]);

  const visiblePins = useMemo(
    () => filterPins(allPins, filter),
    [allPins, filter],
  );

  // Drives both the header legend and FilterBar's status row from the same
  // filter.sources so the two controls never disagree about what's toggled.
  const liveActive = filter.sources.includes("live");
  const droppedActive = DROPPED_SOURCES.every((source) =>
    filter.sources.includes(source),
  );
  const artistActive = filter.sources.includes("artist");

  const toggleLegendSources = useCallback((sources: Pin["source"][]) => {
    setFilter((current) => ({
      ...current,
      sources: toggleSources(current.sources, sources),
    }));
  }, []);

  const showEmptyOverlay = visiblePins.length === 0 && isActive(filter);

  // Derived from visiblePins (not pins) so the drawer closes on its own when
  // an active filter hides the selected pin, instead of the map floating a
  // detail panel for a marker the user can no longer see.
  const selectedPin = useMemo(
    () => visiblePins.find((pin) => pin.id === selectedPinId) ?? null,
    [visiblePins, selectedPinId],
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const expandSearch = useCallback(() => {
    setSearchCollapsed(false);
  }, []);

  const collapseSearchForPan = useCallback(() => {
    setSearchCollapsed(true);
  }, []);

  // Opening the venue filter panel recedes the search bar so the two
  // controls never fight for the same header space; closing filters does
  // not auto re-expand it — that only happens via focus or the compact tap.
  // Adjusted during render (same pattern as the visiblePins reset below)
  // rather than a useEffect, which would cause an extra cascading render.
  const [prevFiltersOpen, setPrevFiltersOpen] = useState(filtersOpen);
  if (filtersOpen !== prevFiltersOpen) {
    setPrevFiltersOpen(filtersOpen);
    if (filtersOpen) {
      setSearchCollapsed(true);
    }
  }

  // When an active filter hides the selected pin, drop the stale id so it
  // doesn't silently resurface (with the drawer reopening) once the filter
  // is later relaxed and the pin becomes visible again. Adjusted during
  // render (React's documented pattern for resetting state when a derived
  // value changes: https://react.dev/learn/you-might-not-need-an-effect)
  // rather than in a useEffect, which would cause an extra cascading render.
  const [prevVisiblePins, setPrevVisiblePins] = useState(visiblePins);
  if (visiblePins !== prevVisiblePins) {
    setPrevVisiblePins(visiblePins);
    if (selectedPinId && !visiblePins.some((pin) => pin.id === selectedPinId)) {
      setSelectedPinId(null);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (goLiveOpen) {
        setGoLiveOpen(false);
        return;
      }
      if (filtersOpen) {
        setFiltersOpen(false);
        return;
      }
      if (selectedPinId) {
        setSelectedPinId(null);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goLiveOpen, filtersOpen, selectedPinId]);

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
      // Artist pins live in the studio store, not the fan-map pins state —
      // route their edits there so the drawer doesn't silently drop them.
      // (A later studio action re-syncs from the SDK, which stays the
      // source of truth for artist pins.)
      if (getArtistPins().some((pin) => pin.id === selectedPinId)) {
        patchArtistPin(selectedPinId, patch);
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
    <div className="relative h-dvh w-full overflow-hidden bg-atx-paper text-atx-ink">
      <div className="absolute inset-0 z-0">
        <MapCanvas
          pins={visiblePins}
          selectedPinId={selectedPinId}
          flyTo={flyTo}
          onSelectPin={setSelectedPinId}
          onMapClick={handleMapClick}
          onPanStart={collapseSearchForPan}
          heatmapOn={heatmapOn}
        />
      </div>

      {heatmapOn ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-24 left-4 z-20 flex items-center gap-2 rounded-2xl border border-atx-line bg-atx-paper/90 px-3 py-2 text-xs text-atx-ink shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] backdrop-blur-md md:bottom-28"
        >
          <span className="h-2 w-16 rounded-full bg-gradient-to-r from-atx-blue via-yellow-400 to-atx-red" />
          <span className="font-medium">
            Low Density (Cool Blue) &rarr; Peak Foot Traffic (Hot Red)
          </span>
        </div>
      ) : null}

      {filtersOpen ? (
        <button
          type="button"
          aria-label="Close filter panel"
          onClick={() => setFiltersOpen(false)}
          className="absolute inset-0 z-[15] cursor-default bg-transparent"
        />
      ) : null}

      {showEmptyOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="pointer-events-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-atx-line bg-atx-paper/95 p-6 text-center shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] backdrop-blur-md">
            <p className="text-sm font-medium text-atx-ink">
              No venues match your filters
            </p>
            <button
              type="button"
              onClick={() => setFilter(EMPTY_FILTER)}
              className="inline-flex items-center gap-1.5 rounded-full bg-atx-red px-4 py-2 text-xs font-semibold text-white transition hover:bg-atx-red-deep"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 md:p-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ViewToggle variant="fan" />
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-atx-red shadow-[0_0_24px_rgba(155,27,48,0.45)]">
                <AudioLines className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-atx-ink md:text-2xl">
                  ATXLive
                </h1>
                <p className="text-xs text-stone-500 md:text-sm">
                  All Austin Districts &amp; Venues
                </p>
              </div>
            </div>
            <div
              role="group"
              aria-label="Filter by status"
              className="hidden items-center gap-3 rounded-2xl border border-atx-line bg-atx-paper/80 px-3 py-2 text-xs backdrop-blur-md sm:flex"
            >
              <button
                type="button"
                aria-pressed={liveActive}
                onClick={() => toggleLegendSources(["live"])}
                className={`inline-flex items-center gap-1.5 rounded-full transition ${
                  liveActive ? "text-atx-ink" : "text-stone-400 opacity-60"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full bg-atx-red ${
                    liveActive ? "shadow-[0_0_10px_#9B1B30]" : ""
                  }`}
                />
                {liveActive ? "Live" : "Live · off"}
              </button>
              <button
                type="button"
                aria-pressed={droppedActive}
                onClick={() => toggleLegendSources(DROPPED_SOURCES)}
                className={`inline-flex items-center gap-1.5 rounded-full transition ${
                  droppedActive ? "text-atx-ink" : "text-stone-400 opacity-60"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full bg-atx-blue ${
                    droppedActive ? "shadow-[0_0_10px_#00A8E8]" : ""
                  }`}
                />
                {droppedActive ? "Dropped" : "Dropped · off"}
              </button>
              <button
                type="button"
                aria-pressed={artistActive}
                onClick={() => toggleLegendSources(["artist"])}
                className={`inline-flex items-center gap-1.5 rounded-full transition ${
                  artistActive ? "text-atx-ink" : "text-stone-400 opacity-60"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full bg-atx-electric ${
                    artistActive ? "shadow-[0_0_10px_#0055FF]" : ""
                  }`}
                />
                {artistActive ? "Artist" : "Artist · off"}
              </button>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="filter-panel"
              className="inline-flex items-center gap-2 rounded-2xl border border-atx-line bg-atx-paper/95 px-4 py-2.5 text-sm font-semibold text-atx-ink shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] backdrop-blur-md transition hover:border-atx-blue/40"
            >
              <Filter className="h-4 w-4 text-atx-blue" />
              Filters
              <span className="text-xs font-normal text-stone-400">
                {visiblePins.length} / {pins.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setHeatmapOn((on) => !on)}
              aria-pressed={heatmapOn}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] backdrop-blur-md transition ${
                heatmapOn
                  ? "border-atx-red/40 bg-atx-red text-white"
                  : "border-atx-line bg-atx-paper/95 text-atx-ink hover:border-atx-red/40"
              }`}
            >
              <Flame className={`h-4 w-4 ${heatmapOn ? "text-white" : "text-atx-red"}`} />
              Heatmap
            </button>
          </div>
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearch={handleSearch}
            onClearAll={handleClearAll}
            isSearching={isSearching}
            pinCount={allPins.length}
            collapsed={searchCollapsed}
            onExpand={expandSearch}
          />
          {filtersOpen ? (
            <FilterBar
              filter={filter}
              onChange={setFilter}
              visibleCount={visiblePins.length}
              totalCount={allPins.length}
              onClose={() => setFiltersOpen(false)}
            />
          ) : null}
        </div>
      </header>

      <button
        type="button"
        onClick={() => setGoLiveOpen(true)}
        className={`fixed right-5 bottom-6 z-30 inline-flex items-center gap-2 rounded-full bg-atx-red px-5 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(155,27,48,0.45)] transition hover:bg-atx-red-deep md:bottom-8 ${
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
