-- 0009_activity_log_founder_insert.sql
--
-- Phase 5 (Founder CRM) needs the auth-callback route to insert a
-- `founder_signed_in` activity_log row using the founder's authenticated
-- session (anon key + role=founder JWT). Migration 0001 only had the
-- `activity_log_anon_deny` restrictive policy; without a permissive
-- policy for authenticated founder-role users, RLS denies the INSERT.
--
-- This migration adds the symmetric permissive policy, mirroring the
-- existing `analysis_edits_founder_all` pattern from 0001.
--
-- Service-role writes (the existing apps/agent writeActivityLog helper)
-- are unaffected — service_role bypasses RLS by default in Supabase.

begin;

create policy activity_log_founder_insert on activity_log
  for insert
  to authenticated
  with check (auth.jwt() ->> 'role' = 'founder');

create policy activity_log_founder_read on activity_log
  for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

commit;
