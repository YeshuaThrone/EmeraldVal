import type { StudioShotStatus } from "./config/studioRoles";

export interface StudioShotRow {
  id: string;
  project_id: string;
  shot_id: string;
  status: StudioShotStatus;
  video_url: string | null;
  audio_stem_url: string | null;
  script_text: string | null;
  director_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterModelRow {
  id: string;
  project_id: string;
  character_name: string;
  lora_checkpoint_url: string;
  face_embedding_id: string | null;
  turnaround_sheet_url: string;
  created_at: string;
}

export interface ShotCardRow {
  id: string;
  project_id: string;
  scene_number: number;
  shot_number: number;
  script_text: string;
  camera_motion: string;
  assigned_character_id: string | null;
  prompt_override: string | null;
  created_at: string;
}
