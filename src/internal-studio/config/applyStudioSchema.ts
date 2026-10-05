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

type StudioRlsTable = "studio_shots" | "character_models" | "shot_cards";

const STUDIO_ROLE_PREDICATE =
  "(auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')";

async function enableStudioTableRls(
  client: PoolClient,
  table: StudioRlsTable,
): Promise<void> {
  await client.query(
    `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
  );
}

async function createStudioTeamPolicy(
  client: PoolClient,
  table: StudioRlsTable,
  policyName: string,
): Promise<void> {
  await client.query(
    `DO $$ BEGIN
      CREATE POLICY "${policyName}"
      ON public.${table}
      FOR ALL
      USING (
        ${STUDIO_ROLE_PREDICATE}
      )
      WITH CHECK (
        ${STUDIO_ROLE_PREDICATE}
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;`,
  );
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

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.character_models (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL,
      character_name VARCHAR(100) NOT NULL,
      lora_checkpoint_url TEXT NOT NULL,
      face_embedding_id VARCHAR(128),
      turnaround_sheet_url TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.shot_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL,
      scene_number INT NOT NULL,
      shot_number INT NOT NULL,
      script_text TEXT NOT NULL,
      camera_motion VARCHAR(50) NOT NULL,
      assigned_character_id UUID REFERENCES public.character_models(id),
      prompt_override TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_shot_per_scene UNIQUE (project_id, scene_number, shot_number)
    );
  `);

  await client.query(`
    DO $$ BEGIN
      ALTER TABLE public.shot_cards
        ADD CONSTRAINT unique_shot_per_scene
        UNIQUE (project_id, scene_number, shot_number);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END $$;
  `);

  await enableStudioTableRls(client, "studio_shots");
  await enableStudioTableRls(client, "character_models");
  await enableStudioTableRls(client, "shot_cards");

  if (await hasAuthUsers(client)) {
    await client.query(`
      ALTER TABLE auth.users
        ADD COLUMN IF NOT EXISTS studio_role studio_role DEFAULT 'subscriber';
    `);
    await createStudioTeamPolicy(client, "studio_shots", "Studio Team Full Access");
    await createStudioTeamPolicy(
      client,
      "character_models",
      "Studio Team Character Models",
    );
    await createStudioTeamPolicy(client, "shot_cards", "Studio Team Shot Cards");
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
