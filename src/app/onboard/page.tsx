import { redirect } from "next/navigation";
import { STREAMING_ONBOARD_ROUTE, STREAMING_ROUTE } from "@/lib/routes";

export default async function OnboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token?.trim();
  if (!invite) {
    redirect(STREAMING_ROUTE);
  }
  redirect(`${STREAMING_ONBOARD_ROUTE}?token=${encodeURIComponent(invite)}`);
}
