-- AnimationStudioOS / Supabase
-- Internal staff only: hollywood_editor, director, studio_admin.
-- subscribers have no access.

-- 1. Create custom enum for internal studio roles
CREATE TYPE studio_role AS ENUM ('subscriber', 'hollywood_editor', 'director', 'studio_admin');

-- 2. Add studio profile metadata to users table
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS studio_role studio_role DEFAULT 'subscriber';

-- 3. Create Studio OS Shots Table
CREATE TABLE IF NOT EXISTS public.studio_shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    shot_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'generating', -- 'generating', 'pending_review', 'approved', 'rejected'
    video_url TEXT,
    audio_stem_url TEXT,
    script_text TEXT,
    director_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.studio_shots ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy: Only Internal Studio Roles Can Read/Write Studio Shots
CREATE POLICY "Studio Team Full Access"
ON public.studio_shots
FOR ALL
USING (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
)
WITH CHECK (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
);
