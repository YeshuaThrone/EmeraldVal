/**
 * Covenant phone OTP SDK (sandbox).
 *
 * The Obvious / MCP paste called this `CovenantAuthSDK` and talked to
 * live WhatsApp Cloud, TextBee, and Supabase. This module keeps that
 * surface (`sendOtp` / `verifyOtp`) and the multi-channel fallback
 * order, but never opens those networks. Challenges live in process
 * memory — the stand-in for a Supabase `otp_challenges` table.
 *
 * Dispatch order: WhatsApp → TextBee → email-to-SMS (carrier domain).
 * Failures: `{ ok: false, code, message }`.
 */

import { createHash, randomInt, randomUUID } from "node:crypto";

export const PHONE_OTP_TTL_MS = 10 * 60_000;
export const PHONE_OTP_MAX_ATTEMPTS = 5;
export const PHONE_OTP_LENGTH = 6;

export const PHONE_OTP_CHANNELS = [
  "whatsapp",
  "textbee",
  "email_to_sms",
] as const;

export type PhoneOtpChannel = (typeof PHONE_OTP_CHANNELS)[number];

export type CovenantAuthSdkConfig = {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  whatsappApiToken?: string;
  whatsappPhoneId?: string;
  textbeeApiKey?: string;
  textbeeDeviceId?: string;
};

export type SendOtpInput = {
  userId: string;
  phone: string;
  carrierDomain?: string;
};

export type VerifyOtpInput = {
  userId: string;
  phone: string;
  code: string;
};

export type SendOtpSuccess = {
  ok: true;
  mode: "sandbox";
  challengeId: string;
  userId: string;
  phone: string;
  channel: PhoneOtpChannel;
  fallbacksAttempted: PhoneOtpChannel[];
  providerMessageId: string;
  expiresAt: string;
  /** Sandbox-only. Live adapters must omit the plaintext code. */
  sandboxCode: string;
};

export type VerifyOtpSuccess = {
  ok: true;
  mode: "sandbox";
  challengeId: string;
  userId: string;
  phone: string;
  verifiedAt: string;
  channel: PhoneOtpChannel;
};

export type PhoneOtpFailure = {
  ok: false;
  code: string;
  message: string;
};

export type SendOtpResult = SendOtpSuccess | PhoneOtpFailure;
export type VerifyOtpResult = VerifyOtpSuccess | PhoneOtpFailure;

export type PhoneOtpChallenge = {
  id: string;
  userId: string;
  phone: string;
  codeHash: string;
  channel: PhoneOtpChannel;
  fallbacksAttempted: PhoneOtpChannel[];
  providerMessageId: string;
  carrierDomain?: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt?: string;
  consumed: boolean;
};

export type PhoneChannelSendResult =
  | { ok: true; channel: PhoneOtpChannel; providerMessageId: string }
  | { ok: false; channel: PhoneOtpChannel; code: string; message: string };

export type PhoneChannelAdapter = {
  readonly channel: PhoneOtpChannel;
  configured(): boolean;
  send(input: {
    phone: string;
    code: string;
    carrierDomain?: string;
  }): Promise<PhoneChannelSendResult>;
};

