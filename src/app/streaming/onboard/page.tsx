import { CreatorOnboardingPortal } from "@/streaming/admin/creator-onboarding/CreatorOnboardingPortal";

export default async function StreamingOnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <CreatorOnboardingPortal inviteToken={token} />;
}
