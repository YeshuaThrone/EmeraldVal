import { redirect } from "next/navigation";
import { STREAMING_ONBOARD_ROUTE } from "@/lib/routes";

export default async function OnboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const target = token
    ? `${STREAMING_ONBOARD_ROUTE}?token=${encodeURIComponent(token)}`
    : STREAMING_ONBOARD_ROUTE;
  redirect(target);
}
