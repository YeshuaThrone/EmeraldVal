export const STUDIO_ROLES = [
  "subscriber",
  "hollywood_editor",
  "director",
  "studio_admin",
] as const;

export type StudioRole = (typeof STUDIO_ROLES)[number];

export const INTERNAL_STUDIO_ROLES = [
  "hollywood_editor",
  "director",
  "studio_admin",
] as const;

export type InternalStudioRole = (typeof INTERNAL_STUDIO_ROLES)[number];

export const STUDIO_SHOT_STATUSES = [
  "generating",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type StudioShotStatus = (typeof STUDIO_SHOT_STATUSES)[number];

export function isStudioRole(value: string): value is StudioRole {
  return (STUDIO_ROLES as readonly string[]).includes(value);
}

export function isInternalStudioRole(
  value: string | null | undefined,
): value is InternalStudioRole {
  if (!value) return false;
  return (INTERNAL_STUDIO_ROLES as readonly string[]).includes(value);
}
