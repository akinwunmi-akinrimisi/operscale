# Phase 6.1 — `/v1/brief/save` + `/v1/brief/submit` backend (no UI)

Date: 2026-05-07
Predecessor: master plan `docs/plans/2026-05-07-v2-phase-6-customer-brief-form.md` approved.
Follows: § 5.6.1 of the master plan.

## Goal

Stand up the entire backend surface that the form will call. By the end of 6.1, an automated curl smoke can drive a full anonymous customer journey from "step 1 save" through "submit" and observe `orders.status='pending_founder_review'` + auto-ack email delivered + AI analysis job queued. **Zero UI work in this sub-phase.**

## Scope

5 files added/changed, broken into 5 atomic commits:

| Commit | Path | Purpose |
|---|---|---|
| C1 | `apps/agent/src/lib/form-payload-schema.ts` (new) | Single zod source-of-truth for form_payload step schemas + cookie helpers + 24-char save_token generator |
| C2 | `apps/web/src/emails/AutoAckEmail.tsx` (new) | React Email template per `email-templates.md` § auto-ack |
| C3 | `apps/agent/src/lib/email.ts` (extend) | Allow new template keys: `auto-ack`, `save-token`, `recovery-form` |
| C4 | `apps/agent/src/app/v1/brief/save/route.ts` (new) | POST + OPTIONS, withCors. Handles steps 1–6 (not photos). Issues save_token at step 3. |
| C5 | `apps/agent/src/app/v1/brief/submit/route.ts` (replace 501) | POST + OPTIONS, withCors. Full transaction. Auto-ack email. AI analysis enqueue. |

Plus tests beside each (`*.test.ts`).

## Non-scope (deferred to later sub-phases)

- Photo upload (6.2)
- Drop-off recovery cron (6.3)
- Any UI (6.4+)
- Logo upload (6.6 — separate endpoint)
- Resume route `/brief/[token]` (6.5 — frontend)

## Step → field schema (canonical)

`form-payload-schema.ts` exports per-step zod schemas; the union is what `submit/route.ts` validates. **`customer_backstory_verbatim` is NEVER trimmed/transformed** (per `ai-brief-analysis.md` regex).

```ts
// 6.1 schemas — verbatim, no string transformations on free-text fields

const Step1 = z.object({
  tier_intent: z.enum(['starter', 'standard', 'calendar']),
});

const Step2 = z.object({
  brand_name: z.string().min(1).max(120),
  owner_name: z.string().min(1).max(120),
  phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/, 'phone must be E.164'),
  email: z.string().email().max(254),
  niche_slug: z.string().min(1).max(60),
  niche_label: z.string().min(1).max(120),
  one_line_description: z.string().min(10).max(280),
  offer_description: z.string().min(10).max(2000),
  price_point_band: z.enum([
    'under_5k', '5k_25k', '25k_100k', '100k_500k', 'over_500k',
  ]), // NGN bands
});

const Step3 = z.object({
  primary_audience_description: z.string().min(10).max(1000),
  audience_age_range: z.string().min(1).max(40),
  audience_location: z.string().min(1).max(200),
  audience_belief: z.string().min(10).max(1000),
  audience_belief_target: z.string().min(10).max(1000),
});

const Step4 = z.object({
  logo_uploaded_yes_no: z.enum(['yes', 'no']),
  brand_colours: z.string().max(280).optional(),
  instagram_handle: z.string().max(60).optional(),
});

// Step 5 is photo upload — handled by /v1/brief/upload-photo (6.2). Not in
// the save schema. The submit endpoint reads photo_count by joining brief_photos.

const Step6 = z.object({
  stated_voice: z.string().min(1).max(2000),
  reference_posts_block: z.string().max(20000),
  customer_backstory_verbatim: z.string().max(20000),
});

// Step 7 is review + submit. The submit endpoint validates the FULL form_payload
// has all required keys from steps 1-3 + 6 (step 4 is mostly optional, step 5
// is read from brief_photos).

export const SaveBodySchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal(1), brief_id: z.string().uuid().optional(), customer_id: z.string().uuid().optional(), payload: Step1 }),
  z.object({ step: z.literal(2), brief_id: z.string().uuid(), customer_id: z.string().uuid(), payload: Step2 }),
  z.object({ step: z.literal(3), brief_id: z.string().uuid(), customer_id: z.string().uuid(), payload: Step3 }),
  z.object({ step: z.literal(4), brief_id: z.string().uuid(), customer_id: z.string().uuid(), payload: Step4 }),
  z.object({ step: z.literal(6), brief_id: z.string().uuid(), customer_id: z.string().uuid(), payload: Step6 }),
]);

export const SubmitBodySchema = z.object({
  brief_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  terms_consent_text_version: z.literal('v1'),
  terms_consent_text_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
```

## Cookie / session strategy (per master plan §7 Q1)

