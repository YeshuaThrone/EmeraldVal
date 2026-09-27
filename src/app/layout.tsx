import type { Metadata } from "next";
import { DM_Sans, Oswald, Outfit, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const worfiEpg = Oswald({
  variable: "--font-worfi-epg",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const worfiOsd = Share_Tech_Mono({
  variable: "--font-worfi-osd",
  subsets: ["latin"],
  weight: "400",
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
      className={`${outfit.variable} ${dmSans.variable} ${worfiEpg.variable} ${worfiOsd.variable} h-full antialiased`}
    >
      <body className="h-dvh overflow-hidden bg-atx-paper font-sans text-atx-ink">
        {children}
      </body>
    </html>
  );
}
