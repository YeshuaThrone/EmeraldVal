import { describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { registerCovnantCreator } from "@/lib/server/covnantSignup";
import type { CovnantAuthClients } from "@/lib/server/covnantSignup";
import type { CovnantSignupInput } from "@/lib/covnant/types";

const PAYLOAD: CovnantSignupInput = {
  stage_name: "Night Owl",
  legal_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+15125550123",
  core_industry: "music",
  title: "Performer",
  password: "correct-horse",
  udr_terms_accepted: true,
};

const USER_ID = "11111111-1111-4111-8111-111111111111";

function authUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: PAYLOAD.email,
    identities: [{ id: "id-1", user_id: USER_ID }],
    ...overrides,
  } as User;
}

function makeClients(options: {
  signUp: unknown;
  insert?: { data: unknown; error: { message: string } | null };
  deleteError?: { message: string } | null;
}) {
  const signUp = vi.fn().mockResolvedValue(options.signUp);
  const deleteUser = vi
    .fn()
    .mockResolvedValue({ data: { user: null }, error: options.deleteError ?? null });
  const single = vi.fn().mockResolvedValue(
    options.insert ?? {
      data: {
        id: USER_ID,
        stage_name: PAYLOAD.stage_name,
        legal_name: PAYLOAD.legal_name,
        email: PAYLOAD.email,
        phone: PAYLOAD.phone,
        phone_verified_at: null,
        core_industry: PAYLOAD.core_industry,
        title: PAYLOAD.title,
        udr_terms_accepted_at: "2026-09-09T16:00:00.000Z",
      },
      error: null,
    },
  );
  const insert = vi.fn(() => ({
    select: () => ({ single }),
  }));
  const from = vi.fn(() => ({ insert }));

  const clients = {
    auth: { auth: { signUp } },
    admin: { auth: { admin: { deleteUser } }, from },
  } as unknown as CovnantAuthClients;

  return { clients, signUp, deleteUser, insert, from };
}

describe("registerCovnantCreator", () => {
  const frozenNow = () => new Date("2026-09-09T16:00:00.000Z");

  it("signs up, inserts creator_profiles with phone_verified_at null, and returns session state", async () => {
    const { clients, signUp, insert, deleteUser } = makeClients({
      signUp: {
        data: {
          user: authUser(),
          session: {
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
            expires_at: 1_800_000_000,
            token_type: "bearer",
            user: authUser(),
          },
        },
        error: null,
      },
    });

    const result = await registerCovnantCreator(PAYLOAD, clients, frozenNow);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(signUp).toHaveBeenCalledWith({
      email: PAYLOAD.email,
      password: PAYLOAD.password,
      options: {
        data: {
          stage_name: PAYLOAD.stage_name,
          legal_name: PAYLOAD.legal_name,
          core_industry: PAYLOAD.core_industry,
          title: PAYLOAD.title,
          phone: PAYLOAD.phone,
        },
      },
    });

    expect(insert).toHaveBeenCalledWith({
      id: USER_ID,
      stage_name: PAYLOAD.stage_name,
      legal_name: PAYLOAD.legal_name,
      email: PAYLOAD.email,
      phone: PAYLOAD.phone,
      phone_verified_at: null,
      core_industry: PAYLOAD.core_industry,
      title: PAYLOAD.title,
      udr_terms_accepted_at: "2026-09-09T16:00:00.000Z",
    });
    expect(deleteUser).not.toHaveBeenCalled();

    expect(result.value).toEqual({
      success: true,
      session: {
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        expires_at: 1_800_000_000,
        token_type: "bearer",
        user: {
          id: USER_ID,
          email: PAYLOAD.email,
          email_confirmed_at: null,
        },
      },
      user: {
        id: USER_ID,
        email: PAYLOAD.email,
        email_confirmed_at: null,
      },
      profile: {
        id: USER_ID,
        stage_name: PAYLOAD.stage_name,
        legal_name: PAYLOAD.legal_name,
        email: PAYLOAD.email,
        phone: PAYLOAD.phone,
        phone_verified_at: null,
        core_industry: PAYLOAD.core_industry,
        title: PAYLOAD.title,
        udr_terms_accepted_at: "2026-09-09T16:00:00.000Z",
      },
    });
  });

  it("returns session null when Confirm email leaves the user unverified", async () => {
    const { clients } = makeClients({
      signUp: {
        data: { user: authUser(), session: null },
        error: null,
      },
    });

    const result = await registerCovnantCreator(PAYLOAD, clients, frozenNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session).toBeNull();
      expect(result.value.profile.phone_verified_at).toBeNull();
    }
  });

  it("maps an already-registered Auth error to 409", async () => {
    const { clients, from } = makeClients({
      signUp: {
        data: { user: null, session: null },
        error: { message: "User already registered" },
      },
    });

    const result = await registerCovnantCreator(PAYLOAD, clients, frozenNow);
    expect(result).toEqual({
      ok: false,
      status: 409,
      code: "duplicate_email",
      message: "An account with this email already exists.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("treats an obfuscated user with no identities as a duplicate", async () => {
    const { clients } = makeClients({
      signUp: {
        data: { user: authUser({ identities: [] }), session: null },
        error: null,
      },
    });

    const result = await registerCovnantCreator(PAYLOAD, clients, frozenNow);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("duplicate_email");
    }
  });

  it("maps a generic Auth error to 400", async () => {
    const { clients } = makeClients({
      signUp: {
        data: { user: null, session: null },
        error: { message: "Password is too weak" },
      },
    });

    const result = await registerCovnantCreator(PAYLOAD, clients, frozenNow);
    expect(result).toEqual({
      ok: false,
      status: 400,
      code: "auth_signup_failed",
      message: "Password is too weak",
    });
  });

  it("deletes the Auth user when the profile insert fails", async () => {
    const { clients, deleteUser } = makeClients({
      signUp: {
        data: { user: authUser(), session: null },
        error: null,
      },
      insert: { data: null, error: { message: "insert failed" } },
    });

    const result = await registerCovnantCreator(PAYLOAD, clients, frozenNow);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({
      ok: false,
      status: 500,
      code: "profile_insert_failed",
      message: "Failed to persist the creator profile.",
    });
  });
});
