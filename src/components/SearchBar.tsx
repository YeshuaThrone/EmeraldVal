"use client";

import { useRef } from "react";
import { LoaderCircle, MapPinned, Search, Trash2 } from "lucide-react";

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onClearAll: () => void;
  isSearching: boolean;
  pinCount: number;
  /** True while the map is panning or the filter panel is open. */
  collapsed: boolean;
  /** Re-expands the bar — called from the compact affordance or input focus. */
  onExpand: () => void;
};

export default function SearchBar({
  query,
  onQueryChange,
  onSearch,
  onClearAll,
  isSearching,
  pinCount,
  collapsed,
  onExpand,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pointer-events-none relative w-full">
      {/* Compact affordance: replaces the full bar while collapsed, and
          re-expands + refocuses the input on tap. */}
      <button
        type="button"
        onClick={() => {
          onExpand();
          // Wait for the expand transition to hand off focus so the
          // keyboard/caret lands in a fully-visible input.
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
        aria-label="Expand search"
        aria-expanded={!collapsed}
        aria-controls="fan-map-search-form"
        tabIndex={collapsed ? 0 : -1}
        className={`absolute inset-x-0 top-0 inline-flex w-fit items-center gap-2 rounded-2xl border border-atx-line bg-atx-paper/95 px-4 py-3 text-sm font-medium text-atx-ink shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] backdrop-blur-md transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
          collapsed
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <Search className="h-4 w-4 text-atx-blue" />
        Search
      </button>

      <form
        id="fan-map-search-form"
        aria-hidden={collapsed}
        className={`flex w-full flex-col gap-3 overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 lg:flex-row lg:items-center ${
          collapsed
            ? "pointer-events-none max-h-0 -translate-y-1 opacity-0"
            : "pointer-events-auto max-h-32 translate-y-0 opacity-100"
        }`}
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search any Austin street or intersection</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-atx-blue" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={onExpand}
            tabIndex={collapsed ? -1 : 0}
            placeholder='Any street or intersection — "6th & Brazos", "William Cannon & S 1st St"'
            className="w-full rounded-2xl border border-atx-line bg-atx-paper/95 py-3 pr-4 pl-11 text-sm text-atx-ink shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] placeholder:text-stone-400 outline-none backdrop-blur-md transition focus:border-atx-blue focus:ring-2 focus:ring-atx-blue/40"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSearching}
            tabIndex={collapsed ? -1 : 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-atx-red px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(155,27,48,0.4)] transition hover:bg-atx-red-deep disabled:cursor-not-allowed disabled:opacity-70 lg:flex-none"
          >
            {isSearching ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <MapPinned className="h-4 w-4" />
            )}
            Drop pin
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={pinCount === 0}
            tabIndex={collapsed ? -1 : 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-atx-line bg-atx-paper px-4 py-3 text-sm font-semibold text-stone-600 backdrop-blur-md transition hover:border-atx-red/50 hover:text-atx-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Pins
          </button>
        </div>
      </form>
    </div>
  );
}
