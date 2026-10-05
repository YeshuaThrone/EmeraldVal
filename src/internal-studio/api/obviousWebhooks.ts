import { createHmac, timingSafeEqual } from "node:crypto";
import { getObviousWebhookSecret } from "../config/obviousKeys";

export const OBVIOUS_WEBHOOK_EVENTS = [
  "shot.ready",
  "shot.failed",
  "stitch.complete",
  "review.approved",
  "review.rejected",
] as const;

export type ObviousWebhookEvent = (typeof OBVIOUS_WEBHOOK_EVENTS)[number];

export interface ObviousWebhookPayload {
  event: ObviousWebhookEvent;
  shotId?: string;
  projectId?: string;
  videoUrl?: string;
  audioStemUrl?: string;
  notes?: string;
}

export function verifyObviousSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const secret = getObviousWebhookSecret(env);
  if (!secret) return false;
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signatureHeader.replace(/^sha256=/i, "").trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseObviousWebhook(
  body: unknown,
): ObviousWebhookPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Obvious webhook body is invalid");
  }
  const record = body as Record<string, unknown>;
  const event = record.event;
  if (
    typeof event !== "string" ||
    !(OBVIOUS_WEBHOOK_EVENTS as readonly string[]).includes(event)
  ) {
    throw new Error("Obvious webhook event is not supported");
  }
  return {
    event: event as ObviousWebhookEvent,
    shotId: typeof record.shotId === "string" ? record.shotId : undefined,
    projectId:
      typeof record.projectId === "string" ? record.projectId : undefined,
    videoUrl: typeof record.videoUrl === "string" ? record.videoUrl : undefined,
    audioStemUrl:
      typeof record.audioStemUrl === "string" ? record.audioStemUrl : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
  };
}
