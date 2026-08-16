"use client";

import { LoaderCircle, Search, Trash2 } from "lucide-react";

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
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#00529C]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder='Any street or intersection — "6th & Brazos", "William Cannon & S 1st St"'
          className="w-full rounded-2xl border border-[#00529C]/35 bg-white py-3 pr-4 pl-11 text-sm text-[#003366] shadow-sm placeholder:text-slate-400 outline-none transition focus:border-[#00529C] focus:ring-2 focus:ring-[#00529C]/20"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSearching}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#E0144C] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c41243] disabled:cursor-not-allowed disabled:opacity-70 lg:flex-none"
        >
          {isSearching ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={pinCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00529C] bg-white px-4 py-3 text-sm font-semibold text-[#00529C] transition hover:bg-[#00529C] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Pins
        </button>
      </div>
    </form>
  );
}
