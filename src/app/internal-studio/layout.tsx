import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AnimationStudioOS",
  robots: { index: false, follow: false },
};

export default function InternalStudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
