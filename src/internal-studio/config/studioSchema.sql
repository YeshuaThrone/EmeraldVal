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
