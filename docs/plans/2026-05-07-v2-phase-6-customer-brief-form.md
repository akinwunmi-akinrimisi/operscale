# Phase 6 — Customer brief form (master plan)

Date: 2026-05-07
Author: Akinwunmi (founder) + Claude
Predecessors: V2 Phases 1–5 backend + auth hotfix landed today (commits `1aa4912 → d998919`).
Status: **DRAFT — pending founder approval before any code**.

---

## 1. What is Phase 6

Build the *customer-facing* slice of the Phase 1 state machine. The backend pipeline that runs *after* `/v1/brief/submit` is already deployed and proven (AI worker, founder CRM, Paystack init + webhook, payment-confirmation email). What does NOT exist:

- All 7 form step pages under `apps/web/src/app/brief/step-*` are TODO stubs.
- `/v1/brief/submit` is a 501.
- `/v1/brief/upload-photo` is a 501.
- There is no `/v1/brief/save` (save-token endpoint).
- There is no auto-ack email template, save-token email template, or drop-off recovery cron wiring.
- The existing `apps/web/src/app/brief/components/PhotoUploader.tsx` and `ConsentCheckbox.tsx` are placeholders.
- Marketing pages `/`, `/pricing`, `/privacy`, `/terms` are stubbed minimally.

When Phase 6 closes, a real customer in Lagos can land on `/`, click through pricing, complete the 7-step brief on their phone, upload photos, submit, and receive an auto-ack email — with their brief landing in the founder CRM, the AI analysis kicking off, and (eventually) the brief email + Paystack link going out and payment closing the loop.

Phase 6 also re-runs the original Phase-6-as-smoke plan (`docs/plans/2026-05-07-v2-phase-6-e2e-production-smoke.md`) once the form is live, against a real customer.

---

## 2. Source-of-truth specs

The implementation is graded against:

| Spec | Authoritative for | Notes |
|---|---|---|
| `docs/customer-journey.md` (572 ln) | State machine, per-step writes, side effects, save-token mechanics, drop-off rules, failure modes | Canonical — disagreements here win |
| `docs/data-model.md` (672 ln) | Schema (customers, briefs, brief_photos, brief_consent, orders), CHECK constraints, RLS, indexes | Schema is immutable per CLAUDE.md; no migrations expected |
| `docs/specs/photo-upload-and-retention.md` | Photo contract: multipart shape, magic-byte verification, EXIF strip, 2048px resize, JPEG q92, retention sweep | The `customer-photos` Storage bucket already exists |
| `docs/specs/email-templates.md` | Exact subject + body for auto-ack, save-token, recovery-form, brief-email, payment-confirmation. Sender = `noreply@operscale.cloud` | Already wired for brief-email + payment-confirmation; rest is new |
| `docs/specs/ai-brief-analysis.md` | Form payload field names. `customer_backstory_verbatim` MUST be stored byte-for-byte | The analyzer's regex blocks fabrication using these exact keys |
| `docs/pricing-and-packages.md` | Three tiers with exact NGN amounts and deliverable counts | Tier picker copy lifts directly from this |
| `niche-briefs/*.md` | Niche-aware AI context (analyzer side; not the form) | The form lists niches but doesn't render niche-specific Q&A |
| `docs/implementation.md` Days 1–7 | Original implementation outline; Days 5–7 cover the form | Aspirational — actual code didn't follow it |
| `AGENT.md` State 1 | DOE-format experiment for SUBMITTED state | The Phase 6.8 smoke validates against this |

---

## 3. UI step → field mapping (canonical, derived from customer-journey.md + ai-brief-analysis.md)

The form_payload JSONB accumulates across steps. Final field set per the AI prompt template (`ai-brief-analysis.md` lines 120–158). UI step ordering per `customer-journey.md` §2.

