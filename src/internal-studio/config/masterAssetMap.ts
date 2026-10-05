export type StudioAssetTag =
  | "@image1"
  | "@image2"
  | "@location_view1"
  | "@video1"
  | "@video2";

export interface MasterAsset {
  tag: StudioAssetTag;
  role: string;
  speaker: "primary" | "secondary" | "location" | "none";
}

export const MASTER_ASSET_MAP: readonly MasterAsset[] = [
  {
    tag: "@image1",
    role: "Primary Character Reference Sheet",
    speaker: "primary",
  },
  {
    tag: "@image2",
    role: "Secondary Character Reference Sheet / Key Visual",
    speaker: "secondary",
  },
  {
    tag: "@location_view1",
    role: "Empty Location Background Angle",
    speaker: "location",
  },
  {
    tag: "@video1",
    role: "Primary Character Blank Video Audio Stem",
    speaker: "primary",
  },
  {
    tag: "@video2",
    role: "Secondary Character Blank Video Audio Stem",
    speaker: "secondary",
  },
] as const;

export const DEFAULT_ART_STYLE =
  "High-contrast 2D urban animation, crisp line art, vibrant studio lighting, matching @image1 and @image2";

export const DEFAULT_SCENE_SETTING = "Shown in @location_view1";

export function videoStemForSpeaker(
  speaker: "primary" | "secondary",
): "@video1" | "@video2" {
  return speaker === "secondary" ? "@video2" : "@video1";
}

export function imageTagForSpeaker(
  speaker: "primary" | "secondary",
): "@image1" | "@image2" {
  return speaker === "secondary" ? "@image2" : "@image1";
}
