# AGENT.md

The Operscale Content Calendar Phase 1 state machine. This document specifies every state in the customer journey, the contracts between states, the writes that happen, the side-effects that fire, and the logs that prove it worked. Use the DOE framework: Directive (what should happen), Observation (what we watch for), Experiment (the test that proves it works).

This document is the single source of truth for the state machine. If `docs/specs/*` disagrees with this, that spec is wrong — fix it.

## How to use this document

When implementing or debugging a state transition, find the state in question, read its directive, then read its observations to understand what telemetry exists, then run the listed experiment. If the experiment fails, the state machine is broken — do not work around it.

When adding a new state or modifying one, preserve the DOE structure. New states get a new section. Modifications get a changelog entry at the bottom of this file.

## The state machine at a glance

Phase 1 has nine canonical states. Each state corresponds to a row in `orders.status` (with one or two upstream states living in `briefs` because no order exists yet).

```
[ARRIVED]
    -> [VIEWED_PRICING]
        -> [STARTED_FORM]
            -> [FORM_STEP_3]   <- save token issued, recovery enabled
                -> [PHOTO_UPLOADED] (optional)
                    -> [SUBMITTED]
                        -> [AUTO_ACK_SENT]
                        -> [AI_ANALYSIS_RUNNING]
                            -> [PENDING_FOUNDER_REVIEW]
                                -> [FOUNDER_APPROVED]
                                    -> [BRIEF_EMAIL_SENT]
                                        -> [PAYMENT_INITIATED]
                                            -> [PAID]
                                                -> [HANDED_TO_PHASE_2]
```

Two terminal failure paths:

- `DISCARDED` — founder soft-rejected a brief in CRM. Customer is not emailed beyond the auto-ack.
- `REFUNDED` — payment refunded post-paid. Order closed.

## State 1: SUBMITTED (the entry point of the server-side flow)

Everything before this state is browser-only — `ARRIVED`, `VIEWED_PRICING`, `STARTED_FORM`, `FORM_STEP_3`, `PHOTO_UPLOADED` are all reflected in `customer_state` for telemetry, but no canonical state machine action runs until SUBMITTED. We document those upstream events in `docs/customer-journey.md`. This document starts where the server takes over.

### Directive

When a customer clicks "Submit" on form step 7, the server must:

