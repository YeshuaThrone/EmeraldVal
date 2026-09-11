import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import type { CovnantSignupInput, CovnantSignupSuccess, CreatorProfile } from "@/lib/covnant/types";

/**
 * Orchestrates Covnant signup: Supabase Auth signUp (password hashing +
 * confirmation email) then a creator_profiles insert. If the profile
 * write fails, the Auth user is deleted so we don't leave an orphan
 * credential. Auth + PostgREST are not one SQL transaction; this is the
 * compensating action.
 */

export type CovnantSignupFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type CovnantSignupResult =
  | { ok: true; value: CovnantSignupSuccess }
  | CovnantSignupFailure;

export type CovnantAuthClients = {
  auth: SupabaseClient;
  admin: SupabaseClient;
};

function isDuplicateSignup(user: User | null, errorMessage: string | undefined): boolean {
  const message = (errorMessage ?? "").toLowerCase();
  if (message.includes("already registered") || message.includes("already exists")) {
    return true;
  }
  if (user === null) {
    return false;
  }
  // Confirm-email projects return an obfuscated user with no identities.
  return Array.isArray(user.identities) && user.identities.length === 0;
}

function toAuthUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}

function toSessionState(session: Session | null) {
  if (session === null) {
    return null;
  }
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at ?? null,
    token_type: session.token_type,
    user: toAuthUser(session.user),
  };
}

function profileRow(userId: string, payload: CovnantSignupInput, acceptedAt: string) {
  return {
    id: userId,
    stage_name: payload.stage_name,
    legal_name: payload.legal_name,
    email: payload.email,
    phone: payload.phone,
    phone_verified_at: null,
    core_industry: payload.core_industry,
    title: payload.title,
    udr_terms_accepted_at: acceptedAt,
  };
}

export async function registerCovnantCreator(
  payload: CovnantSignupInput,
  clients: CovnantAuthClients,
  now: () => Date = () => new Date(),
): Promise<CovnantSignupResult> {
  const { data, error } = await clients.auth.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        stage_name: payload.stage_name,
        legal_name: payload.legal_name,
        core_industry: payload.core_industry,
        title: payload.title,
        phone: payload.phone,
      },
    },
  });

  const user = data?.user ?? null;

  if (isDuplicateSignup(user, error?.message)) {
    return {
      ok: false,
      status: 409,
      code: "duplicate_email",
      message: "An account with this email already exists.",
    };
  }

  if (error) {
    return {
      ok: false,
      status: 400,
      code: "auth_signup_failed",
      message: error.message || "Unable to create credentials.",
    };
  }

  if (user === null) {
    return {
      ok: false,
      status: 502,
      code: "auth_signup_failed",
      message: "Supabase Auth did not return a user.",
    };
  }

  const acceptedAt = now().toISOString();
  const row = profileRow(user.id, payload, acceptedAt);

  const inserted = await clients.admin
    .from("creator_profiles")
    .insert(row)
    .select(
      "id, stage_name, legal_name, email, phone, phone_verified_at, core_industry, title, udr_terms_accepted_at",
    )
    .single();

  if (inserted.error || inserted.data === null) {
    const { error: deleteError } = await clients.admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Failed to roll back Auth user after profile insert:", deleteError);
    }
    console.error("Failed to insert creator_profiles:", inserted.error);
    return {
      ok: false,
      status: 500,
      code: "profile_insert_failed",
      message: "Failed to persist the creator profile.",
    };
  }

  const profile = inserted.data as CreatorProfile;
  return {
    ok: true,
    value: {
      success: true,
      session: toSessionState(data?.session ?? null),
      user: toAuthUser(user),
      profile: {
        ...profile,
        phone_verified_at: null,
      },
    },
  };
}
