import { describe, expect, it } from "vitest";
import {
  CovenantAuthSDK,
  CovenantPhoneOtpStore,
  createSandboxChannelAdapter,
  hashPhoneOtp,
  parseSendOtpInput,
} from "./verification-sdk";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PHONE = "+15125550123";

describe("parseSendOtpInput", () => {
  it("accepts E.164 + UUID and lowercases carrierDomain", () => {
    const parsed = parseSendOtpInput({
      userId: USER_ID,
      phone: PHONE,
      carrierDomain: "txt.ATT.net",
    });
    expect(parsed).toEqual({
      ok: true,
      value: { userId: USER_ID, phone: PHONE, carrierDomain: "txt.att.net" },
    });
  });

  it("rejects a non-E.164 phone", () => {
    expect(parseSendOtpInput({ userId: USER_ID, phone: "512-555-0123" })).toEqual(
      expect.objectContaining({ ok: false, code: "invalid_phone" }),
    );
  });
});

describe("CovenantAuthSDK", () => {
  it("dispatches WhatsApp first and verifies a hashed 6-digit code", async () => {
    const sdk = new CovenantAuthSDK({
      clock: () => new Date("2026-09-29T00:00:00.000Z"),
      codeFactory: () => "654321",
    });
    const sent = await sdk.sendOtp({ userId: USER_ID, phone: PHONE });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    expect(sent.channel).toBe("whatsapp");
    expect(sent.fallbacksAttempted).toEqual(["whatsapp"]);
    expect(sent.sandboxCode).toBe("654321");
    expect(sent.expiresAt).toBe("2026-09-29T00:10:00.000Z");
    const stored = sdk.getStore().get(USER_ID, PHONE);
    expect(stored?.codeHash).toBe(hashPhoneOtp(USER_ID, PHONE, "654321"));
    expect(stored?.codeHash).not.toContain("654321");

    const verified = await sdk.verifyOtp({
      userId: USER_ID,
      phone: PHONE,
      code: "654321",
    });
    expect(verified).toEqual({
      ok: true,
      mode: "sandbox",
      challengeId: sent.challengeId,
      userId: USER_ID,
      phone: PHONE,
      verifiedAt: "2026-09-29T00:00:00.000Z",
      channel: "whatsapp",
    });
    expect(sdk.getStore().verificationFor(USER_ID)).toEqual({
      phone: PHONE,
      verifiedAt: "2026-09-29T00:00:00.000Z",
    });
  });

  it("falls back WhatsApp → TextBee → email-to-SMS", async () => {
    const sdk = new CovenantAuthSDK({
      codeFactory: () => "111111",
      adapters: {
        whatsapp: createSandboxChannelAdapter("whatsapp", { fail: true }),
        textbee: createSandboxChannelAdapter("textbee", { fail: true }),
        email_to_sms: createSandboxChannelAdapter("email_to_sms"),
      },
    });
    const sent = await sdk.sendOtp({
      userId: USER_ID,
      phone: PHONE,
      carrierDomain: "txt.att.net",
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    expect(sent.channel).toBe("email_to_sms");
    expect(sent.fallbacksAttempted).toEqual([
      "whatsapp",
      "textbee",
      "email_to_sms",
    ]);
  });

  it("returns delivery_failed when every sandbox channel rejects", async () => {
    const sdk = new CovenantAuthSDK({
      adapters: {
        whatsapp: createSandboxChannelAdapter("whatsapp", { fail: true }),
        textbee: createSandboxChannelAdapter("textbee", { fail: true }),
      },
    });
    await expect(sdk.sendOtp({ userId: USER_ID, phone: PHONE })).resolves.toEqual({
      ok: false,
      code: "delivery_failed",
      message: "WhatsApp, TextBee, and email-to-SMS sandbox channels all failed.",
    });
  });

  it("rejects a wrong code, then locks after five attempts", async () => {
    const sdk = new CovenantAuthSDK({ codeFactory: () => "222222" });
    await sdk.sendOtp({ userId: USER_ID, phone: PHONE });
    for (let i = 0; i < 4; i += 1) {
      const miss = await sdk.verifyOtp({
        userId: USER_ID,
        phone: PHONE,
        code: "000000",
      });
      expect(miss).toEqual(
        expect.objectContaining({ ok: false, code: "otp_invalid" }),
      );
    }
    const locked = await sdk.verifyOtp({
      userId: USER_ID,
      phone: PHONE,
      code: "000000",
    });
    expect(locked).toEqual(
      expect.objectContaining({ ok: false, code: "otp_locked" }),
    );
  });

  it("expires a challenge after the TTL", async () => {
    let now = Date.parse("2026-09-29T00:00:00.000Z");
    const sdk = new CovenantAuthSDK({
      codeFactory: () => "333333",
      clock: () => new Date(now),
    });
    await sdk.sendOtp({ userId: USER_ID, phone: PHONE });
    now += 10 * 60_000;
    const expired = await sdk.verifyOtp({
      userId: USER_ID,
      phone: PHONE,
      code: "333333",
    });
    expect(expired).toEqual(
      expect.objectContaining({ ok: false, code: "otp_expired" }),
    );
  });

  it("supersedes a pending challenge on resend", async () => {
    const sdk = new CovenantAuthSDK({
      codeFactory: () => "444444",
      store: new CovenantPhoneOtpStore(),
    });
    const first = await sdk.sendOtp({ userId: USER_ID, phone: PHONE });
    expect(first.ok).toBe(true);
    const secondSdk = new CovenantAuthSDK({
      codeFactory: () => "555555",
      store: sdk.getStore(),
    });
    const second = await secondSdk.sendOtp({ userId: USER_ID, phone: PHONE });
    expect(second.ok).toBe(true);
    const stale = await sdk.verifyOtp({
      userId: USER_ID,
      phone: PHONE,
      code: "444444",
    });
    expect(stale).toEqual(
      expect.objectContaining({ ok: false, code: "otp_invalid" }),
    );
    const fresh = await sdk.verifyOtp({
      userId: USER_ID,
      phone: PHONE,
      code: "555555",
    });
    expect(fresh.ok).toBe(true);
  });

  it("does not call live WhatsApp, TextBee, or Supabase URLs", async () => {
    const sdk = new CovenantAuthSDK({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceKey: "service",
      whatsappApiToken: "wa_live",
      whatsappPhoneId: "123",
      textbeeApiKey: "tb_live",
      textbeeDeviceId: "dev_1",
      codeFactory: () => "777777",
    });
    const sent = await sdk.sendOtp({ userId: USER_ID, phone: PHONE });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    expect(sent.mode).toBe("sandbox");
    expect(sent.providerMessageId.startsWith("whatsapp.sandbox.")).toBe(true);
  });
});
