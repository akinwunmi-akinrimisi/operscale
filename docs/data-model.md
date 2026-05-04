# Data model

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Last updated:** 2026-05-03.

This document is the single source of truth for the Phase 1 database schema. Migrations live in `supabase/migrations/` and must match this document line-for-line. If reality drifts from this doc, fix the doc OR fix the migration — never let them disagree silently.

## 1. Design principles

These principles apply to every table, column, and index in this schema. When in doubt during a build, return to these.

- **Append-only where possible.** `activity_log`, `analysis_runs`, `analysis_edits`, and `payments` are append-only. We never `UPDATE` rows in these tables — we insert new rows. This makes audit trivial and removes a class of race conditions.
- **No soft deletes for ordinary records.** Customer records, briefs, orders — these stay even when a customer asks to be forgotten. We hard-delete only on explicit NDPC requests, and we do it in a single transactional procedure (see section 9). Soft deletes accumulate, leak through queries, and force every `SELECT` to remember `WHERE deleted_at IS NULL`. Phase 1 is small enough to do this right.
- **Idempotency keys, not UPDATE-with-WHERE.** Every external webhook (Paystack, Resend) and every async job (AI analysis, photo retention sweep, email send) writes to a table with a `UNIQUE` constraint that catches duplicates. We design for "every job runs exactly twice" and the second run is a no-op.
- **Foreign keys with `ON DELETE` clauses spelled out.** No FK is left without an explicit `ON DELETE` policy. We choose `CASCADE` for owned children (photos belong to briefs), `RESTRICT` for shared references (you can't delete a customer who has paid orders), and `SET NULL` only for optional pointers.
- **`timestamptz` everywhere, WAT-aware.** All timestamps are `timestamptz` and stored in UTC. The CRM displays them in WAT. Never use `timestamp without time zone`.
- **JSONB only for genuinely variable shapes.** Form payload, AI output, webhook payloads — yes. Customer address, tier name, status — no. JSONB lets you avoid a migration but it also lets you forget what fields exist. Use sparingly.
- **Realtime tables have `REPLICA IDENTITY FULL`.** Without this, `DELETE` and partial `UPDATE` events don't carry the old row, and the CRM's live subscriptions break in confusing ways.
- **RLS default-deny.** Every table starts with `ENABLE ROW LEVEL SECURITY` plus a `RESTRICTIVE` deny-all policy for the `anon` role. Then we add permissive policies only where needed.

## 2. Schema overview

Phase 1 has 13 tables, organised in five logical groups:

| Group | Tables |
|---|---|
| Customer + intake | `customers`, `briefs`, `brief_photos`, `brief_consent` |
| AI analysis + review | `analysis_runs`, `analysis_edits`, `customer_framework_history` |
| Orders + payments | `orders`, `payments` |
| Communications | `email_log`, `whatsapp_log` |
| Audit + telemetry | `activity_log`, `llm_calls` |

Two Supabase Storage buckets:

| Bucket | Contents |
|---|---|
| `customer-photos` | Reference photos for AI avatar creation. Private. RLS deny-all to `anon`. |
| `customer-logos` | Brand logos uploaded in form step 4. Private. |

Two Supabase Edge Functions for scheduled work:

| Function | Schedule | What it does |
|---|---|---|
| `photo-retention-sweep` | Daily at 03:00 WAT | Delete photo files where `scheduled_delete_at <= now()`. |
| `drop-off-recovery` | Every 30 minutes | Identify form drops + payment drops eligible for recovery emails. |

## 3. Tables — full DDL

The DDL below is the authoritative form. Migrations may be split across files but the cumulative result must match this exactly.

### 3.1 `customers`

```sql
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
```

Notes. `email_lower` is a generated column — we deduplicate on it. Source values are constrained at the application layer (instagram, tiktok, search, referral, direct, other). We don't put a `CHECK` constraint on `source` because new channels show up frequently and a constraint forces a migration each time.

### 3.2 `briefs`

```sql
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
```

Notes. `briefs_unsubmitted_step3_idx` is a partial index that powers the drop-off recovery cron — we want to find every brief that reached step 3 but never submitted, and we want that scan to be tiny. `form_payload` is JSONB because the structure varies by niche (real-estate has different follow-up questions than beauty), and we want to avoid a column explosion.

### 3.3 `brief_photos`

```sql
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
```

Notes. `scheduled_delete_at` is set at insert time (uploaded_at + 30 days). When the order ships, an UPDATE pushes it to `delivered_at + 90 days`. The partial index on undeleted photos is what the daily retention sweep scans. Quality scores are advisory; we do NOT block uploads on a failed check — we surface the warning in the UI.

### 3.4 `brief_consent`

```sql
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
```

Notes. `ON DELETE RESTRICT` on the FK is deliberate — we never delete a brief that has signed consent records, even if the customer asks to be forgotten. The forgetting procedure (section 9) handles the customer-data-deletion-with-consent-history case explicitly. `consent_text_hash` is SHA-256 of the canonical text, which lets us prove which version of the consent text the customer agreed to.

### 3.5 `analysis_runs`

```sql
create table analysis_runs (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid not null references briefs(id) on delete cascade,
  run_index       int not null check (run_index >= 1),
  trigger_type    text not null check (trigger_type in ('initial','re_analyze_with_note')),
  founder_note    text,
  ai_output       jsonb not null,
  framework_seed  jsonb,
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
```

Notes. The unique partial index enforces that exactly one row per brief can have `is_current = true`. When the founder triggers a re-analysis, we do this in a transaction:

```sql
update analysis_runs set is_current = false where brief_id = $1 and is_current = true;
insert into analysis_runs (brief_id, run_index, ...) values ($1, $next_index, ...);
```

Old runs are NEVER deleted. They're the audit trail and the training data.

The `framework_seed` JSONB column (added in V2 content migration) stores the deterministic seed inputs, hash, selected frameworks, selected archetypes, selected pairs, and exhaustion / LRU flags for each analysis run. Full structure documented in `docs/specs/non-duplication-system.md` section 5. Example contents:

```json
{
  "seed_inputs": {
    "customer_id": "uuid",
    "niche": "beauty",
    "order_index": 1,
    "submission_week_iso": "2026-W18"
  },
  "seed_hash": "sha256:abc123...",
  "selected_frameworks": ["dr_formula", "pas", "myth_buster"],
  "selected_archetypes": ["pricing_breakdown", "common_mistake", "decoded_jargon"],
  "selected_pairs": [
    {"slot": 1, "framework": "dr_formula", "archetype": "pricing_breakdown"},
    {"slot": 2, "framework": "pas", "archetype": "common_mistake"}
  ],
  "exhaustion_warning": false,
  "lru_fallback_used": false
}
```

### 3.6 `analysis_edits`

```sql
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
```

Notes. `field_path` uses dotted notation matching the JSON Pointer-ish convention used in the CRM, e.g. `recommended_angles[0].hook` or `brand_voice.tone_summary`. `edited_by` is the founder's email. We store text representations of before/after even for nested objects (we JSON.stringify them).

### 3.6b `customer_framework_history`

Added in V2 content migration. Tracks every (framework, archetype) pair ever delivered to a customer (i.e. approved by the founder). Used to ensure no pair repeats for a returning customer until the bank exhausts. Full mechanism documented in `docs/specs/non-duplication-system.md`.

```sql
create table customer_framework_history (
  customer_id     uuid not null references customers(id) on delete restrict,
  order_id        uuid not null references orders(id) on delete restrict,
  framework_slot  text not null,
  archetype_slot  text not null,
  used_at         timestamptz default now(),
  primary key (customer_id, framework_slot, archetype_slot)
);

create index customer_framework_history_customer_idx
  on customer_framework_history (customer_id);

create index customer_framework_history_order_idx
  on customer_framework_history (order_id);
```

Notes. Rows are written by the founder-approval handler — when a founder approves an analysis run (`founder_approved` event), the application iterates `analysis_runs.framework_seed.selected_pairs` and inserts one row per pair. Re-analyses do not write rows; only approval does. This means a customer who has had two re-analyses and one approval has rows from the approved run only.

The composite primary key `(customer_id, framework_slot, archetype_slot)` enforces that the same pair cannot be recorded twice for the same customer. A subsequent insert with the same key is treated as a no-op (`ON CONFLICT DO NOTHING` from the application).

`ON DELETE RESTRICT` for both foreign keys: rows survive customer deletion via NDPC anonymisation (the customer_id is set to a sentinel UUID rather than the row being dropped) — see section 9 for details. We never want to silently lose history that informs future selections.

### 3.7 `orders`

```sql
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
```

Notes. The `unique (paystack_tx_ref)` is the single most important constraint in the schema. It's the idempotency key that prevents double-charging when Paystack retries a webhook. The status check constraint enforces the valid state set; transitions are enforced in application code (we don't use a state-transition trigger because they make debugging harder than they're worth at our scale). `replica identity full` is required for Realtime to publish `UPDATE` events with the old row visible.

### 3.8 `payments`

```sql
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
```

Notes. `unique (paystack_event_id)` is our second idempotency key. Paystack sends a unique event ID per webhook delivery; even if they retry the same event, we accept it once. `raw_payload` keeps the entire webhook body for forensic purposes.

### 3.9 `email_log`

```sql
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
```

Notes. `body_snapshot` is the rendered email body at send time — useful for "what did the customer actually receive?" forensic queries. We don't store images; just the text/HTML.

### 3.10 `whatsapp_log`

```sql
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
```

### 3.11 `activity_log`

```sql
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
```

Notes. `bigserial` because this table grows fast. The CRM's customer detail page queries this table by `customer_id` ordered by `occurred_at desc`, so the index supports that exactly. Event types are documented in section 5.

### 3.12 `llm_calls`

```sql
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
```

Notes. We log every Anthropic call here, not just brief analysis. Purpose values: `brief_analysis_initial`, `brief_analysis_reanalyze`, `email_subject_personalization`, `crm_search_query` (future), etc. The cost-monitoring view in the CRM queries this directly.

## 4. Foreign-key topology

```
customers (root)
   ├── briefs (one-to-many, RESTRICT — never lose customer history)
   │     ├── brief_photos (one-to-many, CASCADE — delete photos when brief deleted)
   │     ├── brief_consent (one-to-many, RESTRICT — keep consent history forever)
   │     ├── analysis_runs (one-to-many, CASCADE)
   │     │     └── analysis_edits (one-to-many, CASCADE)
   │     └── orders (one-to-many, RESTRICT)
   │             ├── payments (one-to-many, RESTRICT)
   │             ├── customer_framework_history (one-to-many, RESTRICT — survives customer anonymisation)
   │             ├── email_log (one-to-many, SET NULL — emails outlive orders)
   │             └── whatsapp_log (one-to-many, SET NULL)
   ├── customer_framework_history (one-to-many, RESTRICT — survives customer anonymisation)
   ├── email_log (one-to-many, RESTRICT)
   ├── whatsapp_log (one-to-many, SET NULL)
   └── activity_log (one-to-many, SET NULL — log survives if customer deleted)
```

The asymmetry is intentional. Photos and analyses are owned by briefs, so they cascade. Consent records, orders, payments, and framework history outlive the customer record for compliance and for informing future selections. Logs survive even if customer/brief/order references go to NULL — we still want the audit trail, even if it's anonymised.

## 5. Activity log event taxonomy

Every event written to `activity_log` uses one of the names below. New event types are added by amending this list AND the application code together. No silent additions.

**Form lifecycle:**
`form_started`, `form_step_completed` (with `payload.step`), `form_saved` (token issued), `form_resumed`, `form_submitted`.

**Photo lifecycle:**
`photo_uploaded`, `photo_quality_check_passed`, `photo_quality_check_failed`, `photo_deleted_by_customer_request`, `photo_deleted_by_retention_sweep`.

**Consent:**
`consent_signed` (with `payload.type` = photo_upload or terms).

**Email:**
`email_auto_ack_sent`, `email_brief_sent`, `email_payment_confirmation_sent`, `email_recovery_sent`, `email_bounced`.

**AI analysis:**
`ai_analysis_started`, `ai_analysis_completed`, `ai_analysis_failed`, `ai_reanalyze_requested` (with `payload.note`), `bank_exhausted_lru_fallback` (with `payload.customer_id`, `payload.run_id`).

**Founder review:**
`founder_opened_review`, `founder_edited_field` (with `payload.field_path`, `payload.before`, `payload.after`), `founder_approved`, `founder_discarded` (with `payload.reason`).

**Payment:**
`payment_initiated`, `payment_succeeded`, `payment_failed`, `payment_refunded`.

**WhatsApp:**
`whatsapp_sent`, `whatsapp_delivered`, `whatsapp_read`, `whatsapp_failed`.

**Production handoff:**
`production_started`, `production_delivered`.

## 6. Realtime publication

Three tables are published to Realtime so the CRM updates without polling:

```sql
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table analysis_runs;
alter publication supabase_realtime add table activity_log;
```

All three have `REPLICA IDENTITY FULL` set. The CRM subscribes per-channel:

- `pending-review` channel — filters `orders` where `status = 'pending_founder_review'`.
- `order-detail-{order_id}` channel — filters `orders`, `analysis_runs`, `activity_log` for one order.

We deliberately do NOT publish `analysis_edits`, `email_log`, `whatsapp_log`, `payments` to Realtime. Those tables update through ordinary fetch when the founder navigates to the order; the live channels would create more noise than signal.

## 7. Row-level security

Every table starts with this baseline:

```sql
alter table <name> enable row level security;
create policy <name>_anon_deny on <name> as restrictive to anon using (false) with check (false);
```

Then we add permissive policies. Phase 1 has only one role beyond `anon` and `service_role`: `founder` (a custom claim issued by the magic-link auth flow).

Per-table policies for Phase 1:

```sql
-- briefs: customers don't read briefs through RLS in Phase 1.
-- All form writes happen via service_role API endpoints.
-- Founder reads everything.
create policy briefs_founder_read on briefs to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

-- orders: same pattern.
create policy orders_founder_read on orders to authenticated
  using (auth.jwt() ->> 'role' = 'founder');
create policy orders_founder_update on orders to authenticated
  using (auth.jwt() ->> 'role' = 'founder')
  with check (auth.jwt() ->> 'role' = 'founder');

-- analysis_runs: founder read + update is_current flag during re-analysis.
create policy analysis_runs_founder_read on analysis_runs to authenticated
  using (auth.jwt() ->> 'role' = 'founder');
create policy analysis_runs_founder_update on analysis_runs to authenticated
  using (auth.jwt() ->> 'role' = 'founder')
  with check (auth.jwt() ->> 'role' = 'founder');

-- analysis_edits: founder read + insert during inline edits.
create policy analysis_edits_founder_all on analysis_edits to authenticated
  using (auth.jwt() ->> 'role' = 'founder')
  with check (auth.jwt() ->> 'role' = 'founder');

-- All other tables: service_role only. The CRM hits them through API endpoints,
-- never directly via Supabase JS client.
```

Storage buckets follow the same default-deny pattern. The `customer-photos` bucket has NO public read policy. The CRM displays photos by minting a 5-minute signed URL per request via the service-role key.

## 8. Indexes — what they're for

Every index in this schema is justified. If a query doesn't need an index, we don't add one. List below maps query → index.

| Query | Index used |
|---|---|
| Find duplicate customer at submit time | `customers_email_lower_uniq` |
| Pending review queue (oldest first) | `orders_pending_review_idx` |
| Recent paid orders (CRM dashboard) | `orders_paid_recent_idx` |
| Order detail by ID | `orders_pkey` |
| Activity timeline for one customer | `activity_log_customer_idx` |
| Activity timeline for one order | `activity_log_order_idx` |
| Drop-off recovery candidates (form abandoned) | `briefs_unsubmitted_step3_idx` |
| Daily retention sweep | `brief_photos_sweep_idx` |
| Idempotency: Paystack retry | `orders.paystack_tx_ref` UNIQUE |
| Idempotency: Resend retry | `email_log.resend_message_id` UNIQUE |
| Cost monitoring by purpose | `llm_calls_purpose_recent_idx` |
| Failed LLM calls (alerting) | `llm_calls_failed_idx` |

We deliberately do NOT index:

- `email`, `whatsapp_number`, `business_name` text search — Phase 1 has too few customers to need this. We use a sequential scan and revisit when row counts approach 5,000.
- `form_payload` JSONB fields — no query plan in Phase 1 needs them.
- `created_at` on every table — too generic. We only index it where a real query orders by it.

## 9. NDPC deletion procedure

When a customer requests deletion under their NDPC rights, run this transaction (parameter is `customer_id`):

```sql
begin;

-- 1. Delete photo files from Storage (separate API call, before SQL).
--    The photo retention sweep handles this if scheduled_delete_at is set,
--    but a customer-requested deletion sets it to now() and runs the sweep
--    immediately for that customer's records.

-- 2. Anonymize logs that survive deletion.
update activity_log set customer_id = null where customer_id = $1;
update whatsapp_log set customer_id = null where customer_id = $1;

-- 3. Delete owned children. CASCADE handles photos → analyses → edits.
delete from briefs where customer_id = $1;
-- This cascades to brief_photos, brief_consent (RESTRICTed — error if any),
-- analysis_runs, analysis_edits.
-- If brief_consent RESTRICT blocks: handle the consent records first.

-- 4. Block delete of orders if any are paid (commercial records retention).
--    For pre-payment orders, delete.
delete from orders where customer_id = $1 and status in ('pending_founder_review','discarded','brief_sent');

-- 5. Email log: keep records (retention obligation), anonymize.
update email_log set customer_id = null, to_email = '[deleted]' where customer_id = $1;

-- 6. Finally delete customer.
delete from customers where id = $1;

commit;
```

The one place this gets thorny is **paid orders**: Nigerian commercial law requires retention of transaction records for a number of years, and NDPC's right-to-be-forgotten is subordinate to that. If a customer asks to be deleted and they have a paid order, we keep the order record, anonymize all PII (email, name, WhatsApp), and document the response to the customer with a copy of the relevant retention obligation. This is a manual, founder-handled flow — never automated.

## 10. Migration file ordering

Migrations are applied in lexical order by Supabase. We use a 4-digit numeric prefix:

```
0001_init_schema.sql              -- All 12 tables, indexes, FKs, RLS
0002_storage_buckets.sql          -- customer-photos, customer-logos with policies
0003_realtime_publication.sql     -- Add tables to supabase_realtime
0004_edge_function_helpers.sql    -- Any RPC functions used by Edge Functions
0005_framework_seed_and_history.sql -- V2 framework_seed JSONB on analysis_runs + customer_framework_history table
0006_ai_analysis_jobs.sql         -- V2 Phase 1 durable queue (worker pickup + status lifecycle)
```

Future schema changes follow the same pattern (`0007_*`...). Migrations are append-only — never edit a migration after it's applied to any environment, even staging.

### `ai_analysis_jobs` (added by `0006_*`)

Durable queue for V2 brief analysis. Inserted by the analyze HTTP route at form-submit or re-analyze trigger time; consumed by the worker container which polls every 5 seconds and claims rows with `FOR UPDATE SKIP LOCKED`.

Lifecycle: `queued` → `running` → `completed | failed`. Stuck rows (`status='running'` for >5 min) are reclaimed by the worker startup sweep (per the design doc invariant #2).

Key columns:
- `idempotency_key` (UNIQUE) — `{brief_id}::{trigger_type}::{prior_run_index|0}` — prevents duplicate enqueue.
- `attempt_count` — incremented on each claim; ≥3 → permanent failure with `error_detail.reason='orphaned_by_restart'`.
- `prior_run_id` + `founder_note` — required for `re_analyze_*` trigger types (enforced by a constraint trigger).
- `resulting_run_id` — populated on success; FK to `analysis_runs`.

RLS: anon denied; founder reads via JWT claim; `service_role` bypasses (used by both agent and worker containers).
Replica identity full (per CLAUDE.md gotcha #4).

## 11. Backups

Daily logical `pg_dump` runs at 02:30 WAT on the VPS, output gzipped to Backblaze B2 bucket `operscale-supabase-backups`. Retention 30 days. Schema-only dump is also captured and committed to a private operations repo (so we always have a structural snapshot, separate from the data).

Photos in Storage are NOT included in DB backups by design — the 90-day retention is a promise to customers, and a backup that resurrects deleted photos breaks that promise. If a photo is deleted prematurely by accident, that's an incident, not a recoverable mistake.

## 12. What's NOT in this schema

Documenting absences explicitly so future Claude sessions don't propose adding them:

- **No `users` table.** Founder auth is a Supabase magic-link flow with the `founder` role custom claim. No user records on our side.
- **No `roles` or `permissions` tables.** Phase 1 has one role (founder). When we add a reviewer role, we add a JWT claim, not a relational table.
- **No multi-tenant `tenant_id` columns.** Operscale is the only tenant. If we ever sell this platform to another agency, that's a fork, not a multi-tenant enablement.
- **No subscription tables.** Phase 1 is one-off only.
- **No A/B test tables.** We have too little volume for stat-sig tests in Phase 1.
- **No `audit_log` separate from `activity_log`.** They're the same thing. We don't need two.

## 13. Verification

After running migrations on a fresh database, this query should return exactly the tables in the order listed below:

```sql
select tablename from pg_tables where schemaname = 'public' order by tablename;
```

Expected output:
```
activity_log
analysis_edits
analysis_runs
brief_consent
brief_photos
briefs
customers
email_log
llm_calls
orders
payments
whatsapp_log
```

If your output differs, stop and reconcile before proceeding with any application work.
