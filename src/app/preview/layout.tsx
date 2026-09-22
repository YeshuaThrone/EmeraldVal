export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-auto bg-slate-950 text-white">{children}</div>
  );
}
