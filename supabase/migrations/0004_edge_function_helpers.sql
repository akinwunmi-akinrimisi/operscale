-- 0004_edge_function_helpers.sql
--
-- Database-level helpers used by Supabase Auth Hooks and Edge Functions.
--
-- Includes:
--   1. auth.custom_access_token_hook — stamps the `founder` role JWT claim
--      for allowlisted emails (so RLS policies that test `auth.jwt() ->> 'role' = 'founder'` work).
--   2. auth.send_email_hook — blocks magic-link emails for non-allowlisted addresses.
--
-- Shared-Supabase note: this Postgres instance hosts multiple internal admin
-- products (Vision GridAI, Cloudboosta Academy, fitness tracker, sales coach).
-- NONE of them are customer-facing — every product on this DB is operated by
-- the same three admin emails listed below. So send_email_hook installed at
-- the project level is safe: it allows magic links for these emails and blocks
-- all others. There is no public sign-up to break.
--
-- Founder allowlist is held in a Postgres database parameter, NOT a table
-- (per data-model.md §12 "no users/roles tables" + session decision).
--
-- One-time setup (run via Supabase Studio → SQL editor, OR via psql against the
-- live Postgres on the VPS, NOT inside this migration file). The exact value:
--
--   ALTER DATABASE postgres SET app.admin_emails =
--     'akinolaakinrimisi@gmail.com,akinwunmi.akinrimisi@operscale.cloud,akinwunmi.akinrimisi@cloudboosta.co.uk';
--
-- The function lower-cases the parameter at read time, so casing here doesn't
-- matter. Whitespace inside the value is stripped by operscale_admin_emails().
--
-- Hook configuration (Supabase dashboard → Auth → Hooks, OR the equivalent
-- GoTrue env vars on the self-hosted Supabase docker-compose):
--   * Custom Access Token: select function `auth.custom_access_token_hook`
--   * Send Email:          select function `auth.send_email_hook`
-- The supabase/config.toml file mirrors this for local dev parity.
--
-- Defense in depth: even with both hooks installed, the apps/web middleware
-- (apps/web/src/middleware.ts) re-checks role=founder on every /admin/* request.
-- This way a regression in the auth hook doesn't expose the CRM.

begin;

-- ---------------------------------------------------------------------------
-- Helper: read the comma-separated allowlist as a text[].
-- Returns empty array if the parameter is unset (which means: nobody is admin,
-- which is the safe default for a fresh database).
-- ---------------------------------------------------------------------------

create or replace function auth.operscale_admin_emails()
  returns text[]
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select coalesce(
    string_to_array(
      lower(regexp_replace(current_setting('app.admin_emails', true), '\s+', '', 'g')),
      ','
    ),
    array[]::text[]
  );
$$;

revoke all on function auth.operscale_admin_emails() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auth hook: custom_access_token_hook
--
-- Called by Supabase Auth on every JWT issuance. We add a `role: 'founder'`
-- claim into the access token if the user's email is on the allowlist.
-- RLS policies in 0001 read this claim via `auth.jwt() ->> 'role' = 'founder'`.
--
-- Hook contract: input event = { user_id, claims, ... }; return { claims }.
-- See https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook.
-- ---------------------------------------------------------------------------

create or replace function auth.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  user_email   text;
  claims       jsonb;
  allowed      text[];
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- Look up the user's email from auth.users by user_id from the event.
  select lower(u.email)
    into user_email
    from auth.users u
   where u.id = (event ->> 'user_id')::uuid;

  if user_email is null then
    return jsonb_build_object('claims', claims);
  end if;

  allowed := auth.operscale_admin_emails();

  if user_email = any(allowed) then
    claims := jsonb_set(claims, '{role}', to_jsonb('founder'::text), true);
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

revoke all on function auth.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function auth.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Auth hook: send_email_hook
--
-- Called by Supabase Auth before a transactional email is sent. We use it to
-- block magic-link emails to non-allowlisted addresses, so the CRM cannot be
-- accessed by anyone outside the allowlist even if they trigger the form.
--
-- Hook contract: input event = { user, email_data, ... }; return { ... } or
-- raise an exception to abort the send. See:
-- https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
-- ---------------------------------------------------------------------------

create or replace function auth.send_email_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  user_email      text;
  email_action    text;
  allowed         text[];
begin
  user_email   := lower(coalesce(event -> 'user' ->> 'email', ''));
  email_action := coalesce(event -> 'email_data' ->> 'email_action_type', '');

  -- Magic-link is the only auth flow Phase 1 uses (passwords disabled).
  -- Recovery + invite flows are also gated; signup is disabled at the project level.
  if email_action in ('magiclink','recovery','invite','email') then
    allowed := auth.operscale_admin_emails();
    if not (user_email = any(allowed)) then
      raise exception
        'auth: email % is not on the operscale founder allowlist; magic link suppressed', user_email
        using errcode = 'P0001';
    end if;
  end if;

  -- Default: pass through. We intentionally do NOT mutate email_data; Supabase
  -- renders the template itself.
  return event;
end;
$$;

revoke all on function auth.send_email_hook(jsonb) from public, anon, authenticated;
grant execute on function auth.send_email_hook(jsonb) to supabase_auth_admin;

commit;
