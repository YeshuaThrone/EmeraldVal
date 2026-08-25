import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

export default async function DataRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const claims = token ? verifyAdminToken(token) : null;
  if (!claims) {
    redirect("/admin/login");
  }
  return children;
}
