# Spec: founder review-and-approve flow

The founder review flow is the single most operationally important surface in Phase 1. Every personalised brief email passes through it. Every quality issue with AI output is caught here. Every privacy concern (photo flag, restricted niche) is decided here. This document is the contract for what the CRM does at this step.

If you're building or modifying any code under `apps/web/src/app/admin/orders/[id]/` or `apps/agent/src/api/v1/brief/{approve,reanalyze,edit-field,discard}/`, read this whole document first.

## What this flow is

When the AI brief analysis lands in `pending_founder_review` state, the founder opens the order in the CRM, reviews the AI output, and takes one of three actions:

1. **Approve and send.** The current AI output (with any inline edits applied) becomes the source for the customer's brief email. The email fires immediately.
2. **Re-analyze with note.** The founder writes a note describing what's wrong with the current analysis. Claude re-runs with the original form + photos + the note. New output replaces the previous one for review.
3. **Discard.** The brief is marked discarded; no further customer-facing email goes out. Used for spam, fake submissions, or genuinely bad-fit briefs (e.g., a niche we don't serve).

## Why review at all

Two reasons:

1. **Quality control during the early period.** First 50+ orders are when the AI prompt is still being calibrated. Sending unreviewed output to customers risks brand damage from off-brand suggestions, hallucinated details, awkward phrasing.
2. **Customer trust signal.** "Reviewed by our team before sending" is a meaningful differentiator from generic AI tools. It's why we charge 5-7× what a fully-automated competitor would.

The flow is built so a non-founder reviewer (a future hire) can take over without retraining. We're the founder doing it now; the workflow itself is generic.

## The CRM views relevant here

| View | URL | Filter |
| --- | --- | --- |
| Pending review | `/admin/pending-review` | `orders.status = 'pending_founder_review'`, sorted by submission time |
| Order detail (review mode) | `/admin/orders/[id]` | When the order's status is `pending_founder_review` |
| Order detail (timeline mode) | `/admin/orders/[id]` | When the order's status is past `pending_founder_review` |

The Order Detail page auto-switches between Review mode and Timeline mode based on the current status.

## Pending Review queue

### List view

Sorted by submission time, oldest first. Each row shows:

- Customer name (or "Unknown — no name in form" if missing)
- Business name
- Tier (Starter / Standard / Calendar)
- Niche
- Submission time (relative: "5 minutes ago", "2 hours ago")
- **Time-since-submission badge:** green if ≤ 30 minutes, yellow if ≤ 2 hours, red if > 2 hours
- Photo presence indicator (small camera icon if photos uploaded)
- Restricted-niche flag (if AI raised one)

Click any row → Order Detail in Review mode.

### Real-time updates

The list subscribes to Supabase Realtime on the `orders` and `analysis_runs` tables. New pending-review orders appear without page refresh. Orders that get approved or discarded disappear from the list within ~1 second.

### Founder alert: 2-hour rule

If any brief sits in `pending_founder_review` for > 2 hours during business hours (07:00-21:00 WAT), founder gets a WhatsApp alert. Logic:

- A cron job (every 30 minutes) queries for orders in `pending_founder_review` with `submitted_at` more than 2 hours old AND no alert already sent for this order.
- For each matching order: send WhatsApp via Evolution API, log `founder_alert_sent` to activity_log.
- Cron only fires within business hours (avoids waking founder at 3 AM).

## Order Detail — Review mode

Three-column layout. Designed for iPad landscape (the founder's primary review device); responsive degrades to single-column stack on phone.

### Left column — Form responses

Read-only summary of everything the customer submitted. Sections:

- **Business info:** name, niche, website, description, customer name, WhatsApp, email
- **Direction & goals:** angles selected, goal, topics, things to avoid, posting platforms
- **Brand voice:** tone, 3 reference posts (each rendered with a "view" link if it's a URL, or shown inline if it's pasted text), brand colors, logo (thumbnail with click-to-zoom)
- **Photos:** up to 3 thumbnails. Click any to open the lightbox at full size (signed URL, 5-min expiry). Photo quality flags shown alongside.
- **Visual character lock:** on-camera choice, setting/vibe
- **Niche-specific follow-ups:** the answers to whichever niche-specific questions appeared
- **Source attribution:** how they heard about us
- **Submission metadata:** save_token (for debugging), submission timestamp, IP-derived city if available

### Middle column — AI output (editable)

Each field is click-to-edit. No separate edit mode. Edits save on blur. Each edit creates a row in `analysis_edits`.

Sections rendered (in this order):

- **Brief summary** (the 2-3 sentence interpretation Claude wrote)
- **3 angles** (each with angle name, hook, why_it_fits — all editable)
- **Sample script seed** (video_1_topic, video_1_hook, 3-5 outline bullets — all editable)
- **Brand voice** (tone summary, vocabulary pattern, sentence rhythm, emotional register, do_say list, do_not_say list — all editable)
- **Photo aesthetic** (only if photos uploaded; same editable pattern)
- **Visual style** (palette as 3-5 hex chips with color picker, typography, camera, captions — all editable)
- **Upsell recommendation** (should_upsell toggle, recommended_tier dropdown, reasoning, price_delta — all editable)
- **Flags** (read-only list of any flags Claude raised)
- **Quality score** (Claude's self-rated 0-1, read-only, color-coded: green > 0.7, yellow 0.5-0.7, red < 0.5)

### Right column — Action panel

Three buttons, sticky to the side as the founder scrolls:

- **Approve and send** — primary CTA, blue button. See "Approve action" below.
- **Re-analyze with note** — secondary button. Opens a modal. See "Re-analyze action" below.
- **Discard** — destructive action, red text, requires confirmation. See "Discard action" below.

Below the buttons, a small status block shows:

- "Last edited: 30s ago" (if any inline edits happened)
- Number of analysis runs so far (e.g., "Run 2 of N — re-analyzed 5 mins ago")
- Total time in pending_review state

## Inline edit mechanics

### How it works

1. Founder clicks any text field in the middle column. The field switches to a textarea (or input for short fields).
2. Founder edits. The edit isn't saved yet.
3. Founder blurs the field (clicks elsewhere, presses Tab, or hits Enter for single-line fields).
4. On blur, a POST to `/v1/brief/edit-field` fires:

```json
{
  "analysis_run_id": "uuid",
  "field_path": "recommended_angles[0].hook",
  "value_before": "the previous value",
  "value_after": "the new value"
}
```

5. Server inserts a row into `analysis_edits`.
6. Server updates `analysis_runs.ai_output` by applying the edit at the field path (using a deep-set helper).
7. Server returns 200. Frontend updates the displayed value to confirm.

### Field paths

We use a JSON pointer-style path:

- `brief_summary` — top-level string
- `recommended_angles[0].angle` — array index + nested key
- `recommended_angles[0].hook` — array index + nested key
- `brand_voice.do_say[2]` — array index in a sub-object
- `visual_style.recommended_palette` — array as a whole (replace entire array)

The server uses lodash `_.set` (or equivalent) to apply edits.

### Conflict handling

Phase 1 has one founder; multiple-reviewer conflicts are unlikely. Schema supports it though:

- If two reviewers edit the same field within a few seconds, last-write wins.
- The `analysis_edits` table preserves both edits chronologically; the displayed `analysis_runs.ai_output` reflects the latest.

### Audit trail

Every edit is permanent. We never delete `analysis_edits` rows. If the founder makes 20 edits to a brief, the table has 20 rows.

### Field types and validators

| Field | Type | Validator |
| --- | --- | --- |
| brief_summary | textarea | min 50 chars, max 500 |
| recommended_angles[N].angle | input | min 5 chars, max 80 |
| recommended_angles[N].hook | textarea | min 10 chars, max 200 |
| recommended_angles[N].why_it_fits | textarea | min 20 chars, max 300 |
| sample_script_seed.video_1_topic | input | min 5 chars, max 100 |
| sample_script_seed.video_1_hook | textarea | min 10 chars, max 200 |
| sample_script_seed.video_1_outline[N] | input | min 5 chars, max 200 |
| brand_voice.* (text fields) | textarea | min 5 chars, max 500 |
| brand_voice.do_say[N] | input | min 3 chars, max 100 |
| brand_voice.do_not_say[N] | input | min 3 chars, max 100 |
| photo_aesthetic.* (text fields) | textarea | min 5 chars, max 500 |
| visual_style.recommended_palette | array of hex codes | each must match `^#[0-9A-Fa-f]{6}$`, 3-5 items |
| visual_style.* (other text fields) | textarea | min 5 chars, max 500 |
| upsell_recommendation.should_upsell | toggle | boolean |
| upsell_recommendation.recommended_tier | dropdown | starter / standard / calendar / null |
| upsell_recommendation.reasoning | textarea | min 20 chars if should_upsell, else any |
| upsell_recommendation.upsell_price_delta | number input | 0 or positive integer (NGN) |

Client-side validation on blur. Server-side re-validation on POST (defence in depth).

## Re-analyze action

When founder clicks "Re-analyze with note":

1. Modal opens with a textarea labelled: "What needs to change in the analysis? Be specific."
2. Min 10 chars enforced. Submit button disabled until met.
3. Submit hits `/v1/brief/reanalyze`:

```json
{
  "brief_id": "uuid",
  "founder_note": "focus more on the educational angle, customer mentioned launching in 2 weeks so add urgency"
}
```

4. Server:
   - Sets current `analysis_runs.is_current = false`
   - Re-calls Claude with original form + photos + note (see `docs/specs/ai-brief-analysis.md`)
   - Inserts new `analysis_runs` row with `run_index = previous + 1`, `is_current = true`, `trigger_type = 're_analyze_with_note'`, `founder_note = '...'`
   - Returns 200 with the new run_id when ready (60-120s)

5. Modal shows a progress indicator. On completion, modal closes and the middle column refreshes with the new analysis. Inline edits from before the re-run are NOT preserved (because the underlying analysis is new) — this is intentional. The founder is starting fresh from the new output.

### Cost considerations

Each re-analysis costs ~$0.12 (same as initial analysis). We log `cost_usd` to the `analysis_runs` and `llm_calls` tables. If a single brief accumulates > $1.00 of analysis cost (8+ runs), we surface a warning in the CRM ("This brief has been re-analyzed N times for total cost $X — consider whether the form data is sufficient or whether to discard").

### Multiple re-analyses

There's no hard cap on the number of re-runs. Soft signals:

- 3+ re-runs: yellow warning ("you've re-analyzed this 3 times — would inline edits be faster?")
- 5+ re-runs: red warning ("this brief may be unanalysable — consider discard or manual outreach")

These warnings don't block. They just nudge.

## Approve action

When founder clicks "Approve and send":

1. Confirmation modal: "Send this brief to [Customer Email]? You'll be able to see the email in the timeline after."
2. Confirmation: Cancel / Send.
3. On confirm, hit `/v1/brief/approve`:

```json
{
  "order_id": "uuid"
}
```

4. Server:
   - Materialises the current `analysis_runs.ai_output` + all `analysis_edits` (in chronological order) into a final snapshot
   - Updates the order: `approved_analysis_run_id = current run id`, `founder_approved_at = now()`, `founder_approved_by = founder email`, `status = 'founder_approved'`
   - Renders the brief email template using the snapshot (see `docs/specs/email-templates.md`)
   - Sends via Resend
   - On send success: updates order `status = 'brief_sent'`, `brief_email_sent_at = now()`
   - Logs `founder_approved`, `brief_email_sent` to activity_log

5. Frontend redirects to the timeline view of the order. Approval is irreversible from the UI (you'd need to manually re-trigger via SQL if you really meant to undo).

### What if the email send fails?

Resend retries 5 times with exponential backoff. After 5 failures, status becomes `brief_email_failed`. Founder gets WhatsApp alert. Founder can manually retry from the CRM action panel ("Retry brief email").

### Inline edits applied

The materialiser:

```typescript
function materialiseEdits(run: AnalysisRun, edits: AnalysisEdit[]): typeof run.ai_output {
  let result = structuredClone(run.ai_output);
  for (const edit of sortBy(edits, 'edited_at')) {
    setByPath(result, edit.field_path, edit.value_after);
  }
  return result;
}
```

`setByPath` handles JSON pointer-style paths (the same paths the client sends).

The materialised snapshot is rendered into the email AND stored in `orders.approved_snapshot` (a new JSONB column added in the v2 migrations) for audit. We never lose the exact email content sent.

## Discard action

When founder clicks "Discard":

1. Confirmation modal: "Discard this brief? The customer's auto-acknowledgement email already went out, but no further emails will be sent. You can re-open this order later if needed. Are you sure?"
2. Confirmation: Cancel / Discard.
3. On confirm, hit `/v1/brief/discard`:

```json
{
  "order_id": "uuid",
  "reason": "" // optional, but logged
}
```

4. Server:
   - Updates `orders.status = 'discarded'`
   - Logs `founder_discarded` to activity_log with the reason
   - No emails fire

5. Frontend redirects to the Pending Review queue.

### Recovery from discard

If a brief was discarded in error, the founder can manually undo:

- Manually update `orders.status` from `'discarded'` back to `'pending_founder_review'` (via Supabase Studio or a CRM "undo discard" button — Phase 2 may build this).
- Re-run the approval flow.

## CRM Timeline mode (post-approval / post-payment)

Once the brief is approved (or discarded), the Order Detail page switches to Timeline mode. This shows everything chronologically — the audit trail.

### Layout

Single-column timeline. Each event is a card with:

- Timestamp (relative + absolute)
- Event type (e.g., "AI analysis ran", "Founder approved", "Brief email sent")
- Click-to-expand for full payload (the actual webhook body, the email rendered, etc.)

### Events surfaced

Pulled from `activity_log`:

- Form started (with city if IP-derived)
- Form steps 1-7 completed
- Photos uploaded
- Form submitted
- Auto-ack email sent (with Resend message ID)
- AI analysis ran (run_index, cost, duration)
- AI analysis completed (output renderable on click)
- Founder review opened
- Founder edits (per field, with diffs)
- Founder re-analyzed (note + new run_index)
- Founder approved
- Brief email sent (Resend message ID, body snapshot)
- Customer email replied (if any — Resend inbound webhook)
- Drop-off recovery sent (type, timestamp)
- Payment initiated (Paystack reference)
- Payment succeeded / failed (full webhook payload)
- WhatsApp confirmation sent (Evolution API delivery status)
- WhatsApp recovery sent (if applicable)
- Phase 2 handoff

### Action buttons (alongside the timeline)

- Re-send any email manually (modal confirms)
- Send manual WhatsApp (textarea + send)
- View customer photos in lightbox
- Issue refund (modal walks through Paystack dashboard refund, then mark refunded)
- Mark as production-ready (Phase 2 handoff)
- Delete photos early (override 90-day clock)

## Mobile / phone view

The 3-column review layout doesn't work on phones. Phone shows:

- Order list at the top
- Selected order's status badge
- Tabs: Form / AI / Actions
- Tab Form: collapsible sections of form responses
- Tab AI: full AI output, editable inline
- Tab Actions: Approve / Re-analyze / Discard buttons

Phone use is fallback for when iPad/laptop isn't available. We don't optimise heavily for it.

## Auth

- All `/admin/*` routes require an authenticated Supabase session.
- Session is created via magic link to a known allowlist (founder email + future reviewer emails).
- Allowlist is a Supabase table `admin_allowlist (email, role, added_at)`.
- Magic link emails go via the same Resend account.
- Session timeout: 12 hours of inactivity. Re-auth required.

## What this flow does NOT do

- Schedule deferred sending of brief emails. The brief email fires immediately on approve.
- Allow scheduling re-analyses for later. They run synchronously.
- Allow batching approvals across multiple briefs. Each brief is approved individually.
- Allow rolling back a sent brief email. Once sent, it's sent.
- Allow modifying the form responses (left column). The form is immutable.
- Allow deleting analysis_runs or analysis_edits. The audit trail is forever.

## Where to look next

- `docs/specs/ai-brief-analysis.md` — the AI service that produces the input to this flow.
- `docs/specs/email-templates.md` — the brief email rendered after approval.
- `docs/data-model.md` — `analysis_runs`, `analysis_edits` schema.
- `apps/web/src/app/admin/orders/[id]/page.tsx` — the implementation.
- `apps/agent/src/api/v1/brief/{approve,reanalyze,edit-field,discard}/route.ts` — server endpoints.
