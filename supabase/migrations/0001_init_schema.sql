-- 0001_init_schema.sql
--
-- Phase 1 schema for operscale-calendar-platform.
-- Source of truth: docs/data-model.md (sections 3, 4, 7, 8).
-- This migration is immutable once applied. To change schema, write 0005_*.sql.
--
-- Scope (per docs/data-model.md §10):
--   * All 12 tables in their authoritative DDL form
--   * Indexes per §3 + §8
--   * Foreign-key topology per §4 (encoded inline)
--   * Row-level security per §7 (default-deny + founder-role permissive policies)
--
-- Migration sibling files:
--   0002_storage_buckets.sql        — customer-photos, customer-logos
--   0003_realtime_publication.sql   — orders, analysis_runs, activity_log
--   0004_edge_function_helpers.sql  — auth hooks (founder claim + magic-link gate)

begin;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";        -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 3.1 customers
-- ---------------------------------------------------------------------------

create table customers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  email_lower     text generated always as (lower(email)) stored,
  full_name       text,
  whatsapp_number text,
  business_name   text,
  niche           text,
  source          text,
  first_seen_at   timestamptz default now(),
  last_seen_at    timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create unique index customers_email_lower_uniq on customers (email_lower);
create index customers_whatsapp_idx on customers (whatsapp_number) where whatsapp_number is not null;
create index customers_last_seen_idx on customers (last_seen_at desc);

-- ---------------------------------------------------------------------------
-- 3.2 briefs
-- ---------------------------------------------------------------------------

create table briefs (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id) on delete restrict,
  tier_intent       text check (tier_intent in ('starter','standard','calendar')),
  form_payload      jsonb not null default '{}'::jsonb,
  save_token        text unique,
  current_step      int not null default 1 check (current_step between 1 and 7),
  submitted_at      timestamptz,
  auto_ack_sent_at  timestamptz,
  created_at        timestamptz default now(),
  last_updated_at   timestamptz default now()
);

create index briefs_customer_idx on briefs (customer_id);
create index briefs_save_token_idx on briefs (save_token) where save_token is not null;
create index briefs_unsubmitted_step3_idx on briefs (created_at)
  where submitted_at is null and current_step >= 3;
create index briefs_submitted_idx on briefs (submitted_at desc) where submitted_at is not null;

-- ---------------------------------------------------------------------------
-- 3.3 brief_photos
-- ---------------------------------------------------------------------------

create table brief_photos (
  id                   uuid primary key default gen_random_uuid(),
  brief_id             uuid not null references briefs(id) on delete cascade,
  customer_id          uuid not null references customers(id) on delete restrict,
  photo_index          int not null check (photo_index between 1 and 3),
  storage_path         text not null,
  mime_type            text not null check (mime_type in ('image/jpeg','image/png')),
  size_bytes           integer not null check (size_bytes between 1 and 10485760),
  width_px             integer,
  height_px            integer,
  face_detected        boolean,
  sharpness_score      numeric(6,3),
  brightness_score     numeric(6,3),
  quality_check_passed boolean,
  uploaded_at          timestamptz default now(),
  scheduled_delete_at  timestamptz not null,
  deleted_at           timestamptz,
  unique (brief_id, photo_index)
);

create index brief_photos_sweep_idx on brief_photos (scheduled_delete_at)
  where deleted_at is null;
create index brief_photos_brief_idx on brief_photos (brief_id);

-- ---------------------------------------------------------------------------
-- 3.4 brief_consent
-- ---------------------------------------------------------------------------

create table brief_consent (
  id                   uuid primary key default gen_random_uuid(),
  brief_id             uuid not null references briefs(id) on delete restrict,
  consent_type         text not null check (consent_type in ('photo_upload','terms')),
  consent_text_version text not null,
  consent_text_hash    text not null,
  signed_at            timestamptz default now(),
  ip_address           inet,
  user_agent           text,
  unique (brief_id, consent_type)
);

create index brief_consent_brief_idx on brief_consent (brief_id);

-- ---------------------------------------------------------------------------
-- 3.5 analysis_runs
-- ---------------------------------------------------------------------------

create table analysis_runs (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid not null references briefs(id) on delete cascade,
  run_index       int not null check (run_index >= 1),
  trigger_type    text not null check (trigger_type in ('initial','re_analyze_with_note')),
  founder_note    text,
  ai_output       jsonb not null,
  model           text not null,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(8,6),
  duration_ms     integer,
  ran_at          timestamptz default now(),
  is_current      boolean not null default true,
  unique (brief_id, run_index)
);

create unique index analysis_runs_one_current_per_brief
  on analysis_runs (brief_id) where is_current = true;
