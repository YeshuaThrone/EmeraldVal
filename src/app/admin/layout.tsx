import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ATX Live Data Room",
  description: "Municipal HOT, corridor heat, attendance, and Luminate POS audit.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
