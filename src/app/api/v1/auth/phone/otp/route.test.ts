import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/server/rateLimit";
import {
  resetCovenantAuthSdk,
  setCovenantAuthSdk,
} from "@/lib/server/covenantPhone";
import { CovenantAuthSDK } from "@/covenant-sdk/phone/verification-sdk";
import { POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/v1/auth/phone/otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  resetRateLimits();
  resetCovenantAuthSdk();
  setCovenantAuthSdk(
    new CovenantAuthSDK({
      clock: () => new Date("2026-09-29T00:00:00.000Z"),
      codeFactory: () => "123456",
    }),
  );
});

describe("POST /api/v1/auth/phone/otp", () => {
  it("dispatches a sandbox WhatsApp OTP", async () => {
    const response = await POST(
      postRequest(
        JSON.stringify({ userId: USER_ID, phone: "+15125550123" }),
      ) as never,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("sandbox");
    expect(body.channel).toBe("whatsapp");
    expect(body.sandboxCode).toBe("123456");
    expect(body.expiresAt).toBe("2026-09-29T00:10:00.000Z");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("{not json") as never);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be valid JSON.",
      code: "malformed_body",
    });
  });

  it("returns 422 for a non-E.164 phone", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ userId: USER_ID, phone: "5125550123" })) as never,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: "invalid_phone",
      error: "phone must be E.164 (e.g. +15125551234).",
    });
  });
});