create index analysis_runs_brief_idx on analysis_runs (brief_id, run_index);

-- ---------------------------------------------------------------------------
-- 3.6 analysis_edits
-- ---------------------------------------------------------------------------

create table analysis_edits (
  id              uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references analysis_runs(id) on delete cascade,
  field_path      text not null,
  value_before    text,
  value_after     text,
  edited_by       text not null,
  edited_at       timestamptz default now()
);

create index analysis_edits_run_idx on analysis_edits (analysis_run_id);
create index analysis_edits_recent_idx on analysis_edits (edited_at desc);

-- ---------------------------------------------------------------------------
-- 3.7 orders
-- ---------------------------------------------------------------------------

create table orders (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references customers(id) on delete restrict,
  brief_id                 uuid not null references briefs(id) on delete restrict,
  approved_analysis_run_id uuid references analysis_runs(id) on delete set null,
  tier                     text not null check (tier in ('starter','standard','calendar')),
  amount_ngn               integer not null check (amount_ngn > 0),
  status                   text not null default 'pending_founder_review' check (status in (
    'pending_founder_review',
    'discarded',
    'brief_sent',
    'payment_initiated',
    'paid',
    'production',
    'delivered',
    'refunded'
  )),
  paystack_tx_ref          text,
  paystack_authorization   jsonb,
  founder_approved_at      timestamptz,
  founder_approved_by      text,
  brief_email_sent_at      timestamptz,
  payment_initiated_at     timestamptz,
  paid_at                  timestamptz,
  production_started_at    timestamptz,
  delivered_at             timestamptz,
  refunded_at              timestamptz,
  refund_reason            text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  unique (paystack_tx_ref)
);

create index orders_status_idx on orders (status);
create index orders_pending_review_idx on orders (created_at)
  where status = 'pending_founder_review';
create index orders_paid_recent_idx on orders (paid_at desc) where status = 'paid';
create index orders_customer_idx on orders (customer_id);
create index orders_brief_idx on orders (brief_id);

alter table orders replica identity full;

-- ---------------------------------------------------------------------------
-- 3.8 payments
-- ---------------------------------------------------------------------------

create table payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references orders(id) on delete restrict,
  paystack_event_id    text not null,
  event_type           text not null,
  amount_ngn           integer not null,
  raw_payload          jsonb not null,
  webhook_received_at  timestamptz default now(),
  unique (paystack_event_id)
);

create index payments_order_idx on payments (order_id);
create index payments_event_type_idx on payments (event_type);

-- ---------------------------------------------------------------------------
-- 3.9 email_log
-- ---------------------------------------------------------------------------

create table email_log (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references customers(id) on delete restrict,
  brief_id           uuid references briefs(id) on delete set null,
  order_id           uuid references orders(id) on delete set null,
  template_key       text not null,
  resend_message_id  text,
  to_email           text not null,
  subject            text not null,
  body_snapshot      text,
  sent_at            timestamptz default now(),
  delivered_at       timestamptz,
  bounced_at         timestamptz,
  bounce_reason      text
);

create index email_log_customer_idx on email_log (customer_id);
create index email_log_template_idx on email_log (template_key, sent_at desc);
create unique index email_log_resend_id_uniq on email_log (resend_message_id)
  where resend_message_id is not null;

-- ---------------------------------------------------------------------------
-- 3.10 whatsapp_log
-- ---------------------------------------------------------------------------

create table whatsapp_log (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references customers(id) on delete set null,
  order_id            uuid references orders(id) on delete set null,
  evolution_message_id text,
  to_number           text not null,
  template_key        text,
  body                text not null,
  direction           text not null check (direction in ('outbound','inbound')),
  sent_at             timestamptz default now(),
  delivered_at        timestamptz,
  read_at             timestamptz,
  failed_at           timestamptz,
  failure_reason      text
);

create index whatsapp_log_customer_idx on whatsapp_log (customer_id);
create index whatsapp_log_order_idx on whatsapp_log (order_id);
create unique index whatsapp_log_evo_id_uniq on whatsapp_log (evolution_message_id)
  where evolution_message_id is not null;

-- ---------------------------------------------------------------------------
-- 3.11 activity_log
-- ---------------------------------------------------------------------------

create table activity_log (
  id            bigserial primary key,
  customer_id   uuid references customers(id) on delete set null,
  brief_id      uuid references briefs(id) on delete set null,
  order_id      uuid references orders(id) on delete set null,
  event_type    text not null,
  actor         text not null check (actor in ('customer','founder','system','webhook')),
  payload       jsonb,
  occurred_at   timestamptz default now()
);

