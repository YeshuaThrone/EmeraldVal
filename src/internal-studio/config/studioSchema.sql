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
    animation_style TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.studio_shots ADD COLUMN IF NOT EXISTS animation_style TEXT;

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

-- 6. Character LoRA / turnaround registry
CREATE TABLE IF NOT EXISTS public.character_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    character_name VARCHAR(100) NOT NULL,
    lora_checkpoint_url TEXT NOT NULL,
    face_embedding_id VARCHAR(128),
    turnaround_sheet_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Storyboard shot cards (one unique card per scene/shot)
CREATE TABLE IF NOT EXISTS public.shot_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    scene_number INT NOT NULL,
    shot_number INT NOT NULL,
    script_text TEXT NOT NULL,
    camera_motion VARCHAR(50) NOT NULL, -- e.g. 'Dynamic Anime Zoom', 'Pan Right'
    assigned_character_id UUID REFERENCES public.character_models(id),
    prompt_override TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_shot_per_scene UNIQUE (project_id, scene_number, shot_number)
);

ALTER TABLE public.character_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shot_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio Team Character Models"
ON public.character_models
FOR ALL
USING (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
)
WITH CHECK (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
);

CREATE POLICY "Studio Team Shot Cards"
ON public.shot_cards
FOR ALL
USING (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
)
WITH CHECK (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
);

-- 8. Canonical face embeddings (pgvector) for character lock
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.character_models
    ADD COLUMN IF NOT EXISTS face_embedding vector(512);

CREATE OR REPLACE FUNCTION public.match_character_embedding(
    target_character_id uuid,
    candidate_vector vector(512)
)
RETURNS TABLE (similarity double precision)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        1::double precision - (cm.face_embedding <=> candidate_vector),
        0::double precision
    ) AS similarity
    FROM public.character_models AS cm
    WHERE cm.id = target_character_id;
$$;

-- 9. Production queue for compiled conditioning payloads
CREATE TABLE IF NOT EXISTS public.shot_render_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shot_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    user_id UUID,
    status TEXT NOT NULL DEFAULT 'queued',
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.shot_render_jobs ADD COLUMN IF NOT EXISTS queue_job_id TEXT;
ALTER TABLE public.shot_render_jobs ADD COLUMN IF NOT EXISTS episode_id TEXT;
ALTER TABLE public.shot_render_jobs ADD COLUMN IF NOT EXISTS hls_master_url TEXT;
ALTER TABLE public.shot_render_jobs ADD COLUMN IF NOT EXISTS requested_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS shot_render_jobs_queue_job_id
  ON public.shot_render_jobs (queue_job_id)
  WHERE queue_job_id IS NOT NULL;

ALTER TABLE public.shot_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio Team Shot Render Jobs"
ON public.shot_render_jobs
FOR ALL
USING (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
)
WITH CHECK (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
);

-- 10. Screen-space camera trajectories
CREATE TABLE IF NOT EXISTS public.shot_motion_trajectories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shot_id VARCHAR(128) NOT NULL,
    project_id UUID NOT NULL,
    duration_seconds NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    zoom_factor NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    trajectory_points JSONB NOT NULL,
    camera_vector_string TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_motion_trajectories_shot
ON public.shot_motion_trajectories (shot_id);

ALTER TABLE public.shot_motion_trajectories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio Team Motion Trajectories"
ON public.shot_motion_trajectories
FOR ALL
USING (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
)
WITH CHECK (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
);

-- 11. Extracted / authored scene structures
CREATE TABLE IF NOT EXISTS public.scene_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    structure_name TEXT NOT NULL,
    tier TEXT NOT NULL,
    style_preset TEXT NOT NULL,
    primary_material TEXT NOT NULL,
    roof_material TEXT NOT NULL,
    facade_style TEXT NOT NULL,
    generated_prompt TEXT NOT NULL,
    negative_prompt TEXT,
    accent_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    color_palette JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(4, 3),
    condition TEXT,
    damage_intensity NUMERIC(3, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.scene_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio Team Scene Structures"
ON public.scene_structures
FOR ALL
USING (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
)
WITH CHECK (
    (auth.jwt() ->> 'studio_role') IN ('hollywood_editor', 'director', 'studio_admin')
);
