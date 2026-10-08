import {
  listStudioStaff,
  resolveStudioStaff,
  STUDIO_OWNER_EMAIL,
} from "@/internal-studio/config/staffAllowlist";
import {
  isInternalStudioRole,
  type InternalStudioRole,
} from "@/internal-studio/config/studioRoles";

export { STUDIO_OWNER_EMAIL };

export interface StaffSession {
  email: string;
  role: InternalStudioRole;
}

export function studioStaffAllowlist(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  return new Set(listStudioStaff(env).map((entry) => entry.email));
}

export const getOwnerAllowlist = studioStaffAllowlist;

/**
 * Validates staff session against the owner allowlist before pipeline operations.
 */
export function authorizeStaffAccess(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): StaffSession {
  const normalizedEmail = email.trim().toLowerCase();
  const entry = resolveStudioStaff(normalizedEmail, env);
  if (!entry || !isInternalStudioRole(entry.role)) {
    throw new Error(
      `Access Denied: ${normalizedEmail} is not authorized to execute AnimationStudioEngine pipelines.`,
    );
  }
  return {
    email: entry.email,
    role: entry.role,
  };
}
