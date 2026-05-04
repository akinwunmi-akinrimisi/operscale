# Implementation plan

22-day build plan for Operscale Content Calendar Phase 1. Each day has a goal, the files touched, the dependencies on prior days, and the verification check that says "this day is done."

This plan assumes a single experienced builder (you, with Claude Code) working full-time. If days slip, the plan slips — it is not designed to compress without losing quality.

## Status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` done and verified

Update statuses as you go. The status snapshot in `README.md` should match.

## Week 1 — Foundation + NDPC

### Day 1 — Setup + NDPC kick-off

**Goal:** repo scaffolded, environment installable, NDPC paperwork gathering started.

**Tasks:**
- `[ ]` Run `./skills.sh` from a fresh checkout. Verify all skills install without error.
- `[ ]` Create the GitHub repo `operscale-calendar-platform`. Push initial commit.
- `[ ]` Configure Cloudflare DNS for `operscale.cloud` and `api.operscale.cloud` (placeholders for now; real domain at Day 15).
- `[ ]` Create the Supabase migration files folder. First migration is the schema for Phase 1 v2.
- `[ ]` Begin gathering NDPC supporting docs: CAC certificate, business address proof, founder ID. Schedule a 1-hour block on Day 3 to actually file.

**Verification:**
- `pnpm install` succeeds at the repo root.
- `./skills.sh --dry-run` runs to completion without error.
- The skeleton folders match the layout in `README.md`.

### Day 2 — Marketing site skeleton + privacy policy

**Goal:** marketing home page renders at `operscale.cloud` with the three pricing cards and basic copy. Privacy policy and terms drafted.

