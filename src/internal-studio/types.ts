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
