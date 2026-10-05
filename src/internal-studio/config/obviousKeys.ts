export function getObviousApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.OBVIOUS_API_KEY ?? env.ANIMATION_STUDIO_OS_OBVIOUS_KEY ?? "").trim();
}

export function getObviousWebhookSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.OBVIOUS_WEBHOOK_SECRET ??
    env.ANIMATION_STUDIO_OS_WEBHOOK_SECRET ??
    ""
  ).trim();
}

export function getStudioStaffSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.ANIMATION_STUDIO_OS_SECRET ?? "").trim();
}

export function getSupabaseJwtSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.SUPABASE_JWT_SECRET ?? env.ANIMATION_STUDIO_OS_JWT_SECRET ?? "").trim();
}

export function getSeeDanceApiUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.SEEDANCE_API_URL ?? env.ANIMATION_STUDIO_OS_SEEDANCE_URL ?? "").trim();
}

export function getSeeDanceApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.SEEDANCE_API_KEY ?? env.ANIMATION_STUDIO_OS_SEEDANCE_KEY ?? "").trim();
}
