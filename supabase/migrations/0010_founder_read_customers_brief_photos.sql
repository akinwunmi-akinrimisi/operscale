-- 0010_founder_read_customers_brief_photos.sql
--
-- Phase 5 (Founder CRM) needs the pending-review queue page to read
-- joined rows from `customers` and `brief_photos`. Migration 0001 set
-- both tables to RLS-on but only added the `*_anon_deny` restrictive
-- policy — no founder permissive SELECT, so authenticated founder JWTs
-- see zero rows, and the page's `customers!inner` inner-join drops
-- every order from the queue.
--
-- This migration adds founder permissive SELECT policies, mirroring
-- the `briefs_founder_read` and `orders_founder_read` patterns from
-- 0001 lines 366-373.
--
-- The same policies are required for the Realtime channel
-- `pending-review` to hydrate joined rows under the anon + founder JWT
-- session (RealtimeQueue.fetchJoinedRow re-runs the same join).
--
-- Service-role reads are unaffected — service_role bypasses RLS.

begin;

create policy customers_founder_read on customers
  for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

create policy brief_photos_founder_read on brief_photos
  for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

commit;
