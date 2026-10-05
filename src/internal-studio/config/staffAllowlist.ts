import {
  isInternalStudioRole,
  isStudioRole,
  type InternalStudioRole,
  type StudioRole,
} from "./studioRoles";

/** Owner of this network — always studio_admin. */
export const STUDIO_OWNER_EMAIL = "3bbullion@gmail.com";

export interface StudioStaffEntry {
  email: string;
  role: StudioRole;
}

function parseStaffToken(token: string): StudioStaffEntry | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const [rawEmail, rawRole] = trimmed.split(":");
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!email) return null;
  const role = (rawRole ?? "").trim().toLowerCase();
  if (role && isStudioRole(role)) {
    return { email, role };
  }
  return { email, role: "hollywood_editor" };
}

/**
 * Additional employees. ANIMATION_STUDIO_OS_STAFF is a comma list of
 * `email` or `email:role` (role defaults to hollywood_editor).
 */
export function listStudioStaff(
  env: NodeJS.ProcessEnv = process.env,
): StudioStaffEntry[] {
  const extras = (env.ANIMATION_STUDIO_OS_STAFF ?? "")
    .split(",")
    .map(parseStaffToken)
    .filter((entry): entry is StudioStaffEntry => entry !== null);

  const byEmail = new Map<string, StudioStaffEntry>();
  byEmail.set(STUDIO_OWNER_EMAIL, {
    email: STUDIO_OWNER_EMAIL,
    role: "studio_admin",
  });
  for (const entry of extras) {
    if (entry.email === STUDIO_OWNER_EMAIL) continue;
    byEmail.set(entry.email, entry);
  }
  return [...byEmail.values()];
}

export function resolveStudioStaff(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): StudioStaffEntry | null {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  return listStudioStaff(env).find((entry) => entry.email === key) ?? null;
}

export function isInternalStudioStaff(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const entry = resolveStudioStaff(email, env);
  return !!entry && isInternalStudioRole(entry.role);
}

export type { InternalStudioRole, StudioRole };
