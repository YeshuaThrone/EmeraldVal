"use client";

/**
 * VenueStudioHeader — the master SDK's studio header. The title row
 * reserves pr-12, the District Sound & Density display scoots mr-10 clear
 * of the close (X) button, and the close button floats absolute top-right
 * with z-30. Themed onto the app's atx-* tokens.
 *
 * The header replaces the Venue Studio's previous title + live-pill block;
 * the LIVE FEED badge lives inside the title row per the master SDK spec.
 */
export default function VenueStudioHeader({
  venueName,
  densityIndexText,
  onClose,
}: {
  venueName: string;
  densityIndexText: string;
  onClose: () => void;
}) {
  return (
    <header className="relative flex flex-wrap items-center justify-between gap-3">
      {/* Title & Live Badge */}
      <div className="flex items-center space-x-3 overflow-hidden pr-12">
        <h1 className="text-xl font-semibold whitespace-nowrap text-atx-ink md:text-2xl">
          {venueName} — Venue Studio
        </h1>
        <span className="whitespace-nowrap rounded-full border border-atx-red/30 bg-atx-red/10 px-2.5 py-0.5 text-xs font-bold text-atx-red">
          ● LIVE FEED
        </span>
      </div>

      {/* District Sound & Density Index Display — mr-10 keeps the index
          away from the close (X) button container. */}
      <div className="mr-10 hidden items-center space-x-2 whitespace-nowrap text-sm text-stone-400 md:flex">
        <span className="font-medium">District Sound &amp; Density:</span>
        <span className="rounded-md border border-atx-line bg-atx-paper px-2.5 py-1 font-bold text-atx-ink">
          {densityIndexText}
        </span>
      </div>

      {/* Close (X) Button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3.5 right-4 z-30 rounded-full p-2 text-stone-400 transition-all hover:bg-atx-paper hover:text-atx-ink focus:outline-none"
        aria-label="Close Studio"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </header>
  );
}
