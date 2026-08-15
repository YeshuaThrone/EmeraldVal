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
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#8B5CF6]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder='Any street or intersection — "6th & Brazos", "William Cannon & S 1st St"'
          className="w-full rounded-2xl border border-white/10 bg-[#0B0F17]/90 py-3 pr-4 pl-11 text-sm text-white shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_12px_40px_rgba(0,0,0,0.45)] placeholder:text-zinc-500 outline-none backdrop-blur-md transition focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/40"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSearching}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,0.45)] transition hover:bg-[#7c4eef] disabled:cursor-not-allowed disabled:opacity-70 lg:flex-none"
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
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#121826]/90 px-4 py-3 text-sm font-semibold text-zinc-200 backdrop-blur-md transition hover:border-[#F59E0B]/50 hover:text-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Pins
        </button>
      </div>
    </form>
  );
}
