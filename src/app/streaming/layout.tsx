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
    <div className="h-dvh overflow-auto bg-slate-950 text-slate-100">
      {children}
    </div>
  );
}
