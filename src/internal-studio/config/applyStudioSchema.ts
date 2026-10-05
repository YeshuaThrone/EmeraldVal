import type { PoolClient } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { dbPool } from "@/streaming/db/dbEngine";

export const STUDIO_SCHEMA_PATH = path.join(
  import.meta.dirname,
  "studioSchema.sql",
);

export function readStudioSchemaSql(): string {
  return readFileSync(STUDIO_SCHEMA_PATH, "utf8");
}

async function hasAuthUsers(client: PoolClient): Promise<boolean> {
  const result = await client.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = 'auth'
        AND table_name = 'users'
      LIMIT 1`,
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Applies AnimationStudioOS tables on the cable Postgres.
 * The Supabase `auth.users` / `auth.jwt()` statements in studioSchema.sql
 * only run when that schema exists, so vanilla worfi-db still boots.
 */
export async function applyStudioSchema(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE studio_role AS ENUM ('subscriber', 'hollywood_editor', 'director', 'studio_admin');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.studio_shots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL,
      shot_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'generating',
      video_url TEXT,
      audio_stem_url TEXT,
      script_text TEXT,
      director_notes TEXT,
      animation_style TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await client.query(`
    ALTER TABLE public.studio_shots
      ADD COLUMN IF NOT EXISTS animation_style TEXT;
  `);

  await client.query(
    `ALTER TABLE public.studio_shots ENABLE ROW LEVEL SECURITY;`,
  );

  if (await hasAuthUsers(client)) {
    await client.query(`
      ALTER TABLE auth.users
        ADD COLUMN IF NOT EXISTS studio_role studio_role DEFAULT 'subscriber';
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE POLICY "Studio Team Full Access"
        ON public.studio_shots
        FOR ALL
        USING (
          (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
        )
        WITH CHECK (
          (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }
}

let applied = false;

export async function ensureStudioSchema(): Promise<void> {
  if (applied) return;
  const client = await dbPool.connect();
  try {
    await applyStudioSchema(client);
    applied = true;
  } finally {
    client.release();
  }
}