- First `/v1/brief/save` step=1 with no `brief_id` → server creates `customers` (stub: email NULL) + `briefs` (current_step=1, form_payload=`{tier_intent}`) + `activity_log:form_started`. Returns `{ brief_id, customer_id }`. Sets `os_brief_session=<customer_id>` HTTP-only Secure cookie, Path=/, Domain=.operscale.cloud, Max-Age=7d.
- Subsequent saves: client sends both `brief_id` (from localStorage) and `customer_id` (from cookie OR localStorage — whichever arrives first wins, server verifies they match the row).
- Browser-blocked cookie case: client falls back to localStorage-only. Server doesn't require the cookie; it's a defense-in-depth credential, not a hard requirement.

## Save endpoint behaviour (POST `/v1/brief/save`)

Discriminated by `step`:

| Step | Required input | DB writes | Side effect |
|---|---|---|---|
| 1 | `payload.tier_intent` | If `brief_id` absent: insert customers + briefs (`tier_intent`, `current_step=1`, `form_payload={tier_intent}`). Else: `briefs.tier_intent = $1, form_payload['tier_intent'] = $1`. | activity_log:`form_started` (first save) or `form_step_completed`(step=1) |
| 2 | full Step2 payload | `customers SET email_lower, full_name, whatsapp_number, business_name, niche, source`; `briefs SET form_payload = jsonb_set(form_payload, '{...}', ...)` for each Step2 key; `current_step=2`, `last_updated_at=now()` | activity_log:`form_step_completed`(step=2) |
| 3 | full Step3 payload | merge into form_payload; **issue `save_token` (24 char URL-safe)**; `current_step=3` | activity_log:`form_step_completed`(step=3) + `form_saved`; **fire save-token email synchronously** |
| 4 | full Step4 payload | merge into form_payload; `current_step=4` | activity_log:`form_step_completed`(step=4) |
| 6 | full Step6 payload | merge into form_payload; `current_step=6` | activity_log:`form_step_completed`(step=6) |

Idempotency: re-saving the same step with identical payload → no error; `last_updated_at` refreshed; no duplicate activity_log entries (existence check first).

Failure modes:
- Resend save-token send fails → 200 still returned; activity_log `email_failed`; toast on UI lies as designed (per customer-journey.md §2.4).
- Customer-id/brief-id mismatch → 403 `cookie_mismatch`. Form clears state and restarts.
- Validation error → 400 `{ error: 'validation', issues: [...] }`.

## Submit endpoint behaviour (POST `/v1/brief/submit`)

Single transaction:
```sql
BEGIN;
  SELECT id, current_step, form_payload, customer_id, submitted_at
    FROM briefs WHERE id = $brief_id FOR UPDATE;
  -- Idempotency: if submitted_at IS NOT NULL → COMMIT; return existing IDs.

  -- Validate full form_payload has all required keys (Step1+2+3+6;
  -- Step4 mostly optional). Validate terms consent hash matches canonical.

  UPDATE customers SET source = COALESCE(source, 'direct'), last_seen_at = now(), updated_at = now() WHERE id = $customer_id;

  UPDATE briefs SET
    current_step = 7,
    submitted_at = now(),
    last_updated_at = now()
  WHERE id = $brief_id;

  INSERT INTO orders (id, customer_id, brief_id, tier, amount_ngn, status)
    VALUES (gen_random_uuid(), $customer_id, $brief_id,
            $form_payload.tier_intent,
            $price_lookup_for_tier,
            'pending_founder_review');

  INSERT INTO brief_consent (brief_id, consent_type, consent_text_version, consent_text_hash, signed_at, ip_address, user_agent)
    VALUES ($brief_id, 'terms', 'v1', $hash, now(), $ip, $ua);

  -- Re-link any orphan brief_photos uploaded before the brief existed:
  UPDATE brief_photos SET brief_id = $brief_id
    WHERE customer_id = $customer_id AND brief_id IS NULL;

  INSERT INTO activity_log (event_type, brief_id, customer_id, order_id, actor)
    VALUES ('form_submitted', $brief_id, $customer_id, $order_id, 'customer');
COMMIT;
```

Then (outside the transaction):
1. Fire auto-ack email synchronously via Resend (await; do NOT block on failure — log `email_failed` and continue).
2. Insert into `ai_analysis_jobs` (status='queued', brief_id, trigger_type='initial'). Worker will pick it up.
3. Return `{ brief_id, order_id }`.

Auto-ack template variables: `first_name` (from `owner_name` first token), `tier_name`, `video_count`, `carousel_count`, `delivery_window`, `wat_timestamp`, `founder_whatsapp_link`, `founder_name`, `brand_name`. Pull from `apps/web/src/lib/pricing-and-packages.ts` (will need to be created if not present — check first).

