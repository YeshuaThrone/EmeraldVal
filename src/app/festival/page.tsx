import { Ticket } from "lucide-react";
import ViewToggle from "@/components/ViewToggle";
import FestivalHub from "@/components/FestivalHub";
import FoundersTiers from "@/components/FoundersTiers";

export const metadata = {
  title: "ATXLive — Festival & Founders Hub",
  description:
    "Active Austin festival lineups drawn from live pins, plus Founders support tiers for ATXLive.",
};

export default function FestivalPage() {
  return (
    <div className="min-h-dvh w-full bg-atx-paper text-atx-ink">
      <header className="border-b border-atx-line bg-atx-paper/95 p-4 backdrop-blur-md md:p-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ViewToggle variant="festival" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-atx-red shadow-[0_0_24px_rgba(155,27,48,0.45)]">
              <Ticket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-atx-ink md:text-2xl">
                Festival &amp; Founders Hub
              </h1>
              <p className="text-xs text-stone-500 md:text-sm">
                Active lineups across Austin, plus ways to back the scene
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4 md:p-6">
        <FestivalHub />
        <FoundersTiers />
      </main>
    </div>
  );
}
