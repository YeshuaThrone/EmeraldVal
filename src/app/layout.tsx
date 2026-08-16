import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
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
  title: "ATX Live — Austin Live Music Map",
  description:
    "Find live street performers around 6th Street, Rainey Street, and South Congress. Drop a pin, go live, and send tips.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="h-dvh overflow-hidden bg-[#F8FAFC] font-sans text-[#003366]">
        {children}
      </body>
    </html>
  );
}
