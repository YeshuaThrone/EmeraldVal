import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/server/rateLimit";
import {
  resetCovenantAuthSdk,
  setCovenantAuthSdk,
} from "@/lib/server/covenantPhone";
import { CovenantAuthSDK } from "@/covenant-sdk/phone/verification-sdk";
import { POST as sendOtp } from "../otp/route";
import { POST as verifyOtp } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PHONE = "+15125550123";

function postRequest(path: string, body: string): Request {
  return new Request(`http://localhost:3000${path}`, {
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

describe("POST /api/v1/auth/phone/verify", () => {
  it("verifies a dispatched sandbox OTP", async () => {
    const sent = await sendOtp(
      postRequest(
        "/api/v1/auth/phone/otp",
        JSON.stringify({ userId: USER_ID, phone: PHONE }),
      ) as never,
    );
    expect(sent.status).toBe(201);

    const response = await verifyOtp(
      postRequest(
        "/api/v1/auth/phone/verify",
        JSON.stringify({ userId: USER_ID, phone: PHONE, code: "123456" }),
      ) as never,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.verifiedAt).toBe("2026-09-29T00:00:00.000Z");
    expect(body.phone).toBe(PHONE);
  });

  it("returns 422 for a wrong code", async () => {
    await sendOtp(
      postRequest(
        "/api/v1/auth/phone/otp",
        JSON.stringify({ userId: USER_ID, phone: PHONE }),
      ) as never,
    );
    const response = await verifyOtp(
      postRequest(
        "/api/v1/auth/phone/verify",
        JSON.stringify({ userId: USER_ID, phone: PHONE, code: "000000" }),
      ) as never,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: "otp_invalid",
      error: "The submitted OTP code does not match.",
    });
  });

  it("returns 404 when no challenge exists", async () => {
    const response = await verifyOtp(
      postRequest(
        "/api/v1/auth/phone/verify",
        JSON.stringify({ userId: USER_ID, phone: PHONE, code: "123456" }),
      ) as never,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "challenge_not_found",
      error: "No OTP challenge exists for that user and phone.",
    });
  });
});
