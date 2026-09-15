export const DEFAULT_ADMIN_SECRET = "network-admin-secret-key";

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET_KEY || DEFAULT_ADMIN_SECRET;
}

export function isAdminAuthorized(
  authHeader: string | string[] | undefined | null,
): boolean {
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  return !!header && header === `Bearer ${getAdminSecret()}`;
}
