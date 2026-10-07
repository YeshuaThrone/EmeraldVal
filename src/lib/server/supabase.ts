import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase clients for Covnant signup.
 *
 * Auth signUp uses the anon/publishable key so native email confirmation
 * runs. Profile inserts and compensating user deletes use the service
 * role because Confirm email leaves `session` null until the creator
 * clicks the link — there is no user JWT to satisfy RLS yet.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function readSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseEnv | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return null;
  }
  return { url, anonKey, serviceRoleKey };
}

const SERVER_AUTH = {
  autoRefreshToken: false,
  persistSession: false,
} as const;

export function createAuthClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, { auth: SERVER_AUTH });
}

export function createAdminClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, { auth: SERVER_AUTH });
}