| UI step | Title | form_payload writes | DB writes | Server endpoint |
|---|---|---|---|---|
| 1 | Pick your tier | `tier_intent` (also written to `briefs.tier_intent` column) | `briefs` row created if first visit (anonymous customer cookie) | none (client-side only — write happens at step 2 boundary) |
| 2 | Business basics | `brand_name`, `owner_name`, `phone_e164`, `email`, `niche_slug`, `niche_label`, `one_line_description`, `offer_description`, `price_point_band` | upsert `customers` (email_lower) | `POST /v1/brief/save` step=2 |
| 3 | Audience & goals | `primary_audience_description`, `audience_age_range`, `audience_location`, `audience_belief`, `audience_belief_target` | `briefs.save_token = <24-char>`, save-token email fires | `POST /v1/brief/save` step=3 |
| 4 | Brand assets | `logo_uploaded_yes_no`, `brand_colours`, `instagram_handle` (+ optional logo upload to a *separate* `customer-logos` bucket) | (logo upload writes a separate row pattern; TBD) | `POST /v1/brief/save` step=4 + `POST /v1/brief/upload-logo` (or piggy-back on /upload-photo with a flag) |
| 5 | Photos (optional) | `photo_count` (derived), `photo_consent_yes_no` (derived) | `brief_photos` rows + `brief_consent(consent_type='photo_upload')` | `POST /v1/brief/upload-photo` (multipart) |
| 6 | Voice & references | `stated_voice`, `reference_posts_block`, `customer_backstory_verbatim` | save | `POST /v1/brief/save` step=6 |
| 7 | Review & submit | terms consent | full transactional submit (customers / briefs / orders / brief_consent terms / activity_log) + auto-ack email + AI analyze queued | `POST /v1/brief/submit` |

`save_token` is generated on first save AT step 3 (not earlier — confirmed customer-journey.md §2.4).

---

## 4. Stack inheritance — what's already built

What we plug into:

- **`apps/agent/src/lib/supabase-admin.ts`** — service-role client. Used by every new endpoint.
- **`apps/agent/src/lib/email.ts`** — Resend wrapper with idempotency cache + retry. Currently allows only `brief-email` + `payment-confirmation` templates; will extend to allow `auto-ack`, `save-token`, `recovery-form`.
- **`apps/agent/src/lib/cors.ts`** — `corsPreflight` / `withCors` (added today). Public endpoints called from the form get this.
- **`apps/agent/src/worker/index.ts`** — already polls `ai_analysis_jobs`; the form just needs to enqueue a row.
- **`apps/agent/src/worker/sweep.ts`** — already runs the photo retention sweep. We add a `drop-off-recovery` sweep alongside.
- **`apps/web/src/lib/consent.ts`** — canonical `PHOTO_CONSENT_V1_HASH` constant. The form reads the text, the server validates the hash matches.
- **`apps/web/src/app/brief/components/PhotoUploader.tsx` + `ConsentCheckbox.tsx`** — placeholders we'll fill in.
- **Supabase Storage bucket `customer-photos`** — exists, RLS-locked.
- **React Email** — installed (used for `BriefEmail.tsx` and `PaymentConfirmation.tsx`); we add `AutoAckEmail.tsx` + `SaveTokenEmail.tsx` + `RecoveryFormEmail.tsx`.

What we deliberately do NOT touch:

- `supabase/migrations/` — schema is sufficient for Phase 6.
- Anything under `apps/web/src/app/admin/` — Phase 5 is locked.
- Phase 2 surfaces (video/carousel render).
- `auth.custom_access_token_hook` and middleware role gating — not customer-facing.

---

## 5. Sub-phase breakdown

Eight sub-phases. Sequenced so each can be smoke-tested independently before the next starts. Sub-phase 6.0 is brand-lock + plan approval (this doc); 6.1–6.7 are build; 6.8 is the live customer smoke.

### 6.0 — Brand lock + this plan approved
**Status:** Brand locked in commit `d998919` (CI flag flipped to `BRAND_LOCKED=true`). Awaiting founder sign-off on this plan to start 6.1.

