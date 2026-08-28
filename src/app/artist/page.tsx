import Link from "next/link";
import { X } from "lucide-react";
import ArtistUploadWidget from "@/components/ArtistUploadWidget";
import ViewToggle from "@/components/ViewToggle";
import { FAN_MAP_ROUTE } from "@/lib/routes";

export const metadata = {
  title: "ATXLive — Artist Studio",
  description:
    "Publish your Austin shows and go live on stage — your sets appear as pins on the ATXLive fan map.",
};

/**
 * Artist Studio. Same route-as-modal treatment as the Festival Finder: a
 * dimmed backdrop with a single centered white card, the X returning to the
 * fan map. The card hosts the Artist Control Panel widget.
 */
export default function ArtistPage() {
  return (
    <div className="min-h-dvh w-full bg-atx-ink/70 px-4 py-6 backdrop-blur-sm md:py-10">
      <div className="mx-auto w-full max-w-md">
        <section
          aria-label="Artist Studio"
          className="relative max-h-[88dvh] overflow-y-auto rounded-3xl border border-atx-line bg-atx-paper p-5 shadow-[0_24px_80px_rgba(28,25,23,0.45)] md:p-7"
        >
          <Link
            href={FAN_MAP_ROUTE}
            aria-label="Close Artist Studio and return to the fan map"
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-atx-line bg-atx-paper text-stone-500 transition hover:border-atx-electric/50 hover:text-atx-electric"
          >
            <X className="h-4 w-4" />
          </Link>

          <div className="mt-4">
            <ViewToggle variant="artist" />
          </div>

          <div className="mt-6">
            <ArtistUploadWidget />
          </div>
        </section>
      </div>
    </div>
  );
}
