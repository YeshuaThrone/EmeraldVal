import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import DayPhaseChrome from "@/components/DayPhaseChrome";
import { DAY_PHASE_PRE_HYDRATION_SCRIPT } from "@/lib/dayPhase";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ATXLive — Austin Live Music Map",
  description:
    "Find live street performers around 6th Street, Rainey Street, and South Congress. Drop a pin, go live, and send tips.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="h-dvh overflow-hidden font-sans text-atx-ink"
      >
        {/* Skylight S2: the phase class lands on <html> before first paint
            (no flash); React never matches it — the pre-hydration script and
            DayPhaseChrome own the class, so hydration warnings are noise. */}
        <script dangerouslySetInnerHTML={{ __html: DAY_PHASE_PRE_HYDRATION_SCRIPT }} />
        <DayPhaseChrome />
        {children}
      </body>
    </html>
  );
}
