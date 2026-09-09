-- Covnant creator identity.
-- auth.users (id, email, encrypted_password, email_confirmed_at) is owned by
-- Supabase Auth — this API never writes those columns directly. signUp()
-- hashes the password and sends the native confirmation email.
-- Apply with `supabase db push` or in the Supabase SQL editor.

create table if not exists public.creator_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  stage_name text not null,
  legal_name text not null,
  email text not null,
  phone text,
  phone_verified_at timestamptz,
  core_industry text not null,
  title text not null,
  udr_terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists creator_profiles_email_key
  on public.creator_profiles (email);

alter table public.creator_profiles enable row level security;

-- Signup inserts with the service role (session is often null until email
-- confirmation). Authenticated creators may read/update only their row.
drop policy if exists "creators can read own profile" on public.creator_profiles;
create policy "creators can read own profile"
  on public.creator_profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "creators can update own profile" on public.creator_profiles;
create policy "creators can update own profile"
  on public.creator_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, update on public.creator_profiles to authenticated;
grant all on public.creator_profiles to service_role;
