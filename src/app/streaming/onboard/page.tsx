import { redirect } from "next/navigation";
import { CreatorOnboardingPortal } from "@/streaming/admin/creator-onboarding/CreatorOnboardingPortal";
import { STREAMING_ROUTE } from "@/lib/routes";
import { assertCreatorInviteToken } from "@/streaming/server/creatorInvites";

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
  const check = await assertCreatorInviteToken(invite);
  if (!check.ok) {
    redirect(STREAMING_ROUTE);
  }
  return <CreatorOnboardingPortal inviteToken={invite} />;
}
