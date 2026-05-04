-- 0005_framework_seed_and_history.sql
--
-- V2 content migration: add framework_seed column to analysis_runs
-- and create customer_framework_history table for the non-duplication system.
--
-- See docs/specs/non-duplication-system.md for the full spec.
-- See docs/MIGRATION-CONTENT-V2.md section 5 for the rollback statement.
--
-- This migration is NOT auto-applied. Apply manually via `supabase db push`
-- after human review against staging. Do not auto-apply against production.
--
-- RLS policy convention follows 0001_initial_schema.sql:
--   - Restrictive deny-all for the `anon` role.
--   - Permissive policies for the `authenticated` role gated on
--     `auth.jwt() ->> 'role' = 'founder'`.
--   - Read and write paths split so the founder-approval handler has explicit
--     insert permission and the CRM has explicit select permission.

begin;

-- Add the framework_seed column to analysis_runs.
alter table analysis_runs
  add column if not exists framework_seed jsonb;

comment on column analysis_runs.framework_seed is
  'JSONB containing seed_hash, seed_inputs, selected_frameworks, selected_archetypes, selected_pairs, exhaustion_warning, lru_fallback_used. See docs/specs/non-duplication-system.md.';

-- Create the customer_framework_history table.
create table if not exists customer_framework_history (
  customer_id     uuid not null references customers(id) on delete restrict,
  order_id        uuid not null references orders(id) on delete restrict,
  framework_slot  text not null,
  archetype_slot  text not null,
  used_at         timestamptz default now(),
  primary key (customer_id, framework_slot, archetype_slot)
);

create index if not exists customer_framework_history_customer_idx
  on customer_framework_history (customer_id);

create index if not exists customer_framework_history_order_idx
  on customer_framework_history (order_id);

comment on table customer_framework_history is
  'Tracks every (framework, archetype) pair delivered to a customer via founder-approved analysis runs. Used to ensure no pair repeats for a returning customer until the bank exhausts. See docs/specs/non-duplication-system.md.';

-- Row-level security: keep default-deny posture from the rest of the schema.
alter table customer_framework_history enable row level security;

-- Restrictive deny-all for anon role (matches 0001 baseline + data-model.md section 7).
create policy customer_framework_history_anon_deny
  on customer_framework_history
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

-- Founder read access: the CRM lists the table to compute exclusions and
-- display per-customer history in the review screen.
create policy customer_framework_history_founder_read
  on customer_framework_history
  for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

-- Founder write access: the founder-approval handler inserts one row per
-- (framework_slot, archetype_slot) pair on `founder_approved` events.
create policy customer_framework_history_founder_insert
  on customer_framework_history
  for insert
  to authenticated
  with check (auth.jwt() ->> 'role' = 'founder');

-- No update or delete policies: the table is append-only by design.
-- NDPC anonymisation re-points customer_id to a sentinel UUID rather than
-- deleting rows; that procedure runs as a privileged migration, not via RLS.

commit;
