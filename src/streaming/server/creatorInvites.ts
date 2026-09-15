import crypto from "node:crypto";
import { dbPool, isUnavailableDb } from "../db/dbEngine";

export interface CreatorInviteRow {
  id: string;
  token: string;
  creator_name: string;
  creator_email: string;
  is_used: boolean;
  expires_at: Date;
}

export async function createCreatorInvite(input: {
  creatorName: string;
  creatorEmail: string;
  validDays?: number;
}): Promise<{ token: string; inviteUrl: string; expiresAt: Date; id: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const id = `inv-${crypto.randomUUID()}`;
  const validDays = input.validDays ?? 7;
  const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

  await dbPool.query(
    `INSERT INTO creator_invites (id, token, creator_name, creator_email, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, token, input.creatorName, input.creatorEmail, expiresAt],
  );

  const inviteUrl = `${process.env.PUBLIC_APP_URL || "http://localhost:3000"}/streaming/onboard?token=${token}`;
  return { token, inviteUrl, expiresAt, id };
}

export async function findValidInvite(
  token: string,
): Promise<CreatorInviteRow | null> {
  const result = await dbPool.query(
    `SELECT * FROM creator_invites WHERE token = $1 AND is_used = FALSE AND expires_at > NOW()`,
    [token],
  );
  return (result.rows[0] as CreatorInviteRow | undefined) ?? null;
}

export function readInviteToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const token = (body as { inviteToken?: unknown }).inviteToken;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

/**
 * Public creator ingest is invite-only. When Postgres is down the token
 * still has to be present; a live row check runs when the DB is reachable.
 */
export async function assertCreatorInviteToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const invite = await findValidInvite(token);
    if (!invite) {
      return { ok: false, error: "Invalid or expired invite token" };
    }
    return { ok: true };
  } catch (err) {
    if (isUnavailableDb(err)) {
      return { ok: true };
    }
    throw err;
  }
}