1. Create or update a `customers` row keyed by `email`.
2. Insert a `briefs` row with the full form payload, the customer_id, and `submitted_at = now()`.
3. Insert one row per uploaded photo into `brief_photos` (already done at upload time, but re-link to brief_id if upload happened before brief existed).
4. Insert a `brief_consent` row if photos were uploaded.
5. Insert an `orders` row with `status = 'submitted'`, tier captured from the form, amount in NGN and kobo.
6. Fire two parallel side-effects:
   a. Send the auto-acknowledgement email (must be in customer's inbox within 30 seconds).
   b. Trigger the AI brief analysis (async; will land in CRM).
7. Return to the browser a 200 with `{ status: 'submitted', order_id: '...' }`.
8. Browser navigates to a confirmation page.

### Observation

- `orders.status = 'submitted'` for the new row.
- `activity_log` has events `form_submitted`, `auto_ack_sent`, `ai_analysis_started` for this order.
- The customer's inbox shows the auto-ack email.
- The CRM "Inbox" view shows the new order within 5 seconds (Realtime).

### Experiment

```
1. Open /brief in a fresh browser session.
2. Fill all 7 steps (use a real email you control).
3. Optionally upload 2 photos at step 5.
4. Submit at step 7.
5. Verify the success page renders with: tier name, video count, expected timeline.
6. Verify the inbox receives an email titled "Got your Operscale brief..." within 60 seconds.
7. Open the CRM admin /admin/inbox and verify the new order appears within 5 seconds.
8. Query: SELECT * FROM activity_log WHERE order_id = '...' ORDER BY created_at;
   Should show: form_submitted, auto_ack_sent, ai_analysis_started.
```

If any step fails, do not proceed to State 2 work. The submission is the foundation.

### Failure modes

- **Auto-ack email send fails (Resend API down)**: log `auto_ack_failed`, retry queue (5 attempts, exponential backoff). Customer still proceeds — the email is best-effort, not the canonical confirmation. The success page does not depend on email delivery. If retries fail after 5 attempts, founder is alerted via WhatsApp.
- **Photo re-link fails (orphaned brief_photos)**: orphans get cleaned by the daily retention sweep (30-day TTL on photos with no brief_id). Log `photo_orphan_detected`.
- **Order insert fails after brief insert**: the brief is left without an order. CRM does not surface briefs without orders, so this becomes invisible. Mitigation: wrap `briefs + orders` insert in a single transaction. Document: this is non-negotiable.
- **Customer hits Submit twice**: idempotency via `briefs.save_token` UNIQUE constraint. Second submit sees the existing brief, returns 200 with the existing order_id, does not double-send the auto-ack.

## State 2: AI_ANALYSIS_RUNNING

### Directive

Asynchronously after SUBMITTED, the agent service:

1. Reads the brief payload from Postgres.
2. Loads the relevant niche brief markdown from `niche-briefs/<niche>.md`.
3. If photos were uploaded, downloads them from Supabase Storage and base64-encodes for vision blocks.
4. Constructs the brief analysis prompt (see `docs/specs/ai-brief-analysis.md`).
5. Calls Claude Opus 4.7 with vision.
6. Validates the JSON response against the schema in the spec.
7. On success: writes a row to `analysis_runs` with `run_index = 1`, `is_current = true`, `trigger_type = 'initial'`, full output in `ai_output` JSON, token counts and cost.
8. Updates the order: `status = 'pending_founder_review'`.
9. Logs `ai_analysis_completed` to `activity_log`.

### Observation

- `analysis_runs` has a row with `brief_id = X, run_index = 1, is_current = true`.
- `orders.status = 'pending_founder_review'`.
- CRM "Pending Review" queue shows the order within 5 seconds (Realtime).
- The order detail page renders the AI output in the middle column.

### Experiment

```
1. Submit a test brief from State 1's experiment.
2. Watch the Supabase logs for the analysis_runs INSERT (typically 60-120 seconds after submit).
3. Open /admin/pending-review.
4. The order should appear with a green "submitted just now" badge.
5. Click into the order. Verify:
   - Left column: form responses fully rendered.
   - Middle column: AI output structured into Brief summary, 3 angles, Sample script seed,
     Brand voice, Photo aesthetic (only if photos uploaded), Visual style, Upsell rec, Flags.
   - Right column: three buttons — Approve and send / Re-analyze with note / Discard.
6. Query: SELECT * FROM analysis_runs WHERE brief_id = '...' AND is_current = true;
   Should return exactly 1 row with run_index = 1.
```

### Failure modes

- **Claude API call fails (5xx, timeout, rate limit)**: retry with exponential backoff (1s, 2s, 4s, 8s, 16s — 5 attempts). After 5, status becomes `ai_analysis_failed`, founder gets WhatsApp alert. Brief stays in this state until founder manually retries.
- **Claude returns malformed JSON**: retry once with stricter prompt addendum ("Respond with valid JSON only, no prose"). Second failure → fallback to a generic-template analysis_run + flag in CRM. Founder is alerted.
- **Photo download fails (Storage 5xx)**: retry 3 times. If still failing, run analysis without photos, flag in CRM. Founder can re-upload or re-run if needed.
- **Photo vision block parsing fails (corrupt image)**: drop the offending photo, run with remaining photos or text-only.
- **JSON output exceeds expected size budget (>4000 tokens output)**: log warning. Common cause: Claude got stuck in a loop. Truncate at JSON boundary, accept partial output, founder review will catch issues.

## State 3: PENDING_FOUNDER_REVIEW

### Directive

Order sits in CRM Pending Review queue. Founder opens the order, reviews, takes one of three actions:

#### Action A: Inline edit then approve

1. Founder clicks any text field in the AI output (middle column).
2. Field becomes editable. Founder edits, clicks elsewhere or presses Tab.
3. On blur, the edit is persisted: an `analysis_edits` row is written with `field_path`, `value_before`, `value_after`, `edited_by` (founder email), `edited_at`.
4. The displayed AI output reflects the edit immediately.
5. Multiple edits accumulate as separate `analysis_edits` rows.
6. Founder clicks "Approve and send".
7. The current edited state is locked: a snapshot is written to `orders.approved_analysis_run_id` (pointing at the current `analysis_runs.id`) plus the diff applied via edits is materialised into the snapshot.
8. The brief email send is triggered (see State 4).

#### Action B: Re-analyze with note

1. Founder clicks "Re-analyze with note".
2. Modal opens with a textarea (min 10 chars).
3. Founder writes a note: "focus more on educational angle, customer mentioned launching in 2 weeks".
4. Founder clicks "Run re-analysis".
5. The current `analysis_runs` row is set `is_current = false`.
6. A new Claude call runs with the original form + photos + the founder note.
7. New output is written to `analysis_runs` with `run_index = previous + 1`, `is_current = true`, `trigger_type = 're_analyze_with_note'`, `founder_note` populated.
8. The middle column refreshes to show the new analysis.
9. Founder reviews again — can edit, re-analyze again, or approve.

#### Action C: Discard

1. Founder clicks "Discard".
2. Confirmation modal: "This brief will be discarded. The customer's auto-ack already sent, but no further emails will be sent. Are you sure?"
3. On confirm, `orders.status = 'discarded'`. Customer never receives the personalised brief.
4. Used for spam, fake submissions, or genuinely off-fit customers (e.g., niche we explicitly do not serve).

### Observation

- For Action A: `analysis_edits` rows accumulate. `orders.status = 'pending_founder_review'` until approve. After approve: `orders.status = 'founder_approved'`, `orders.founder_approved_at` set, `orders.approved_analysis_run_id` populated.
- For Action B: `analysis_runs` rows accumulate, exactly one with `is_current = true`. Activity log shows `founder_reanalyze_requested` events.
- For Action C: `orders.status = 'discarded'`.

### Experiment

```
For Action A (inline edit + approve):
1. Open a pending review order.
2. Click into the brief_summary text. Edit it. Click elsewhere.
3. Verify in DB: SELECT * FROM analysis_edits WHERE analysis_run_id = '...' ORDER BY edited_at;
4. Click "Approve and send".
5. Verify: orders.status = 'founder_approved' (briefly, then 'brief_sent' after email fires).
6. Verify the customer receives the brief email within 60 seconds.

For Action B (re-analyze):
1. Open a pending review order.
2. Click "Re-analyze with note", write a 20-char note, run.
3. Watch the modal close after ~60-120 seconds.
4. Verify: SELECT run_index, is_current FROM analysis_runs WHERE brief_id = '...';
   Should show run 1 (is_current = false), run 2 (is_current = true).
5. Verify the middle column shows the new output.

For Action C (discard):
1. Open a pending review order.
2. Click "Discard", confirm.
3. Verify: orders.status = 'discarded'.
4. Verify the customer does NOT receive any further emails.
```

### Failure modes

- **Founder is offline / never reviews**: order sits indefinitely. Mitigation: time-since-submission badges (green ≤30min, yellow ≤2h, red >2h). At 2h unreviewed during business hours, founder gets a WhatsApp alert. We do not auto-approve.
- **Founder closes browser mid-edit**: edits already persisted via blur events. No data loss.
- **Two reviewers act simultaneously**: highly unlikely in Phase 1 (single founder), but the schema supports it. If two reviewers approve simultaneously, the second approve is a no-op (the order is already in `founder_approved` state).
- **Re-analyze fails**: same retry/fallback as State 2. The previous `is_current` analysis is restored (set is_current back to true on the prior row).

## State 4: FOUNDER_APPROVED → BRIEF_EMAIL_SENT

### Directive

When founder clicks "Approve and send":

1. Take the current `analysis_runs.ai_output` plus all `analysis_edits` applied. Materialise as a single approved snapshot.
2. Update `orders.status = 'founder_approved'`, set `orders.approved_analysis_run_id`, `orders.founder_approved_at`, `orders.founder_approved_by`.
3. Render the brief email template using the snapshot as data.
4. Send via Resend.
5. On send success: update `orders.status = 'brief_sent'`, `orders.brief_email_sent_at = now()`.
6. Log `brief_email_sent` to activity_log with the Resend message ID.
7. The 6h drop-off recovery cron will pick up from this timestamp.

### Observation

- `orders.status = 'brief_sent'` (transitions through `founder_approved` briefly).
- `orders.brief_email_sent_at` is set.
- Customer receives the email.
- Activity log shows `brief_email_sent` with Resend message ID.

### Experiment

```
1. Approve a test brief.
2. Verify the customer's inbox receives the email within 60 seconds.
3. Verify the email contains: brief_summary, 3 angles, sample script seed, visual style block,
   pricing recap, optional upsell block (if recommended), Pay Now CTA with Paystack URL.
4. Click the Pay Now link. Verify it opens the Paystack hosted checkout in NGN.
5. Verify orders.status = 'brief_sent'.
```

### Failure modes

- **Resend send fails**: retry 5 times exponential. After 5, `brief_email_failed`, founder alert. Founder can manually retry from CRM action button.
- **Email rendered with missing data (e.g., visual_style block not populated by AI)**: fall back gracefully — render the section with a placeholder. Should never happen because schema validation catches missing fields earlier.
- **Customer email bounces**: Resend webhook (inbound) writes to activity_log as `email_bounced`. CRM surfaces this prominently. Founder reaches out via WhatsApp.

## State 5: PAYMENT_INITIATED

### Directive

Customer clicks Pay Now in the brief email or comes back later. Browser hits Paystack-hosted checkout. When the customer initiates payment (clicks Pay on the checkout):

1. Paystack fires a `charge.pending` or similar event (depending on payment method).
2. We log `payment_initiated` to activity_log with the Paystack reference.
3. Update `orders.status = 'payment_initiated'`.

This state is brief — typically minutes. If the customer abandons, we use this state as the trigger for the +2h WhatsApp recovery message.

### Observation

- `orders.status = 'payment_initiated'`.
- Activity log entry for `payment_initiated`.
- Paystack dashboard shows a pending transaction with our reference.

### Experiment

```
1. Trigger a test brief through to brief_sent.
2. As customer, click Pay Now. Don't complete — just open the page.
3. Verify orders.status = 'payment_initiated' within 30 seconds.
4. Wait 2 hours. Verify a WhatsApp recovery message is sent.
```

### Failure modes

- **No `charge.pending` event from Paystack**: Paystack doesn't always fire this for all payment methods (bank transfer in particular). We can't reliably detect "initiated but not completed" for all flows. The +2h recovery message is best-effort.

## State 6: PAID

### Directive

When Paystack `charge.success` webhook fires:

1. Verify HMAC-SHA512 signature on raw body before any JSON parsing. (See `docs/specs/paystack-integration.md`.)
2. Reject (401) if signature invalid.
3. Idempotency check: lookup `payments` by `paystack_tx_ref`. If exists, return 200 (no-op). This handles webhook duplicates.
4. Insert a `payments` row with status = paid, payment_method, webhook_payload.
5. Update `orders.status = 'paid'`, `orders.paid_at = now()`.
6. Fire two side-effects:
   a. Payment confirmation email via Resend.
   b. WhatsApp confirmation via Evolution API.
7. Log `payment_succeeded`, `payment_confirmation_email_sent`, `whatsapp_sent` to activity_log.
8. Trigger Phase 2 handoff (in Phase 1, this is just a `production_ready_at` timestamp; Phase 2 will pick up from there).
9. Return 200 to Paystack within 3 seconds.

### Observation

- `payments` row exists with paystack_tx_ref unique-constrained.
- `orders.status = 'paid'`, `orders.paid_at` set.
- Customer's inbox receives confirmation email.
- Customer's WhatsApp receives confirmation message within 90 seconds.
- Activity log shows full sequence.

### Experiment

```
1. Take a brief through to PAYMENT_INITIATED.
2. Complete payment in Paystack test mode (use Paystack test cards).
3. Watch the webhook fire (visible in Paystack dashboard or local ngrok if testing).
4. Verify:
   - SELECT * FROM payments WHERE paystack_tx_ref = '...';  (1 row, status = paid)
   - SELECT status, paid_at FROM orders WHERE id = '...';   (status = 'paid', paid_at set)
   - Customer inbox: confirmation email arrived
   - Customer WhatsApp: confirmation message arrived
5. Query: SELECT event_type, created_at FROM activity_log WHERE order_id = '...' ORDER BY created_at;
   Should show: payment_succeeded, payment_confirmation_email_sent, whatsapp_sent
6. Verify webhook was idempotent: replay the webhook (Paystack supports redelivery).
   The replay should return 200 with no new rows in payments.
```

### Failure modes

- **Webhook signature invalid**: 401 returned. Log `webhook_signature_failed` with the raw signature header for debugging. Founder alert.
- **Webhook delivered twice (Paystack duplicates)**: idempotency on `paystack_tx_ref` UNIQUE makes the second a no-op. Verified.
- **Webhook delivered out of order (rare)**: e.g., refund webhook before paid webhook. Handler checks order status; if order is already in a later state, log and skip.
- **WhatsApp send fails**: retry 3 times. After 3, log `whatsapp_failed`, founder alert. Email confirmation is the canonical confirmation; WhatsApp is best-effort.
- **Customer pays twice (split payments)**: each payment gets its own `payments` row. We treat the second as a duplicate and refund it within 24 hours. Manual refund via Paystack dashboard.

## State 7: HANDED_TO_PHASE_2 (terminal for Phase 1)

### Directive

When `orders.status = 'paid'`, Phase 1 is done. We mark the order as ready for Phase 2 production:

1. Set `orders.production_ready_at = now()`.
2. Log `phase_2_handoff` to activity_log.
3. (Phase 2 will read `orders WHERE production_ready_at IS NOT NULL AND production_started_at IS NULL` to pick up work.)

In Phase 1 there is no actual production. The CRM's "Paid" view is where these orders sit waiting for Phase 2 to come online.

### Observation

- `orders.production_ready_at` is set.
- CRM "Paid" view shows the order.

### Experiment

```
1. Complete a payment.
2. Verify SELECT production_ready_at FROM orders WHERE id = '...' returns a non-null timestamp.
3. Verify the CRM "Paid" view shows the order.
```

### Failure modes

None at this layer. Phase 2 will fail to pick up work if its own scheduler is broken, but that's a Phase 2 concern.

## Edge case: REFUNDED

### Directive

When founder issues a refund (manually via Paystack dashboard, then comes back to CRM and clicks "Mark as refunded"):

1. Update the relevant `payments` row: `status = 'refunded'`, `refunded_at`, `refund_reason`.
2. Update `orders.status = 'refunded'`.
3. Log `payment_refunded` to activity_log with the refund_reason.
4. (Phase 1 has no automated customer-facing email on refund. Founder communicates via email/WhatsApp manually. Phase 2 may automate this.)

### Observation

- `payments.status = 'refunded'`.
- `orders.status = 'refunded'`.

### Experiment

```
1. Take an order through to PAID.
2. In Paystack dashboard, issue a refund.
3. In CRM, click "Mark as refunded" on that order, fill in refund_reason.
4. Verify orders.status = 'refunded'.
5. Verify payments.status = 'refunded'.
6. Verify activity log entry for payment_refunded.
```

### Failure modes

- **Founder forgets to mark in CRM after Paystack refund**: the CRM and the actual money state are out of sync. Mitigation: weekly reconciliation script that pulls Paystack's refund list and flags any not yet marked in CRM.

## Edge case: DISCARDED

Already covered in State 3 Action C. Adds:

- **What if customer follows up after discard?** Founder responds manually. The auto-ack already went out, so the customer isn't ghosted. If the customer was discarded in error, founder can manually re-trigger the brief email by changing the order status back to `pending_founder_review` and re-running the approval flow.

## Cross-cutting concerns

### Idempotency

Every external-facing endpoint (form submit, webhook handlers, photo upload) is idempotent. Idempotency keys:

- Form submit: `briefs.save_token` UNIQUE constraint.
- Photo upload: `(brief_id, photo_index)` UNIQUE constraint.
- Paystack webhook: `payments.paystack_tx_ref` UNIQUE constraint.
- Email send: Resend message ID logged to activity_log; we don't re-send the same email type within 1 hour for the same order.
- WhatsApp send: similar pattern with Evolution API message IDs.

### Activity log writes are non-negotiable

Every state transition writes to `activity_log` BEFORE side-effecting. If the side-effect fails, we still know the transition was attempted. This is the gotcha #11 — scene-by-scene writes, not bulk.

### Realtime subscriptions

The CRM subscribes to Realtime on `orders`, `analysis_runs`, `analysis_edits`, `payments`, `activity_log`. These tables have `REPLICA IDENTITY FULL` set in their migrations.

### Photo lifecycle

Photos have their own state machine documented in `docs/specs/photo-upload-and-retention.md`. The relevant intersection with this state machine: photo uploads happen at form step 5 (before SUBMITTED), the photos are linked to a brief at SUBMITTED, and they're available to the AI analysis service at AI_ANALYSIS_RUNNING.

### NDPC-driven retention

Photos auto-delete 90 days after `orders.delivered_at` (a Phase 2 column, but the schema is already prepared) or 30 days after upload if no order materialises. Daily cron sweeps. Customer can request earlier deletion via email — handled manually in Phase 1.

## Telemetry and observability

For each state, we measure:

| Metric | Target |
| --- | --- |
| Time from STARTED_FORM to SUBMITTED | p50 ≤ 7 minutes |
| Time from SUBMITTED to AUTO_ACK_SENT | p95 ≤ 30 seconds |
| Time from SUBMITTED to PENDING_FOUNDER_REVIEW | p95 ≤ 180 seconds |
| Time in PENDING_FOUNDER_REVIEW (median) | ≤ 5 minutes |
| Time from FOUNDER_APPROVED to BRIEF_EMAIL_SENT | p95 ≤ 30 seconds |
| Time from PAYMENT_INITIATED to PAID | not measured (customer-controlled) |
| Time from PAID to WhatsApp delivered | p95 ≤ 90 seconds |

These are Phase 1 KPIs and they live in `docs/customer-journey.md` as well. If you build new observability dashboards, source from `activity_log`.

## Changelog

- **v1.0 (3 May 2026)**: initial spec, 9-state machine, Phase 1 v2 schema.

## Where to look next

- For the Claude prompt that drives State 2: `docs/specs/ai-brief-analysis.md`.
- For the CRM UI that drives State 3: `docs/specs/founder-review-flow.md`.
- For the email templates: `docs/specs/email-templates.md`.
- For the Paystack webhook: `docs/specs/paystack-integration.md`.
- For the database schema referenced throughout: `docs/data-model.md`.
- For the photo lifecycle: `docs/specs/photo-upload-and-retention.md`.