**Tasks:**
- `[ ]` Scaffold `apps/web` with Next.js 15, Tailwind, shadcn-ui via `pnpm create next-app` then `npx shadcn init`.
- `[ ]` Create the home page: hero, value prop, three pricing cards (no calendar previews yet — that's Day 3).
- `[ ]` Create the privacy policy page (`/privacy`) — NDPC-aligned, photo retention policy stated.
- `[ ]` Create the terms page (`/terms`) — what we deliver, what's expected of customer.
- `[ ]` Deploy the container to the VPS via Traefik. Reachable at staging URL.

**Skills used:** `frontend-design`, `next-best-practices`, `web-design-guidelines`, `copywriting`.

**Verification:**
- Open `https://staging-operscale.cloud` (or the staging URL); home page loads in under 2 seconds.
- Privacy policy page exists and references NDPC, photo retention, customer rights.

### Day 3 — Pricing page with calendar previews + NDPC FILE

**Goal:** pricing page is interactive — three tier cards each show a 7/14/30 day calendar grid with niche-picker. NDPC application submitted today.

**Tasks:**
- `[ ]` Build `apps/web/src/app/pricing/page.tsx` with three tier cards.
- `[ ]` Build `apps/web/src/app/pricing/components/CalendarPreview.tsx` — the interactive calendar grid. Reference: `docs/specs/calendar-preview-on-pricing-page.md`.
- `[ ]` Build `NichePicker.tsx` that switches `niche` query param.
- `[ ]` Create static content in `apps/web/src/content/calendar-preview/<niche>.json` for the 7 niches.
- `[ ]` Pre-generate ~30 thumbnails per niche using a one-off Ideogram V3 script (saved to `apps/web/public/calendar-preview/<niche>/`). Total: ~210 images. This is the only Day-3 task that requires external API calls. Budget ~$8.40.
- `[ ]` **NDPC: file the registration application.** Lead time is 14 working days. Doing this on Day 3 puts the deadline at Day 17, with 5-day buffer before the Day 22 launch.

**Skills used:** `frontend-design`, `vercel-react-best-practices`, `page-cro`.

**Verification:**
- Pricing page loads. Switching tier buttons updates the grid. Switching niche updates the topics and palette. Hovering or tapping a day cell shows a popover with the topic and sample caption.
- NDPC reference number captured and stored (in 1Password vault and on the VPS).

### Day 4 — Intake form steps 1–4

**Goal:** customer can complete steps 1 through 4 of the intake form. State persists across step transitions and can be reloaded from a save token.

**Tasks:**
- `[ ]` Form state management. Decide: React Context + reducer, or Zustand. Recommendation: Zustand for simplicity. State in localStorage AND Supabase (via save token).
- `[ ]` Step 1: Tier picker (re-uses pricing card components).
- `[ ]` Step 2: Business info form. Validate WhatsApp format.
- `[ ]` Step 3: Direction & goals, with niche-specific follow-up questions appearing based on Step 2's niche selection.
- `[ ]` Step 4: Brand voice + reference posts (3 textareas) + brand colors + logo upload to Supabase Storage.
- `[ ]` After step 3, write the brief to Supabase, generate a save token (random 32-char string), email it to the customer ("Your draft is saved at `operscale.cloud/brief/abc123...`").

**Verification:**
- Open form, complete steps 1-4, refresh the browser. State persists from localStorage.
- Open the save-token URL in a different browser. State loads from Supabase.
- Logo file uploaded to `customer-logos` bucket in Supabase Storage.

### Day 5 — Photo upload step (Step 5)

**Goal:** customer can upload up to 3 face reference photos with consent. Quality checks run client-side. Photos land in `customer-photos` bucket. Consent is hashed and stored.

**Tasks:**
- `[ ]` Build `apps/web/src/app/brief/step-5-photos.tsx` with the uploader component.
- `[ ]` Build `apps/web/src/components/form/PhotoUploader.tsx` — drag-and-drop, thumbnails, replace control, max 3 files, max 10MB each.
- `[ ]` Wire client-side quality checks: tfjs `blazeface` for face detection, Laplacian variance for sharpness, average luminance for brightness. Show advisory feedback.
- `[ ]` Build `ConsentCheckbox.tsx` with the exact consent text from `docs/specs/photo-upload-and-retention.md`. SHA-256 hash the canonical text, store the hash in `brief_consent`.
- `[ ]` Build the upload endpoint at `apps/agent/src/api/v1/brief/upload-photo/route.ts`. Service-role write to `customer-photos/{customer_id}/{brief_id}/photo_{n}.jpg`. Idempotent on `(brief_id, photo_index)`.
- `[ ]` Set `scheduled_delete_at = uploaded_at + 30 days` (will be re-set later when an order is created).

**Verification:**
- Upload 3 photos. Quality pills show "ok" or "advisory: low brightness".
- Verify in Supabase: 3 rows in `brief_photos`, 1 row in `brief_consent` with hash matching the canonical text.
- Verify in Storage: 3 files at the expected path.

## Week 2 — Backend services

### Day 6 — Form steps 6 & 7 + auto-acknowledgement email

**Goal:** form is complete end-to-end. Submission writes brief + order, fires the auto-ack email.

**Tasks:**
- `[ ]` Step 6: Visual character lock. Render different sub-questions based on whether photos were uploaded.
- `[ ]` Step 7: Review & submit. Render a summary of all answers. Source attribution. Terms checkbox. Submit button.
- `[ ]` Set up Resend account. Verify the domain (`operscale.cloud`) — DKIM, SPF, DMARC records added to Cloudflare.
- `[ ]` Build the auto-ack template at `apps/web/src/emails/AutoAckEmail.tsx` using React Email.
- `[ ]` Build the submit endpoint at `apps/agent/src/api/v1/brief/submit/route.ts`:
  - Wrapped in DB transaction
  - Inserts customer, brief, photos linkage, consent, order
  - Triggers Resend send (await but don't block on send failure)
  - Triggers AI analysis (fire-and-forget)
  - Returns 200 with order_id

**Verification:**
- Submit a complete test brief. The auto-ack email arrives within 30 seconds.
- DB has the expected rows (customers, briefs, brief_photos, brief_consent, orders, activity_log).

### Day 7 — AI brief analysis service

**Goal:** Claude analyzes the brief and writes the structured output to `analysis_runs`. The CRM Pending Review queue lights up.

**Tasks:**
- `[ ]` Build `apps/agent/src/lib/claude.ts` — Anthropic SDK client, the prompt scaffold, vision-block handling, JSON validation.
- `[ ]` Read the niche brief markdown from `niche-briefs/<niche>.md` based on `briefs.form_payload.business.niche`.
- `[ ]` If photos were uploaded, download from Supabase Storage and base64-encode for vision blocks.
- `[ ]` Construct the prompt per `docs/specs/ai-brief-analysis.md`. Call Claude.
- `[ ]` Validate the response against the JSON schema. Retry on failure.
- `[ ]` Write to `analysis_runs` with `run_index = 1`, `is_current = true`. Update order status to `pending_founder_review`.
- `[ ]` Log `ai_analysis_started` and `ai_analysis_completed` to `activity_log`.

**Verification:**
- Submit a test brief. Wait 60-120 seconds. Query `SELECT * FROM analysis_runs WHERE brief_id = 'X'` — exactly one row.
- The output JSON has all the v2 expanded fields (brief_summary, recommended_angles, sample_script_seed, brand_voice, photo_aesthetic if photos uploaded, visual_style, upsell_recommendation, flags).

### Day 8 — CRM Pending Review queue

**Goal:** founder can see all pending-review briefs, click into one, see the three-column layout (form / AI output / actions). Inline editing works.

**Tasks:**
- `[ ]` Build `apps/web/src/app/admin/layout.tsx` with magic-link auth gate (Supabase magic-link).
- `[ ]` Build `apps/web/src/app/admin/pending-review/page.tsx` — list of pending review orders. Real-time subscription to `orders` and `analysis_runs`.
- `[ ]` Build `apps/web/src/app/admin/orders/[id]/page.tsx` with a switch between Review mode (status = `pending_founder_review`) and Timeline mode (later).
- `[ ]` Build `ReviewMode.tsx` — three-column layout. Left = form responses. Middle = AI output, click-to-edit each field. Right = action panel with three buttons.
- `[ ]` Build the inline-edit save: on blur, POST to `/v1/brief/edit-field` which writes to `analysis_edits`.
- `[ ]` Build photo lightbox component for viewing uploaded photos at full size (signed URL, 5-min expiry).

**Skills used:** `frontend-design`, `vercel-react-best-practices`.

**Verification:**
- Sign in via magic link. See the pending review queue.
- Click into an order. See all three columns. Click a text field, edit, blur. Verify `analysis_edits` row was written.
- Open the photo lightbox. Photos load via signed URL.

### Day 9 — Re-analyze with note + Approve and send

**Goal:** founder can re-analyze with a note, or approve. Approve triggers the brief email.

**Tasks:**
- `[ ]` Build `ReanalyzeNoteModal.tsx` with a textarea (min 10 chars) and a "Run re-analysis" button.
- `[ ]` Build `/v1/brief/reanalyze` endpoint:
  - Set current `analysis_runs` row `is_current = false`
  - Re-call Claude with original form + photos + founder note appended to prompt
  - Insert new `analysis_runs` row with `run_index = previous + 1`, `is_current = true`, `trigger_type = 're_analyze_with_note'`, `founder_note` populated
  - Update order activity log
- `[ ]` Build the brief email template at `apps/web/src/emails/BriefEmail.tsx` using React Email. Include the new `visual_style` block.
- `[ ]` Build `/v1/brief/approve` endpoint:
  - Materialise the current AI output + edits into a snapshot
  - Update `orders.approved_analysis_run_id`, `orders.founder_approved_at`, `orders.founder_approved_by`, `orders.status = 'founder_approved'`
  - Render and send the brief email via Resend
  - On send success, update `orders.status = 'brief_sent'`, `orders.brief_email_sent_at = now()`
  - Activity log entries

**Verification:**
- Open a pending review brief. Click "Re-analyze with note", write 20 chars, run. New analysis appears.
- Click "Approve and send". The customer receives the brief email within 60 seconds. Order moves to `brief_sent`.

### Day 10 — Paystack integration

**Goal:** end-to-end payment flow works in test mode. Webhook signature verified. Order moves to `paid`.

**Tasks:**
- `[ ]` Set up Paystack account (test mode). Generate test public + secret keys, store in env files.
- `[ ]` Build `/v1/payment/initialize` endpoint that calls Paystack `/transaction/initialize`.
- `[ ]` Build `/v1/webhook/paystack` handler with HMAC-SHA512 verification on raw body BEFORE JSON parsing. Reference: `docs/specs/paystack-integration.md`.
- `[ ]` Idempotency via `payments.paystack_tx_ref` UNIQUE.
- `[ ]` On `charge.success`: insert payment, update order, fire confirmation email + WhatsApp side-effects (next day).
- `[ ]` Test with `cloudflared tunnel` exposing your local agent to a public URL. Configure in Paystack test dashboard.

**Verification:**
- End-to-end: submit brief → approve → click Pay Now → complete Paystack test checkout → webhook fires → order moves to `paid`.
- Replay the webhook (Paystack supports redelivery). Verify idempotency: no duplicate payment row.

## Week 3 — CRM completeness, polish, launch

### Day 11 — WhatsApp + drop-off recovery

**Goal:** WhatsApp confirmation fires on payment. Drop-off recovery cron sends recovery emails.

**Tasks:**
- `[ ]` Configure Evolution API for the new instance `operscale-calendar`.
- `[ ]` Build `apps/agent/src/lib/evolution.ts` — sender wrapper, retry on 5xx.
- `[ ]` Wire the payment confirmation WhatsApp message to fire on `charge.success` (within 90 seconds).
- `[ ]` Build the drop-off recovery Edge Function in `supabase/functions/drop-off-recovery/`:
  - Runs every 30 minutes
  - Finds briefs at form_step_3+ but unsubmitted older than 24h → recovery email
  - Finds orders at `brief_sent` but `paid_at IS NULL` older than 6h → recovery email
  - Finds orders at `payment_initiated` but not paid older than 2h → recovery WhatsApp
- `[ ]` Idempotency on recovery sends — track in activity_log so we don't double-send.

**Verification:**
- Complete a test payment. Verify the WhatsApp confirmation arrives within 90 seconds.
- Backdate a brief in DB to simulate a 24h-stale draft. Trigger the cron manually. Verify recovery email sends exactly once.

### Day 12 — CRM Timeline mode + action buttons

**Goal:** post-payment orders show the full chronological timeline of every event. Founder can take manual actions.

**Tasks:**
- `[ ]` Build `TimelineMode.tsx` — chronological feed of every `activity_log` event for the order. Each event renders with timestamp, type, optional details (rendered on click).
- `[ ]` Build `ActionButtons.tsx`:
  - Re-send any email manually (modal confirms)
  - Send manual WhatsApp (textarea + send)
  - View customer photos in lightbox
  - Issue refund (modal walks through Paystack dashboard refund, then mark refunded)
  - Mark as production-ready (Phase 2 handoff)
  - Delete photos early (override 90-day clock)
- `[ ]` Wire all action buttons to the corresponding agent endpoints. Each action writes to activity_log.

**Verification:**
- Open a paid order. Timeline shows every event from form_started to whatsapp_sent.
- Issue a test refund (test-mode Paystack). Order status moves to `refunded`. Timeline shows the refund event.

### Day 13 — Photo retention sweeper

**Goal:** photos auto-delete on schedule. Founder can override.

**Tasks:**
- `[ ]` Build the Edge Function in `supabase/functions/photo-retention-sweep/`:
  - Runs daily at 03:00 WAT
  - Selects `brief_photos` rows where `scheduled_delete_at <= now() AND deleted_at IS NULL`
  - For each: delete the storage file, update `deleted_at`, log `photo_deleted_executed`
- `[ ]` On order delivered (Phase 2), update `scheduled_delete_at = delivered_at + 90 days`. (For Phase 1, the only path that updates `delivered_at` is manual via founder action — typically not used; photos sit at the 30-day default.)
- `[ ]` Build `/v1/admin/photo-delete` endpoint for founder override.
- `[ ]` Test the sweeper with backdated test data.

**Verification:**
- Insert a `brief_photos` row with `scheduled_delete_at = now() - 1 day`. Run the function manually. Verify the file is gone from Storage and `deleted_at` is set.

### Day 14 — End-to-end testing

**Goal:** every flow tested with real data. Bug list filed. KPIs measured.

**Tasks:**
- `[ ]` Submit 5 test briefs across all 7 niches. Mix of with-photos and without-photos.
- `[ ]` Verify AI analysis quality on all 5: brief_summary specific, 3 angles distinct, hooks usable, brand_voice block populated, photo_aesthetic populated when photos present, visual_style coherent.
- `[ ]` Test the re-analyze flow: write a note, run, verify new output reflects the note.
- `[ ]` Test inline editing: edit each field type (string, list, nested object).
- `[ ]` Run the full payment flow with a small ₦100 test charge in live mode (then refund it). Verify the live webhook delivery.
- `[ ]` Test WhatsApp delivery to your own number in live mode.
- `[ ]` Stress test: submit 5 briefs in 30 seconds. Verify all process and queue Claude calls appropriately.
- `[ ]` Verify the photo retention sweeper with backdated data.
- `[ ]` Run Playwright e2e on the form happy path. (Skill: `playwright-best-practices`.)

**Verification:**
- All tests pass or are filed as issues. KPI baselines captured.

### Day 15 — Polish + brand lock + launch prep

**Goal:** the app looks and feels production-grade. Brand name decided and locked. NDPC registration confirmed complete.

**Tasks:**
- `[ ]` **NDPC: confirm registration completed.** If still pending, escalate or delay launch — we do not launch without registration.
- `[ ]` Lock the brand name. Run `./scripts/lock-brand.sh "Real Brand Name" "realbrand.com"`. Commit. Verify `grep -r 'Operscale' apps/ docs/` returns nothing.
- `[ ]` Final design pass: logo placement, hero copy, FAQ section, founder bio + photo for trust signal.
- `[ ]` Add a hero video on the marketing landing page (if we have a sample we made).
- `[ ]` Privacy policy: include the actual NDPC registration number.
- `[ ]` All meta tags / OG tags / favicon configured.
- `[ ]` Switch Paystack to live keys.
- `[ ]` Smoke test the live URL one more time.

**Verification:**
- The marketing site at the locked domain looks production-grade. Pricing page works. Form submits. Brand name appears consistently.
- Live Paystack reference is in the env file. Test charge: ₦100 charge, refund.

### Days 16–22 — Launch + monitor

**Goal:** acquire 5+ paying customers in the first 30 days. Iterate on copy, prompts, form questions based on real customer behaviour.

**Tasks:**
- `[ ]` First marketing post: Instagram, TikTok, WhatsApp Status. Founder direct outreach to existing network.
- `[ ]` Founder ready on WhatsApp for first-customer support — respond within 1 hour during business hours.
- `[ ]` Daily review: every submission, every brief approval, every payment. Note quality issues in a running list.
- `[ ]` By Day 22: review the KPI sheet. If we're tracking < 25% form completion or < 25% brief-to-payment conversion, file specific iteration tasks for Week 4.

**Verification:**
- KPI dashboard shows actual numbers vs targets from `docs/customer-journey.md`.

## Tracking the plan

Open the GitHub Project (or Issues tab) for this repo. One issue per day. Each issue has:

- The day's goal
- The tasks (mapped to the checkboxes above)
- The verification check
- A daily note at end-of-day with what got done and what slipped

If a day's tasks slip, the next day picks them up. The plan accepts up to 3 days of total slippage; beyond that, write a status note in `README.md` and inform stakeholders.

## What's NOT in this plan

These are explicitly not on the Phase 1 build:

- Video script generation (Phase 2)
- HeyGen avatar creation from photos (Phase 2)
- Video render pipeline (Phase 2)
- Carousel image generation (Phase 2)
- Customer-facing dashboard (out of scope, see ADR 0007)
- Subscription billing (out of scope)
- Customer site / Instagram scraping (out of scope, see PRD section 16)

If a task you think you need to do is on this list, stop. Re-read the PRD and the ADRs. Phase 1 ends at `paid`.
