"use client";

import { LoaderCircle, MapPinned, Search, Trash2 } from "lucide-react";

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onClearAll: () => void;
  isSearching: boolean;
  pinCount: number;
};

export default function SearchBar({
  query,
  onQueryChange,
  onSearch,
  onClearAll,
  isSearching,
  pinCount,
}: SearchBarProps) {
  return (
    <form
      className="pointer-events-auto flex w-full flex-col gap-3 lg:flex-row lg:items-center"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <label className="relative block min-w-0 flex-1">
        <span className="sr-only">Search any Austin street or intersection</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-atx-blue" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder='Any street or intersection — "6th & Brazos", "William Cannon & S 1st St"'
          className="w-full rounded-2xl border border-atx-line bg-atx-paper/95 py-3 pr-4 pl-11 text-sm text-atx-ink shadow-[0_0_0_1px_rgba(28,25,23,0.08),0_12px_40px_rgba(28,25,23,0.18)] placeholder:text-stone-400 outline-none backdrop-blur-md transition focus:border-atx-blue focus:ring-2 focus:ring-atx-blue/40"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSearching}
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
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-atx-line bg-atx-paper px-4 py-3 text-sm font-semibold text-stone-600 backdrop-blur-md transition hover:border-atx-red/50 hover:text-atx-red disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Pins
        </button>
      </div>
    </form>
  );
}
