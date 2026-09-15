import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ATXLive — Cable Network",
  description:
    "Retro cable player, program guide, and broadcast control workspace.",
};

export default function StreamingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-auto bg-[#070b19] text-white">
      {children}
    </div>
  );
}