### 6.1 — `/v1/brief/save` + `/v1/brief/submit` backend (no UI yet)
**Goal:** the entire backend can be exercised by curl. Submit returns `{ brief_id, order_id }`. Save endpoint accepts partial payloads and issues save_token at step 3 boundary.

**Files:**
- `apps/agent/src/app/v1/brief/save/route.ts` (new) — POST + OPTIONS, withCors. Body: `{ brief_id?, customer_id_cookie?, step, partial_payload }`. Idempotent — re-saving same step is a no-op.
- `apps/agent/src/app/v1/brief/submit/route.ts` (replace 501 stub) — POST + OPTIONS, withCors. Full transaction per customer-journey.md §2.6. Synchronously fires auto-ack email. Enqueues AI analysis job (insert into `ai_analysis_jobs`).
- `apps/agent/src/lib/form-payload-schema.ts` (new) — single zod source-of-truth for the form_payload JSONB shape. Both endpoints import from here.
- `apps/web/src/emails/AutoAckEmail.tsx` (new) — React Email template, body per `email-templates.md` §auto-ack.
- `apps/agent/src/lib/email.ts` — extend `SUPPORTED_TEMPLATES` to include `auto-ack` + `save-token` + `recovery-form`.

**Acceptance:**
1. `curl POST /v1/brief/save` step=1 with `{ tier_intent: 'starter' }` → 200 + `{ brief_id, customer_id }`. New `briefs` row + stub `customers` row.
2. Repeat step=1 with the returned `brief_id` → 200, no new rows (idempotent).
3. `curl POST /v1/brief/save` step=3 with full step-3 fields → `briefs.save_token` is set; save-token email fires within 60s (Resend dashboard confirms delivery).
4. `curl POST /v1/brief/submit` with full payload → 200 + `{ brief_id, order_id }`. `orders.status='pending_founder_review'`. Auto-ack email lands. Worker picks up the analysis job; `analysis_runs` row appears within 180s.
5. Re-submitting the same `brief_id` → returns the existing IDs, does NOT double-write to `orders`.

**Dependencies:** None (pure backend on existing schema). Can start immediately after this plan is approved.

**Open questions:**
- Q: Anonymous customer identification before email is captured (step 1). **Proposed:** issue an HTTP-only `os_brief_session` cookie at step 1's first save call, value = customer_id (the stub row UUID). Browser-blocked-cookie case: form restarts, accepted per customer-journey.md §2.3.
- Q: Endpoint auth posture. **Proposed:** these endpoints are public (no JWT). Rate-limit via Resend's per-recipient limits + a simple in-process IP throttle (10 saves / IP / 5 min, mirroring the photo upload rule). No anti-bot for Phase 6 — accept the risk per existing project memory ("Side effects §1 spam relay surface remains").
- Q: Save endpoint for steps 4–6. **Proposed:** all save calls go through one route with `step` discriminator + step-specific zod schema; saves only the fields appropriate to the step into form_payload via `jsonb_set`.

### 6.2 — `/v1/brief/upload-photo` backend
**Goal:** photos persist to Supabase Storage with consent + quality scores. Photo retention sweep already running.

**Files:**
- `apps/agent/src/app/v1/brief/upload-photo/route.ts` (replace 501 stub) — multipart parsing per `photo-upload-and-retention.md` §request shape. Magic-byte verify, EXIF strip, JPEG re-encode q92, 2048px max dimension, write to `customer-photos/{customer_id}/{brief_id_or_null}/photo_{N}.jpg`. SHA-256 consent hash check.
- `apps/agent/src/lib/photo-pipeline.ts` (new) — `sharp`-based image processing. Tested in isolation.
- `apps/web/src/lib/consent.ts` — verify `PHOTO_CONSENT_V1_HASH` matches what we'll send from the browser.

