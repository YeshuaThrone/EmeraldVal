import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/server/rateLimit";
import { POST } from "./route";

vi.mock("@/lib/server/covenantSignup", () => ({
  registerCovenantCreator: vi.fn(),
}));

vi.mock("@/lib/server/supabase", () => ({
  readSupabaseEnv: vi.fn(),
  createAuthClient: vi.fn(() => ({ name: "auth" })),
  createAdminClient: vi.fn(() => ({ name: "admin" })),
}));

import { registerCovenantCreator } from "@/lib/server/covenantSignup";
import { readSupabaseEnv } from "@/lib/server/supabase";

const mockedRegister = vi.mocked(registerCovenantCreator);
const mockedEnv = vi.mocked(readSupabaseEnv);

const VALID_BODY = {
  stage_name: "Night Owl",
  legal_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+15125550123",
  core_industry: "music",
  title: "Performer",
  password: "correct-horse",
  udr_terms_accepted: true,
};

function postRequest(body: string): Request {
  return new Request("http://localhost:3000/api/covenant/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  mockedRegister.mockReset();
  mockedEnv.mockReset();
  mockedEnv.mockReturnValue({
    url: "https://example.supabase.co",
    anonKey: "anon",
    serviceRoleKey: "service",
  });
  resetRateLimits();
});

describe("POST /api/covenant/auth/signup", () => {
  it("returns 201 with success, session, and profile on a clean signup", async () => {
    mockedRegister.mockResolvedValue({
      ok: true,
      value: {
        success: true,
        session: {
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          expires_at: 1_800_000_000,
          token_type: "bearer",
          user: {
            id: "user-1",
            email: "ada@example.com",
            email_confirmed_at: null,
          },
        },
        user: {
          id: "user-1",
          email: "ada@example.com",
          email_confirmed_at: null,
        },
        profile: {
          id: "user-1",
          stage_name: "Night Owl",
          legal_name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "+15125550123",
          phone_verified_at: null,
          core_industry: "music",
          title: "Performer",
          udr_terms_accepted_at: "2026-09-09T16:00:00.000Z",
        },
      },
    });

    const response = await POST(
      postRequest(JSON.stringify(VALID_BODY)) as never,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.profile.phone_verified_at).toBeNull();
    expect(body.session.access_token).toBe("access");
    expect(mockedRegister).toHaveBeenCalledTimes(1);
    const [payload] = mockedRegister.mock.calls[0];
    expect(payload.password).toBe("correct-horse");
    expect(payload.email).toBe("ada@example.com");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(postRequest("{not json") as never);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be valid JSON.",
      code: "malformed_body",
    });
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("returns 422 when UDR terms are not accepted", async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...VALID_BODY, udr_terms_accepted: false })) as never,
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("udr_terms_required");
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase env is missing", async () => {
    mockedEnv.mockReturnValue(null);
    const response = await POST(
      postRequest(JSON.stringify(VALID_BODY)) as never,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Supabase credentials are not configured.",
      code: "supabase_not_configured",
    });
  });

  it("rate-limits runaway signup from one address", async () => {
    const { checkRateLimit, REGISTER_RATE_LIMIT } = await import(
      "@/lib/server/rateLimit"
    );
    for (let i = 0; i < REGISTER_RATE_LIMIT.limit; i += 1) {
      checkRateLimit("covenant-signup:unknown", REGISTER_RATE_LIMIT);
    }

    const response = await POST(
      postRequest(JSON.stringify(VALID_BODY)) as never,
    );
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("rate_limited");
  });

  it("forwards orchestrator failures as typed envelopes", async () => {
    mockedRegister.mockResolvedValue({
      ok: false,
      status: 409,
      code: "duplicate_email",
      message: "An account with this email already exists.",
    });

    const response = await POST(
      postRequest(JSON.stringify(VALID_BODY)) as never,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "An account with this email already exists.",
      code: "duplicate_email",
    });
  });
});
