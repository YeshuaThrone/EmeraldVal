import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseAdmin(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, key);
}
