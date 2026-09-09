import { describe, expect, it } from "vitest";
import { readSupabaseEnv } from "@/lib/server/supabase";

describe("readSupabaseEnv", () => {
  it("returns null when any required key is missing", () => {
    expect(
      readSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("accepts NEXT_PUBLIC_ URL/anon fallbacks plus the service role key", () => {
    expect(
      readSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon",
      serviceRoleKey: "service",
    });
  });
});
