import { redirect } from "next/navigation";
import { CreatorOnboardGate } from "@/streaming/admin/creator-onboarding/CreatorOnboardGate";
import { STREAMING_ROUTE } from "@/lib/routes";

export default async function StreamingOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token?.trim();
  if (!invite) {
    redirect(STREAMING_ROUTE);
  }
  return <CreatorOnboardGate inviteToken={invite} />;
}