create index activity_log_customer_idx on activity_log (customer_id, occurred_at desc);
create index activity_log_brief_idx on activity_log (brief_id, occurred_at desc);
create index activity_log_order_idx on activity_log (order_id, occurred_at desc);
create index activity_log_event_idx on activity_log (event_type, occurred_at desc);
create index activity_log_recent_idx on activity_log (occurred_at desc);

alter table activity_log replica identity full;

-- ---------------------------------------------------------------------------
-- 3.12 llm_calls
-- ---------------------------------------------------------------------------

create table llm_calls (
  id              uuid primary key default gen_random_uuid(),
  purpose         text not null,
  brief_id        uuid references briefs(id) on delete set null,
  analysis_run_id uuid references analysis_runs(id) on delete set null,
  model           text not null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  cost_usd        numeric(8,6) not null,
  duration_ms     integer not null,
  status          text not null check (status in ('ok','retry','failed')),
  error_message   text,
  called_at       timestamptz default now()
);

create index llm_calls_purpose_recent_idx on llm_calls (purpose, called_at desc);
create index llm_calls_failed_idx on llm_calls (called_at desc) where status = 'failed';

-- ---------------------------------------------------------------------------
-- Realtime: REPLICA IDENTITY FULL on every table published in 0003.
-- analysis_runs is added here defensively; data-model.md §6 asserts all three
-- realtime-published tables have this set, but §3.5 omits the explicit ALTER.
-- Carried per CLAUDE.md gotcha #4. Surface this for doc reconciliation.
-- ---------------------------------------------------------------------------

alter table analysis_runs replica identity full;

-- ===========================================================================
-- Row-level security (per docs/data-model.md §7)
-- Default-deny baseline on every table; founder-role permissive policies on
-- the four tables the CRM reads/writes via the supabase-js client.
-- ===========================================================================

-- Default-deny baseline for every table.
alter table customers       enable row level security;
alter table briefs          enable row level security;
alter table brief_photos    enable row level security;
alter table brief_consent   enable row level security;
alter table analysis_runs   enable row level security;
alter table analysis_edits  enable row level security;
alter table orders          enable row level security;
alter table payments        enable row level security;
alter table email_log       enable row level security;
alter table whatsapp_log    enable row level security;
alter table activity_log    enable row level security;
alter table llm_calls       enable row level security;

create policy customers_anon_deny       on customers      as restrictive to anon using (false) with check (false);
create policy briefs_anon_deny          on briefs         as restrictive to anon using (false) with check (false);
create policy brief_photos_anon_deny    on brief_photos   as restrictive to anon using (false) with check (false);
create policy brief_consent_anon_deny   on brief_consent  as restrictive to anon using (false) with check (false);
create policy analysis_runs_anon_deny   on analysis_runs  as restrictive to anon using (false) with check (false);
create policy analysis_edits_anon_deny  on analysis_edits as restrictive to anon using (false) with check (false);
create policy orders_anon_deny          on orders         as restrictive to anon using (false) with check (false);
create policy payments_anon_deny        on payments       as restrictive to anon using (false) with check (false);
create policy email_log_anon_deny       on email_log      as restrictive to anon using (false) with check (false);
create policy whatsapp_log_anon_deny    on whatsapp_log   as restrictive to anon using (false) with check (false);
create policy activity_log_anon_deny    on activity_log   as restrictive to anon using (false) with check (false);
create policy llm_calls_anon_deny       on llm_calls      as restrictive to anon using (false) with check (false);

-- Founder permissive policies (per §7).
-- The 'founder' role is a JWT custom claim stamped by 0004's auth hook.
-- All other tables: service_role only (the agent container reads/writes via
-- the service-role key; RLS is bypassed for service_role by Supabase default).

create policy briefs_founder_read on briefs to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

create policy orders_founder_read on orders to authenticated
  using (auth.jwt() ->> 'role' = 'founder');
create policy orders_founder_update on orders to authenticated
  using (auth.jwt() ->> 'role' = 'founder')
  with check (auth.jwt() ->> 'role' = 'founder');

create policy analysis_runs_founder_read on analysis_runs to authenticated
  using (auth.jwt() ->> 'role' = 'founder');
create policy analysis_runs_founder_update on analysis_runs to authenticated
  using (auth.jwt() ->> 'role' = 'founder')
  with check (auth.jwt() ->> 'role' = 'founder');

create policy analysis_edits_founder_all on analysis_edits to authenticated
  using (auth.jwt() ->> 'role' = 'founder')
  with check (auth.jwt() ->> 'role' = 'founder');

commit;
