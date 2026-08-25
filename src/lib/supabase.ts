import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey || url.includes("YOUR_") || anonKey.includes("YOUR_")) {
    return null;
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

export function getSupabase(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) {
    return null;
  }
  return createClient(config.url, config.anonKey);
}

export const supabase = getSupabase();
