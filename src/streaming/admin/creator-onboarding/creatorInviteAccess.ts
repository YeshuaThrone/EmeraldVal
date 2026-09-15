export function hasCreatorInviteToken(inviteToken?: string): boolean {
  return Boolean(inviteToken?.trim());
}
