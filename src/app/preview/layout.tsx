export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-auto bg-wurfi-void text-white">{children}</div>
  );
}
