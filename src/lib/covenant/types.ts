/**
 * Covnant creator identity — the signup wire contract and the
 * `creator_profiles` row persisted after Supabase Auth signUp.
 */

export type CovenantSignupInput = {
  stage_name: string;
  legal_name: string;
  email: string;
  phone: string | null;
  core_industry: string;
  title: string;
  password: string;
  udr_terms_accepted: boolean;
};

export type CreatorProfile = {
  id: string;
  stage_name: string;
  legal_name: string;
  email: string;
  phone: string | null;
  phone_verified_at: string | null;
  core_industry: string;
  title: string;
  udr_terms_accepted_at: string;
};

export type CovenantAuthUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
};

export type CovenantSessionState = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number | null;
  token_type: string;
  user: CovenantAuthUser;
};

export type CovenantSignupSuccess = {
  success: true;
  session: CovenantSessionState | null;
  user: CovenantAuthUser;
  profile: CreatorProfile;
};