**Acceptance:**
1. `curl POST /v1/brief/upload-photo` with valid multipart → 201, `brief_photos` row, file in Storage at expected path.
2. Wrong consent hash → 400 `consent_hash_mismatch`. No DB or Storage write.
3. > 10 MB → 413. Wrong MIME → 400. Magic-byte mismatch (e.g. .jpg with .gif bytes) → 400.
4. 11th upload from same IP within 5 min → 429.
5. Storage write succeeds but DB insert fails (simulated) → file is removed (rollback works).
6. Re-encoded file ≤ 2048px long edge, no EXIF data, content-type `image/jpeg`.

**Dependencies:** 6.1 (needs `brief_id` to link). Can be developed in parallel but smoke-tested only after 6.1.

**Open questions:**
- Q: What npm lib for image processing? **Proposed:** `sharp` (already widely used, fast, native dependency acceptable since we're in Node 20 + Alpine; pre-built binaries fine).
- Q: Logo upload at step 4 — is it a photo or a separate flow? **Proposed:** logo lands in a new `customer-logos` Storage bucket (NOT `customer-photos`) with no quality check. Reuse the same multipart endpoint via a `kind=logo` form field, OR build a separate `/v1/brief/upload-logo` endpoint. **Recommend:** separate endpoint `upload-logo` — it has different validation rules (PNG with alpha is fine), no consent step, no quality scoring, no per-brief index. Cleaner than overloading.

### 6.3 — Drop-off recovery cron + recovery email template
**Goal:** customers who dropped at step 3+ and went idle for 24h get a single resume reminder.

**Files:**
- `apps/agent/src/worker/drop-off-recovery.ts` (new) — runs every 30 min from the existing worker. SQL query per customer-journey.md §2.4 + dedup against `email_log` for `recovery_form_sent`.
- `apps/agent/src/worker/index.ts` — register the new cron alongside the photo retention sweep.
- `apps/web/src/emails/RecoveryFormEmail.tsx` (new) — React Email template per `email-templates.md` §recovery-form.

**Acceptance:**
1. Insert a synthetic `briefs` row with `current_step=3, save_token='abc', last_updated_at = now() - 25h`. Wait one cron tick → email fires, `email_log` records `recovery-form` template.
2. Repeat the next tick → no second email (dedup works).
3. Insert a row with `current_step=2` → no email (only step 3+ qualify).

**Dependencies:** 6.1 (needs save-token issuance to work). Independent of 6.2 / frontend.

**Open questions:**
- Q: Cron cadence — every 30 min per spec, or align with the existing daily 03:00 photo sweep? **Proposed:** every 30 min. The 24h drop-off window has a 30-min recovery resolution; daily would miss the same-day-recovery cohort.

### 6.4 — Step 1 frontend (tier picker) + marketing site polish
**Goal:** the customer's first impression. Three tier cards, marketing-grade visual, mobile-first. Also polish `/` and `/pricing` enough that the funnel is coherent.

**Files:**
- `apps/web/src/app/brief/step-1/page.tsx` — tier cards (Starter / Standard / Calendar), Standard pre-selected with "most popular" badge per pricing spec line 14.
- `apps/web/src/app/brief/layout.tsx` — shared form chrome: progress bar (1 of 7), back link, mobile sticky CTA.
- `apps/web/src/app/page.tsx` — landing page, single hero + CTA → `/brief`. Will not be Apple-quality; will be conversion-functional.
- `apps/web/src/app/pricing/page.tsx` — three cards mirroring the spec table.
- `apps/web/src/lib/save-client.ts` (new) — client helper that POSTs `/v1/brief/save` with the session cookie and stores returned `brief_id` in localStorage.

**Acceptance:**
1. Mobile (375×667) and desktop (1280×800) renders cleanly.
2. Picking a tier and clicking Next → POST `/v1/brief/save` step=1 → `brief_id` in localStorage → navigate to `/brief/step-2`.
3. Returning to `/brief/step-1` later: tier is pre-selected from the persisted `brief_id`'s saved payload.

**Dependencies:** 6.1 (save endpoint must exist). Visual design has no hard dependency on backend — can be wireframed first.

**Open questions:**
- Q: Visual design quality bar. **Proposed:** functional + clean (Tailwind + shadcn), not bespoke. Use `frontend-design` skill defaults. The brand can ship and earn revenue at this quality bar; bespoke polish is a Phase 7 concern.
- Q: Mobile vs desktop testing rigour. **Proposed:** I'll test in Chrome DevTools mobile mode (375×667 + 414×896 viewports). Founder spot-checks on a real device before each sub-phase merges.

### 6.5 — Steps 2–3 frontend + save-token issuance
**Goal:** the form gets persisted server-side; save-token email lands on step-3 completion.

**Files:**
- `apps/web/src/app/brief/step-2/page.tsx` — business basics (10 fields). Real-time validation, mobile-first.
- `apps/web/src/app/brief/step-3/page.tsx` — audience (5 fields). On Next: save AND show the "your brief is saved" toast per customer-journey.md §2.4.
- `apps/web/src/app/brief/[token]/page.tsx` (new) — resume route that reads the save_token from the URL, fetches the brief's payload, redirects to `current_step + 1`.
- `apps/web/src/lib/form-state.ts` (new) — typed state container for all fields, validates with the same zod schema as the server.

**Acceptance:**
1. Step 2 → Next: customer row updated with email/name/phone, brief.form_payload includes step-2 keys.
2. Step 3 → Next: save_token issued, save-token email lands, toast says "We've emailed you a resume link."
3. Click resume link in the email → lands on `/brief/{token}` → redirects to `/brief/step-4` with prior fields preserved.
4. Resume link is valid for 7 days (test by manually editing `briefs.last_updated_at`).

**Dependencies:** 6.1 + 6.4.

**Open questions:**
- Q: Drop-off email and save-token email — can both fire? **Proposed:** save-token always fires first (synchronously at step 3). Drop-off recovery fires only if last_updated_at is 24h+ idle AND no recovery_form_sent yet for this brief. They don't compete.

### 6.6 — Steps 4–5 frontend + photo + logo upload UX
**Goal:** the hard UI. Photo uploader with quality check, consent checkbox, drag-drop. Logo upload at step 4.

**Files:**
- `apps/web/src/app/brief/step-4/page.tsx` — brand assets + logo upload (lightweight, single PNG/JPG up to 2 MB, no consent gate).
- `apps/web/src/app/brief/step-5/page.tsx` — photos page wrapping the existing `PhotoUploader.tsx` component.
- `apps/web/src/app/brief/components/PhotoUploader.tsx` (replace stub) — drag-drop + click. Per-photo: BlazeFace inference, sharpness via Laplacian variance, brightness via mean luminance. Advisory pills, Use Anyway override.
- `apps/web/src/app/brief/components/ConsentCheckbox.tsx` (replace stub) — renders the canonical consent text from `apps/web/src/lib/consent.ts`. Submitted with each photo upload.
- `apps/web/src/lib/quality-check.ts` (new) — pure functions for the three checks; tfjs lazy-loaded.

**Acceptance:**
1. Drag a JPG → preview thumbnail with quality pill ("✓ Looks good" or "⚠ Photo looks blurry").
2. Tick consent → upload via `/v1/brief/upload-photo` → persists with quality scores.
3. Skip step 5 → form proceeds without writing brief_photos rows.
4. BlazeFace fails to load (network) → photos still upload, quality scores NULL, no user-blocking error.

**Dependencies:** 6.2 + 6.5. Tfjs is a heavy bundle; lazy-load only on this page.

**Open questions:**
- Q: Max photo count. Schema says `photo_index BETWEEN 1 AND 3` → max 3. **Proposed:** stick to 3.
- Q: Should the customer pick which slot a photo goes into (1 / 2 / 3) or is it auto-assigned? **Proposed:** auto-assigned by upload order. Reorder via drag if customer wants.

### 6.7 — Steps 6–7 frontend + success page
**Goal:** voice & references → review → submit. Success page sets expectations correctly.

**Files:**
- `apps/web/src/app/brief/step-6/page.tsx` — three textareas: stated voice, reference posts, customer backstory (verbatim, no autocorrect, no transformation).
- `apps/web/src/app/brief/step-7/page.tsx` — review summary of all 7 steps. Terms checkbox. Submit button.
- `apps/web/src/app/brief/success/page.tsx` (new) — post-submit success page with copy from customer-journey.md §2.6 ("Thanks {first_name}, we've received your brief...").

**Acceptance:**
1. Step 6 textareas preserve every byte the customer typed (no smart-quote rewrite, no trim of double spaces). Round-trip test: type a known string → submit → query `briefs.form_payload->>'customer_backstory_verbatim'` matches byte-for-byte.
2. Step 7 review correctly reflects every prior choice. Terms checkbox required.
3. Submit → `/brief/success` page renders → auto-ack email lands → CRM `/admin/pending-review` shows the new row within 5s of analysis completion.

**Dependencies:** 6.1, 6.4–6.6.

**Open questions:**
- Q: Step 7 — should the customer be able to go back and edit specific fields before submitting? **Proposed:** yes, each section has an "Edit" link that jumps to the relevant step page. State is preserved via the brief_id.

### 6.8 — Live E2E smoke (the original 6 plan)
**Goal:** drive a real customer through the whole flow. Anything that breaks gets fixed in a narrow scope. This re-uses the pre-existing `2026-05-07-v2-phase-6-e2e-production-smoke.md` plan.

**Acceptance:** unchanged from the pre-existing smoke plan. A real customer in incognito, real test email, Paystack test card, completes `/brief → /admin/pending-review → approve → pay → orders=paid` with no founder intervention beyond approve.

---

## 6. Sequencing & parallelism

Two streams that can run in parallel after 6.0 approval:

```
6.0 (approval) ─────────────────────────┐
       │                                │
       ▼                                ▼
  6.1 backend ──── 6.2 photo ──── 6.3 drop-off cron
       │
       ▼
  6.4 step-1 ─── 6.5 steps-2/3 ─── 6.6 steps-4/5 ─── 6.7 steps-6/7 ─── 6.8 live smoke
```

Backend (6.1, 6.2, 6.3) finishes before any frontend (6.4+) can be smoke-tested end-to-end, but UI design / scaffold of step-1 (6.4) can start the moment 6.1 contracts are written, because the contract is the dependency, not the implementation.

**Realistic time estimate** (one focused session per sub-phase): 8 sessions. Could compress to 5–6 if some sub-phases combine (e.g. 6.1+6.2 in one session if no surprises; 6.4+6.5 together).

---

## 7. Cross-phase open questions (need founder decision before 6.1 starts)

These are decisions I can't infer from the specs alone:

1. **Q: How rigorous on UX polish?** A bespoke Figma-quality form takes 2x as long. **Proposed:** functional + clean (the `frontend-design` skill default). We can do a Phase 7 polish pass post-launch if conversion data demands it. **Confirm or override.**

2. **Q: Anti-bot for `/v1/brief/save` and `/v1/brief/submit`?** Currently zero. The save-token email surface is a spam-relay risk. **Proposed:** for 6.1, just IP-based rate limit (10 saves / IP / 5 min) — same pattern as the photo upload spec. Defer Cloudflare Turnstile / hCaptcha to post-launch. **Confirm.**

3. **Q: Drop-off recovery on Day 1 of launch — should it fire?** The 24-hour window means the very first customer who drops would receive a recovery email tomorrow. **Proposed:** ship 6.3 with the cron registered but a kill-switch env var `RECOVERY_EMAIL_ENABLED=false` you flip to `true` once you're comfortable. **Confirm.**

4. **Q: Logo upload at step 4 — separate bucket / endpoint or shared?** **Proposed:** new bucket `customer-logos`, new endpoint `/v1/brief/upload-logo` (different validation rules — PNG-with-alpha allowed, no consent step, no quality check). **Confirm.**

5. **Q: Where do reference posts get their URL bodies fetched?** `ai-brief-analysis.md` line 150 says "URL-fetched bodies." That implies the form/server fetches the post HTML and stores it. Or does the founder paste the text manually? **Proposed:** customer pastes text. URL is captured but we do NOT auto-fetch (Instagram blocks; reliability is poor). **Confirm.**

6. **Q: niche-picker UX at step 2.** The data-model says `customers.niche` is unconstrained text. The niche-briefs/ directory has 8 niches today. **Proposed:** form renders a dropdown with the 8 known niches + "Other (describe)" text input. The "Other" path triggers `_default.md` AI brief and surfaces a `niche_unmapped` flag. **Confirm.**

7. **Q: Test email + Paystack test card discipline during build.** Real Resend-and-Paystack costs are tiny (sub-cent per send) but `auth.users` and `customers` rows accumulate. **Proposed:** add `apps/agent/src/lib/test-cleanup.ts` — a manual cleanup script (not cron) that hard-deletes test customer/brief/order rows where email matches a `+e2etest@` pattern. **Confirm.**

8. **Q: Should I commit each sub-phase as a single PR or chunks?** Currently solo work, no PR review. **Proposed:** single PR per sub-phase, Conventional Commits per logical chunk inside that PR. Founder reviews via the PR before each merges. **Confirm.**

---

## 8. Out of scope (Phase 6 will NOT do)

- New schema migrations (current schema is sufficient).
- Phase 2 (video/carousel render).
- Subscription / recurring billing.
- Multi-currency.
- A/B testing framework on the form.
- Custom marketing-grade visual design beyond the `frontend-design` skill defaults.
- Cloudflare Turnstile / anti-bot.
- Per-niche conditional Q&A on step 6 (specs say no — universal questions, niche brief applied at AI layer).
- Customer dashboard. Per ADR-0007: there is no customer dashboard.
- WhatsApp form-progress notifications (the `whatsapp_log` integration is only post-payment).

---

## 9. Verification — Phase 6 is "done" when

1. Every sub-phase 6.1 → 6.7 has merged with its acceptance criteria green.
2. Sub-phase 6.8 (live smoke) closes successfully — a real customer journey from `/` to `orders.status='paid'` with auto-ack + brief email + payment-confirmation email all delivered.
3. `activity_log` for the test order shows all expected events with no `*_failed` rows.
4. The CI brand-lock check stays green throughout (no `<brand-name>` regressions).
5. `pnpm typecheck` passes for both apps. Test suite still ≥ current 281 tests.
6. Memory updated to mark Phase 6 complete; project_state.md "next phase" pointer moves to Phase 7.

---

## 10. Rollback plan

Each sub-phase is its own commit / PR. If a sub-phase ships broken:
- Revert the merge commit.
- Fix in a follow-up.
- The sub-phases are designed so a revert of 6.5 doesn't break 6.4's tier picker — each step page degrades gracefully when later steps don't yet exist (clicking Next goes nowhere; not a hard failure).

The only revert that would break a deployed feature is 6.1 (`/v1/brief/submit`) — which is a 501 stub today, so reverting it returns to 501. Not worse than current state.

---

## 11. Approval

If you approve this plan as-is, I'll:
1. Mark task #14 complete.
2. Create a sub-phase plan for 6.1 (more detailed than this section's bullet list — file-by-file changes, zod schemas, exact commit boundaries).
3. Start coding 6.1.

If you want to override any of the 8 open questions in §7, name them by number and I'll adjust the plan + the dependent sub-phases before 6.1 starts.