Failure modes:
- Brief not found / belongs to a different customer → 404 / 403.
- form_payload missing required keys → 400 with diff of missing keys.
- Terms consent hash mismatch → 400 `terms_consent_mismatch`.
- DB transaction fails → return 500; client retries (idempotent on re-submit because `submitted_at` check).
- Auto-ack email fail → still 200; success page sets expectations.
- AI analysis job insert fails → return 500. The transaction succeeded but the analysis won't fire automatically; founder will see the row in CRM with no analysis and can click Re-analyze. (We could roll back the transaction here but that's worse — the customer's submission would be lost.)

## Tier price lookup

Need a single canonical mapping `tier → amount_ngn` available to both the email template and the submit endpoint.

**Proposed:** `apps/agent/src/lib/tiers.ts` (new):
```ts
export const TIER_PRICES_NGN = {
  starter: 150_000,
  standard: 275_000,
  calendar: 525_000,
} as const;

export const TIER_DELIVERABLES = {
  starter: { videos: 7, carousels: 3, delivery_window: '24 hours' },
  standard: { videos: 14, carousels: 7, delivery_window: '36 hours' },
  calendar: { videos: 30, carousels: 14, delivery_window: '48 hours' },
} as const;
```

The web bundle can re-export from this (NOT vice versa — agent is the source of truth, web is a consumer for display).

## Tests

Vitest unit tests beside each route:
- `form-payload-schema.test.ts` — every step schema validates / rejects expected payloads. Verbatim test for `customer_backstory_verbatim`: roundtrip a string with newlines, smart quotes, emojis → exact byte equality.
- `save/route.test.ts` — first save (no brief_id), subsequent saves, idempotency, mismatch 403.
- `submit/route.test.ts` — happy path with mocked Supabase + Resend, idempotent re-submit returns existing IDs, missing-fields 400, transaction rollback case.

Integration tests (SMOKE=1 only) deferred — those run against staging DB, will be added when 6.8 wires up.

## Acceptance (verbatim from master §5.6.1)

1. `curl POST /v1/brief/save` step=1 with `{ tier_intent: 'starter' }` → 200 + `{ brief_id, customer_id }`. New `briefs` row + stub `customers` row.
2. Repeat step=1 with the returned `brief_id` → 200, no new rows (idempotent).
3. `curl POST /v1/brief/save` step=3 with full step-3 fields → `briefs.save_token` is set; save-token email fires within 60s (Resend dashboard confirms delivery).
4. `curl POST /v1/brief/submit` with full payload → 200 + `{ brief_id, order_id }`. `orders.status='pending_founder_review'`. Auto-ack email lands. Worker picks up the analysis job; `analysis_runs` row appears within 180s.
5. Re-submitting the same `brief_id` → returns the existing IDs, does NOT double-write to `orders`.

## Build order

C1 (schema) → C2 (auto-ack template) → C3 (email lib extension) → C4 (save endpoint) → C5 (submit endpoint).

Each commit is independently green: typecheck + tests pass before the next starts. Push at the end (single PR-equivalent push of 5 commits).

## Smoke results — 2026-05-07

**Status:** ✅ ALL ACCEPTANCE CRITERIA PASS.

Commits shipped:
- `add1275` C1 form-payload schema
- `affcff8` C2 tier metadata + email templates
- `b49d2b8` C3 email.ts extended template keys
- `a0177e7` C4 /v1/brief/save
- `0ff7d25` C5 /v1/brief/submit
- `c923c41` hotfix: missing ai_analysis_jobs.idempotency_key (caught by smoke)
- `<this-commit>` hardening: niche_slug enum on Step2Schema + plan updates

Live smoke against `https://api.operscale.cloud/v1/brief/{save,submit}`:
1. Step 1 first save → 200 + `{brief_id, customer_id}`. ✅
2. Step 1 re-save with same IDs → 200, idempotent (no new rows). ✅
3. Steps 2/3/4/6 → 200; payload merged; activity_log shows form_step_completed for each. ✅
4. Step 3 → `briefs.save_token` set, save-token email delivered (`save_token_sent` activity). ✅
5. Submit → 200 + order_id; `orders.status='pending_founder_review'`, `tier='starter'`, `amount_ngn=150000`. Auto-ack email delivered. AI analysis job inserted with valid idempotency_key. ✅
6. Re-submit → 200 with `already_submitted: true`, no double-write. ✅
7. Worker picked up job within seconds → `ai_analysis_started` then `completed` ~40s later. `analysis_runs` row written with `run_index=1, is_current=true, ai_output` 12,540 chars. ✅
8. `activity_log` for the test brief shows the full chain with no `*_failed` events. ✅

Bugs caught and fixed mid-smoke:
- `ai_analysis_jobs.idempotency_key` is NOT NULL — fixed by importing
  `computeIdempotencyKey` from existing helper (`c923c41`).
- `niche_slug` was string-only in the schema, allowing customers to send
  the niche brief filename (`fashion-ecom`) instead of the canonical slug
  (`fashion`) — caught by worker, fixed by tightening to enum.

Sub-phase 6.1 complete. Next: 6.2 (`/v1/brief/upload-photo`).
