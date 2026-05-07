# Phase 6 — End-to-end production smoke

Date: 2026-05-07
Author: Akinwunmi (founder) + Claude
Predecessors: V2 Phases 1–5 nominally complete; auth hotfix landed today (commits `1aa4912 → 4478340`).

## Goal

Walk a single customer end-to-end through the live production stack — `/brief` form → AI analysis → CRM approval → Paystack pay → `orders=paid` — with no synthetic shortcuts, and fix every issue that surfaces. Equivalent to running the AGENT.md "Experiment" sections against operscale.cloud, treating the whole path as one continuous test.

## Approach

1. **Map** every state in `AGENT.md` to the deployed endpoint(s) + UI surface(s) + activity_log event(s) it touches. One row per state. Reject any state that lacks a verifiable observation.

2. **Pre-flight** — probe every backend endpoint we'll hit + verify the worker is running + confirm Resend/Paystack env vars are present on the VPS. Cheap, catches misconfig early.

3. **Drive the flow** — three layers, each surfaces different bug classes:
    - *Backend smoke (curl + paramiko)*: hits `/v1/brief/submit` directly with synthetic payload + verifies activity_log + watches AI worker pick it up + verifies analysis_runs row.
    - *CRM smoke (founder driving)*: signs in, sees the new brief in `/admin/pending-review`, opens it, approves, watches orders flip to `brief_email_sent`.
    - *Customer smoke (real browser, real test email, Paystack test card)*: founder opens `/brief` in incognito, fills 7 steps, uploads photos at step 5, submits. Receives auto-ack + brief email. Pays with Paystack test card (4084 0840 8408 4081 / 408 / 12/30). Webhook fires. Order flips to `paid`.

4. **Fix as we go** — every failure is investigated to root cause, fixed in code (no patches/workarounds), redeployed via paramiko build, and the offending state is re-tested before moving on. Same rhythm as the auth hotfix.

5. **Document outcomes** — append a "smoke results" section to this plan as we go, listing each state's PASS / FAIL / FIXED with the commit SHA that resolved it. The plan file becomes the audit trail.

## States to verify (mapped from AGENT.md)

| # | State | Backend signal | UI signal | Email/SMS | Test handle |
|---|---|---|---|---|---|
| 1 | SUBMITTED | `orders.status='submitted'`, `briefs` row, `brief_photos` rows, `activity_log:form_submitted` | step-7 success page renders | auto-ack within 60s | curl POST /v1/brief/submit |
| 2 | AI_ANALYSIS_RUNNING | `ai_analysis_jobs.status='running'` then completed, `analysis_runs.run_index=1, is_current=true` | n/a | n/a | watch worker logs |
| 3 | PENDING_FOUNDER_REVIEW | `orders.status='pending_founder_review'`, `activity_log:ai_analysis_completed` | row appears in `/admin/pending-review` within 5s of ai completion | n/a | manual + Realtime check |
| 4 | FOUNDER_APPROVED | `orders.status='founder_approved'`, `customer_framework_history` rows | ApproveModal returns 200, queue updates | n/a | click Approve |
| 5 | BRIEF_EMAIL_SENT | `orders.status='brief_email_sent'`, `email_log:brief_email_sent` | order detail view shows "brief sent" | brief email + Paystack URL within 60s | check Resend dashboard |
| 6 | PAYMENT_INITIATED | `payments` row, `paystack_authorization_url` populated on order | (customer side) | n/a | click Paystack link |
| 7 | PAID | `orders.status='paid', paid_at=now()`, `payments.status='success'`, `activity_log:payment_received` | `/admin/paid-orders` shows row | payment-confirmation email | webhook fires |

A state with no observation = test failure even if the next state appears.

## Pre-flight probes (run before driving)

- [ ] `https://api.operscale.cloud/v1/health` → 200
- [ ] `https://operscale.cloud/brief/step-1` → 200, no console errors
- [ ] `operscale-calendar-worker` container `Up` per `docker ps`
- [ ] `RESEND_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` all set in `/etc/operscale-calendar/agent.env` (length-only check; never print)
- [ ] Paystack webhook endpoint registered on Paystack dashboard pointing at `https://api.operscale.cloud/v1/webhook/paystack`
- [ ] Most recent commit `4478340` deployed on both web + agent

## Files / surfaces touched (read-mostly)

This plan does NOT pre-commit to code changes. The expectation is a stack that works; modifications happen reactively, ONE state at a time, in narrow scopes. Predictable surfaces if anything fails:

- `apps/agent/src/app/v1/brief/submit/route.ts`
- `apps/agent/src/app/v1/brief/upload-photo/route.ts`
- `apps/agent/src/app/v1/payment/initialize/route.ts`
- `apps/agent/src/app/v1/webhook/paystack/route.ts`
- `apps/agent/src/worker/index.ts` (and friends — claim, photos, sweep)
- `apps/web/src/app/brief/step-{1..7}/page.tsx`
- `apps/web/src/app/admin/orders/[id]/components/*.tsx`

Schema migrations are out of scope unless a missing relationship like the pending-review embed surfaces — same fix pattern as `b10bacd`.

## Out of scope (Phase 6 does NOT cover)

- Phase 2 (video/carousel production) — order moves to `paid` and the smoke ends.
- Subscription / recurring billing.
- Multi-currency.
- Brand-name lock (locked to "Operscale" / "operscale.cloud" 2026-05-07; CI flag flipped).
- Marketing site polish.
- Drop-off recovery emails.
- Any new feature work. We only fix what's already deployed and broken.

## Verification — Phase 6 is "done" when

1. A real test customer with a real test email completes the full path `/brief → /admin/pending-review → /admin/orders/[id] approve → Paystack test pay → orders=paid` with no founder intervention beyond the click-Approve step.
2. Every row in the "States to verify" table is PASS or FIXED with a linked commit.
3. `activity_log` for the test order shows the full event chain in correct order with no `*_failed` entries.
4. Inbox for the test email has: auto-ack, brief, payment-confirmation. Three emails total. No duplicates.
5. The smoke results section at the bottom of this file is filled in.

## Smoke results

Filled in as we go. Each state row gets PASS / FAIL / FIXED→`<commit-sha>` and a one-line note about what surfaced.

| # | State | Outcome | Note |
|---|---|---|---|
| 0 | Pre-flight | PASS | All endpoints 200, containers Up @ `4478340`, web.env + agent.env all keys present, Paystack webhook returns 401 on unsigned body (correct) |
| 1 | SUBMITTED | TBD | |
| 2 | AI_ANALYSIS_RUNNING | TBD | |
| 3 | PENDING_FOUNDER_REVIEW | TBD | |
| 4 | FOUNDER_APPROVED | TBD | |
| 5 | BRIEF_EMAIL_SENT | TBD | |
| 6 | PAYMENT_INITIATED | TBD | |
| 7 | PAID | TBD | |