const E164_RE = /^\+[1-9]\d{7,14}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OTP_RE = /^\d{6}$/;
const CARRIER_DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function fail(code: string, message: string): PhoneOtpFailure {
  return { ok: false, code, message };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asTrimmed(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

export function hashPhoneOtp(
  userId: string,
  phone: string,
  code: string,
): string {
  return createHash("sha256")
    .update(`${userId}:${phone}:${code}`)
    .digest("hex");
}

export function parseSendOtpInput(
  body: unknown,
): { ok: true; value: SendOtpInput } | PhoneOtpFailure {
  const row = asRecord(body);
  if (!row) {
    return fail("malformed_body", "Request body must be a JSON object.");
  }
  const userId = asTrimmed(row.userId);
  if (!userId) {
    return fail("missing_user_id", "userId is required.");
  }
  if (!UUID_RE.test(userId)) {
    return fail("invalid_user_id", "userId must be a UUID.");
  }
  const phone = asTrimmed(row.phone);
  if (!phone) {
    return fail("missing_phone", "phone is required.");
  }
  if (!E164_RE.test(phone)) {
    return fail("invalid_phone", "phone must be E.164 (e.g. +15125551234).");
  }
  const carrierRaw = row.carrierDomain;
  if (carrierRaw === undefined || carrierRaw === null || carrierRaw === "") {
    return { ok: true, value: { userId, phone } };
  }
  if (typeof carrierRaw !== "string" || !CARRIER_DOMAIN_RE.test(carrierRaw.trim())) {
    return fail(
      "invalid_carrier_domain",
      "carrierDomain must be a hostname such as txt.att.net.",
    );
  }
  return {
    ok: true,
    value: { userId, phone, carrierDomain: carrierRaw.trim().toLowerCase() },
  };
}

export function parseVerifyOtpInput(
  body: unknown,
): { ok: true; value: VerifyOtpInput } | PhoneOtpFailure {
  const row = asRecord(body);
  if (!row) {
    return fail("malformed_body", "Request body must be a JSON object.");
  }
  const userId = asTrimmed(row.userId);
  if (!userId) {
    return fail("missing_user_id", "userId is required.");
  }
  if (!UUID_RE.test(userId)) {
    return fail("invalid_user_id", "userId must be a UUID.");
  }
  const phone = asTrimmed(row.phone);
  if (!phone) {
    return fail("missing_phone", "phone is required.");
  }
  if (!E164_RE.test(phone)) {
    return fail("invalid_phone", "phone must be E.164 (e.g. +15125551234).");
  }
  const code = asTrimmed(row.code);
  if (!code) {
    return fail("missing_code", "code is required.");
  }
  if (!OTP_RE.test(code)) {
    return fail("invalid_code", "code must be a 6-digit OTP.");
  }
  return { ok: true, value: { userId, phone, code } };
}

/**
 * Process-local stand-in for Supabase otp_challenges / creator_profiles.
 * First-write identity is userId+phone; a newer send supersedes a pending row.
 */
export class CovenantPhoneOtpStore {
  private readonly challenges = new Map<string, PhoneOtpChallenge>();
  private readonly verified = new Map<string, { phone: string; verifiedAt: string }>();

  public key(userId: string, phone: string): string {
    return `${userId}:${phone}`;
  }

  public put(row: PhoneOtpChallenge): void {
    this.challenges.set(this.key(row.userId, row.phone), row);
  }

  public get(userId: string, phone: string): PhoneOtpChallenge | undefined {
    return this.challenges.get(this.key(userId, phone));
  }

  public markVerified(row: PhoneOtpChallenge, verifiedAt: string): PhoneOtpChallenge {
    const next: PhoneOtpChallenge = {
      ...row,
      consumed: true,
      verifiedAt,
    };
    this.put(next);
    this.verified.set(row.userId, { phone: row.phone, verifiedAt });
    return next;
  }

  public incrementAttempts(row: PhoneOtpChallenge): PhoneOtpChallenge {
    const next: PhoneOtpChallenge = { ...row, attempts: row.attempts + 1 };
    this.put(next);
    return next;
  }

  public verificationFor(userId: string): { phone: string; verifiedAt: string } | undefined {
    return this.verified.get(userId);
  }

  public listChallenges(): PhoneOtpChallenge[] {
    return [...this.challenges.values()];
  }
}

function sandboxMessageId(channel: PhoneOtpChannel): string {
  return `${channel}.sandbox.${randomUUID()}`;
}

export function createSandboxChannelAdapter(
  channel: PhoneOtpChannel,
  options: { fail?: boolean; configured?: boolean } = {},
): PhoneChannelAdapter {
  const configured = options.configured ?? true;
  return {
    channel,
    configured: () => configured,
    async send(input) {
      if (!configured) {
        return {
          ok: false,
          channel,
          code: "channel_not_configured",
          message: `${channel} is not configured.`,
        };
      }
      if (options.fail) {
        return {
          ok: false,
          channel,
          code: "channel_rejected",
          message: `${channel} sandbox dispatch failed.`,
        };
      }
      if (channel === "email_to_sms" && input.carrierDomain === undefined) {
        return {
          ok: false,
          channel,
          code: "missing_carrier_domain",
          message: "carrierDomain is required for email-to-SMS.",
        };
      }
      return {
        ok: true,
        channel,
        providerMessageId: sandboxMessageId(channel),
      };
    },
  };
}

export type CovenantAuthSdkOptions = CovenantAuthSdkConfig & {
  store?: CovenantPhoneOtpStore;
  clock?: () => Date;
  codeFactory?: () => string;
  adapters?: Partial<Record<PhoneOtpChannel, PhoneChannelAdapter>>;
  ttlMs?: number;
  maxAttempts?: number;
};

function defaultCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(PHONE_OTP_LENGTH, "0");
}

/**
 * Sandbox phone verification. Accepts the live-paste env shape
 * (WhatsApp / TextBee / Supabase) but does not call those APIs.
 */
export class CovenantAuthSDK {
  private readonly store: CovenantPhoneOtpStore;
  private readonly clock: () => Date;
  private readonly codeFactory: () => string;
  private readonly adapters: Record<PhoneOtpChannel, PhoneChannelAdapter>;
  private readonly ttlMs: number;
  private readonly maxAttempts: number;
  public readonly config: CovenantAuthSdkConfig;

  constructor(options: CovenantAuthSdkOptions = {}) {
    this.config = {
      supabaseUrl: options.supabaseUrl ?? "",
      supabaseServiceKey: options.supabaseServiceKey ?? "",
      whatsappApiToken: options.whatsappApiToken,
      whatsappPhoneId: options.whatsappPhoneId,
      textbeeApiKey: options.textbeeApiKey,
      textbeeDeviceId: options.textbeeDeviceId,
    };
    this.store = options.store ?? new CovenantPhoneOtpStore();
    this.clock = options.clock ?? (() => new Date());
    this.codeFactory = options.codeFactory ?? defaultCode;
    this.ttlMs = options.ttlMs ?? PHONE_OTP_TTL_MS;
    this.maxAttempts = options.maxAttempts ?? PHONE_OTP_MAX_ATTEMPTS;
    this.adapters = {
      whatsapp:
        options.adapters?.whatsapp ?? createSandboxChannelAdapter("whatsapp"),
      textbee:
        options.adapters?.textbee ?? createSandboxChannelAdapter("textbee"),
      email_to_sms:
        options.adapters?.email_to_sms ??
        createSandboxChannelAdapter("email_to_sms"),
    };
  }

  public getStore(): CovenantPhoneOtpStore {
    return this.store;
  }

  public async sendOtp(input: unknown): Promise<SendOtpResult> {
    const parsed = parseSendOtpInput(input);
    if (!parsed.ok) {
      return parsed;
    }
    const { userId, phone, carrierDomain } = parsed.value;
    const code = this.codeFactory();
    if (!OTP_RE.test(code)) {
      return fail("invalid_code_factory", "Sandbox code factory must return 6 digits.");
    }

    const dispatched = await this.dispatch(phone, code, carrierDomain);
    if (!dispatched.ok) {
      return dispatched;
    }

    const now = this.clock();
    const row: PhoneOtpChallenge = {
      id: `otp_${randomUUID()}`,
      userId,
      phone,
      codeHash: hashPhoneOtp(userId, phone, code),
      channel: dispatched.channel,
      fallbacksAttempted: dispatched.fallbacksAttempted,
      providerMessageId: dispatched.providerMessageId,
      carrierDomain,
      attempts: 0,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      consumed: false,
    };
    this.store.put(row);
    return {
      ok: true,
      mode: "sandbox",
      challengeId: row.id,
      userId,
      phone,
      channel: row.channel,
      fallbacksAttempted: row.fallbacksAttempted,
      providerMessageId: row.providerMessageId,
      expiresAt: row.expiresAt,
      sandboxCode: code,
    };
  }

  public async verifyOtp(input: unknown): Promise<VerifyOtpResult> {
    const parsed = parseVerifyOtpInput(input);
    if (!parsed.ok) {
      return parsed;
    }
    const { userId, phone, code } = parsed.value;
    const row = this.store.get(userId, phone);
    if (row === undefined) {
      return fail(
        "challenge_not_found",
        "No OTP challenge exists for that user and phone.",
      );
    }
    if (row.consumed) {
      return fail("otp_consumed", "That OTP challenge was already used.");
    }
    const now = this.clock();
    if (now.getTime() >= Date.parse(row.expiresAt)) {
      return fail("otp_expired", "That OTP challenge has expired.");
    }
    if (row.attempts >= this.maxAttempts) {
      return fail("otp_locked", "Too many invalid OTP attempts.");
    }
    const expected = hashPhoneOtp(userId, phone, code);
    if (expected !== row.codeHash) {
      const next = this.store.incrementAttempts(row);
      if (next.attempts >= this.maxAttempts) {
        return fail("otp_locked", "Too many invalid OTP attempts.");
      }
      return fail("otp_invalid", "The submitted OTP code does not match.");
    }
    const verifiedAt = now.toISOString();
    const verified = this.store.markVerified(row, verifiedAt);
    return {
      ok: true,
      mode: "sandbox",
      challengeId: verified.id,
      userId,
      phone,
      verifiedAt,
      channel: verified.channel,
    };
  }

  private async dispatch(
    phone: string,
    code: string,
    carrierDomain: string | undefined,
  ): Promise<
    | {
        ok: true;
        channel: PhoneOtpChannel;
        fallbacksAttempted: PhoneOtpChannel[];
        providerMessageId: string;
      }
    | PhoneOtpFailure
  > {
    const order: PhoneOtpChannel[] = ["whatsapp", "textbee"];
    if (carrierDomain !== undefined) {
      order.push("email_to_sms");
    }
    const fallbacksAttempted: PhoneOtpChannel[] = [];
    for (const channel of order) {
      const adapter = this.adapters[channel];
      if (!adapter.configured()) {
        continue;
      }
      fallbacksAttempted.push(channel);
      const sent = await adapter.send({ phone, code, carrierDomain });
      if (sent.ok) {
        return {
          ok: true,
          channel: sent.channel,
          fallbacksAttempted,
          providerMessageId: sent.providerMessageId,
        };
      }
    }
    return fail(
      "delivery_failed",
      "WhatsApp, TextBee, and email-to-SMS sandbox channels all failed.",
    );
  }
}
