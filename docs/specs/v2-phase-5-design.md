# V2 Phase 5 — Founder CRM (design)

Status: design (brainstormed 2026-05-05). Implementation plan to follow at `docs/plans/<YYYY-MM-DD>-v2-phase-5-founder-crm.md` once this design is approved (date stamped on the day the plan is written).

## 1. Goal

Ship the **Founder CRM v0** so the founder can sign in, walk a brief from `pending_founder_review` to `founder_approved` (or `discarded`), trigger re-analyses with notes, and observe paid orders — all without needing Supabase Studio. v0 is intentionally narrow: it's the first surface that lives in `apps/web` (Phases 1–4.6 lived in `apps/agent` API routes), and it must be operationally usable end-to-end before any real customer arrives.

## 2. Scope

### In v0 (this phase)

- Magic-link sign-in for the three allowlisted founder emails.
- Pending-review queue (live).
- Brief detail page with two modes (review · timeline) auto-switched by `orders.status`.
- Three founder actions: approve, re-analyze with note, discard.
- Paid-orders dashboard.
- Realtime live updates on all three list/detail surfaces.

### Deferred to Phase 5.x (NOT in v0 — explicitly carry-forward)

- Inline edit of AI fields + `/v1/brief/edit-field` route. (`selected_pairs` are READ-ONLY in v0.)
- 2-hour WhatsApp founder alert cron.
- 12-hour session-inactivity timeout.
- Photo lightbox via `/v1/admin/photo-signed-url`.
- "Resend brief email" recovery action for `brief_email_failed` orders.
- Restricted-niche flag handling.
- Receipt PDF on payment confirmation (already deferred to Phase 4.7).
- Architectural cleanup: extract `@operscale-calendar/shared` package (Phase 4.5 carry-forward, still pending).

## 3. Locked decisions (carry-forwards from prompt brainstorm)

| # | Decision | Locked value |
| --- | --- | --- |
| 1 | Auth entry | `/admin/*` gated; unauthenticated → 307 to `/admin/sign-in`; post-auth → `/admin/pending-review` |
| 2 | Pending-review list scope | Oldest-first by `submitted_at`; no filter/search/bulk; render all (LIMIT 100 safety cap; banner if cap hit) |
| 3 | Edit-field UX | N/A in v0 — `selected_pairs` READ-ONLY |
| 4 | Live-update strategy | Realtime everywhere (queue + order-detail + paid-orders) |
| 5 | Discard action | Modal + optional reason textarea (max 500 chars) → `POST /v1/brief/discard` |
| 6 | Brief-detail layout | Two-column (form left · AI right) + sticky bottom action bar (option C from brainstorm) |
| 7 | Pagination | Pending = render-all (LIMIT 100); paid-orders = 25 + Load more |
| 8 | Activity log surface | Collapsible "history" accordion at top of review mode |

### Pre-decided constraints (from prompt — locked)

- Magic-link via Supabase `signInWithOtp`. Allowlist enforced project-wide by `send_email_hook`; `role=founder` stamped by `custom_access_token_hook`.
- `verifyJwt` helper duplicated to `apps/web/src/lib/auth/verify-jwt.ts` (no cross-package import — Phase 4.5 cyclic-dep lesson).
- `SUPABASE_SERVICE_ROLE_KEY` stays API-route-only in `apps/agent`. `apps/web` uses anon key + founder JWT cookie + RLS.
- One brief per order — list views key off orders.

## 4. Architecture

### 4.1 Web app surface (`apps/web/src/app/admin/`)

| Route | Type | Purpose |
| --- | --- | --- |
| `/admin` | Server Component | `redirect('/admin/pending-review')` |
| `/admin/sign-in` | Client Component | Magic-link form + "check your email" state |
| `/admin/auth/callback` | Route Handler | Exchange magic-link code → session cookie → `founder_signed_in` activity log → redirect to `/admin/pending-review` |
| `/admin/pending-review` | Server Component + `<RealtimeQueue />` client child | Initial queue + Realtime diffs |
| `/admin/orders/[id]` | Server Component (mode-switching) | Review mode if `status='pending_founder_review'`, else Timeline mode |
| `/admin/paid-orders` | Server Component + `<RealtimePaidOrders />` client child | 25 most-recent + Load more |

### 4.2 Auth gate

`apps/web/src/middleware.ts` runs on every `/admin/*` request:

1. Reads session cookie via `@supabase/ssr` middleware helper.
2. Refreshes session if near expiry.
3. Checks `role === 'founder'` claim in the JWT payload.
4. Unauthenticated → 307 `/admin/sign-in`.
5. Authenticated non-founder (defence-in-depth — should not happen due to project-wide `send_email_hook`) → 307 `/admin/sign-in?denied=1`.

### 4.3 Apps/agent endpoints (write boundary)

| Endpoint | Status | Phase 5 work |
| --- | --- | --- |
| `POST /v1/brief/approve` | Live (Phase 4 + 4.5) | Reuse — calls Paystack init + Resend send |
| `POST /v1/brief/analyze` | Live (Phase 4) | Reuse with `trigger_type='re_analyze_with_note'` |
| `POST /v1/brief/discard` | 501 stub | **Build it** — Phase 5's only new backend route |

No new GET endpoints. `apps/web` reads directly via `@supabase/ssr` (anon + RLS).

### 4.4 Data flow direction

- **Reads**: browser → `apps/web` Server Component → Supabase REST (anon + founder JWT) → RLS-filtered rows → streamed HTML.
- **Realtime**: browser → Supabase Realtime WS (anon + founder JWT) → diffs applied to SSR'd state.
- **Writes**: browser → `apps/web` client `fetch` → `apps/agent` route (verifies founder JWT) → service-role Supabase REST → DB.

### 4.5 Library files added (`apps/web`)

- `src/lib/supabase/server.ts` — `createServerClient` factory (uses `next/headers` cookies).
- `src/lib/supabase/browser.ts` — `createBrowserClient` factory.
- `src/lib/supabase/middleware.ts` — middleware helper for session refresh.
- `src/lib/auth/verify-jwt.ts` — duplicated from `apps/agent/src/lib/auth/verify-jwt.ts`.

### 4.6 Dependencies added

- `apps/web`: `@supabase/ssr` (new). `@supabase/supabase-js` (already a transitive — promote to direct).
- `apps/agent`: no new deps.

## 5. Components

Each component is single-purpose; reuse shadcn-ui primitives (Button, Dialog, Card, Skeleton, Badge — already in the locked stack).

### 5.1 Shell & auth

- `AdminLayout` — `<header>` with brand + nav + signed-in email + sign-out. Server Component (existing scaffold extended).
- `SignInForm` (`'use client'`) — controlled email input + submit. Calls `supabase.auth.signInWithOtp`. Renders `idle | sent | error` states.
- `SignOutButton` (`'use client'`) — calls `supabase.auth.signOut()`, router-pushes to `/admin/sign-in`.

### 5.2 Pending-review queue

- `PendingReviewPage` (Server Component) — initial fetch + cap detection. Passes rows to `QueueTable`.
- `QueueTable` (`'use client'`) — renders `QueueRow[]`. Hosts `<RealtimeQueue />` subscription.
- `QueueRow` — brand_name, customer name, tier badge, niche, time-since-submission badge (≤30m green / ≤2h yellow / >2h red), photo-icon. Whole row links to `/admin/orders/[id]`.
- `QueueCapBanner` — yellow banner if LIMIT 100 reached.

### 5.3 Brief detail (mode-switching)

- `OrderDetailPage` (Server Component) — fetches `orders` + `briefs` + `analysis_runs` + `customers`; decides mode from `orders.status`.
- `HistoryAccordion` — single-line summary above the columns; expand → chronological pre-approval activity_log events. Default collapsed. Review mode only.
- `ReviewMode` — two-column grid + sticky bottom action bar.
  - `FormResponsesPanel` (left) — read-only render of `briefs.form_payload`.
  - `AiSnapshotPanel` (right) — read-only render of `analysis_runs.ai_output` + `framework_seed.selected_pairs`.
  - `ActionBar` (sticky bottom) — three buttons + status line ("Run N · Submitted Xm ago"). Hosts the three modals.
- `TimelineMode` — single-column chronological list of `activity_log` rows. Each event = card with timestamp + event_type + expandable JSON payload. No action buttons in v0.

### 5.4 Action modals (each `'use client'`)

- `ApproveModal` — confirms "Send brief to {email}?" → `fetch('POST /v1/brief/approve')` → loading (~2-5s for Paystack + Resend) → success: toast + close modal + `router.refresh()` (page re-renders in Timeline mode automatically because `orders.status` is now past `pending_founder_review`); failure: inline error, modal stays open.
- `ReanalyzeModal` — textarea (min 10 chars validated client + server) → `fetch('POST /v1/brief/analyze')` with `trigger_type='re_analyze_with_note'` + `prior_run_id` + `founder_note` → modal stays open watching Realtime for new `analysis_runs` (`is_current=true`) → close + refresh.
- `DiscardModal` — optional reason textarea (max 500) → `fetch('POST /v1/brief/discard')` → success: toast + push to `/admin/pending-review`.

### 5.5 Paid-orders dashboard

- `PaidOrdersPage` (Server Component) — initial 25 rows.
- `PaidOrdersTable` (`'use client'`) — rows: brand_name, tier, paid_at relative+absolute, amount NGN. Hosts `<RealtimePaidOrders />`.
- `LoadMoreButton` (`'use client'`) — fetches next 25 via browser Supabase client + appends.

### 5.6 Realtime subscription components

- `<RealtimeQueue />` — channel `pending-review`; `orders` filtered to `status='pending_founder_review'`. INSERT prepends; UPDATE off-status splices out; DELETE splices out.
- `<RealtimeOrderDetail orderId={id} />` — channel `order-detail-${id}`; subscribes to `orders` (id), `analysis_runs` (brief_id), `activity_log` (order_id). Triggers `router.refresh()` for SSR'd parts on UPDATE; renders new activity_log directly into the timeline / accordion.
- `<RealtimePaidOrders />` — channel `paid-orders`; `orders` filtered to `status='paid'`. INSERT prepends; UPDATE reconciles in-place.

## 6. Data flow

### 6.1 Reads (Server Components, anon + founder JWT + RLS)

| Page | Tables | Logical query |
| --- | --- | --- |
| `/admin/pending-review` | `orders`, `briefs`, `customers` | `SELECT o.id, o.tier, o.submitted_at, b.form_payload->>'brand_name' AS brand_name, b.form_payload->>'niche' AS niche, c.name AS customer_name, b.id AS brief_id, EXISTS(SELECT 1 FROM brief_photos WHERE brief_id=b.id) AS has_photos FROM orders o JOIN briefs b ON b.id=o.brief_id JOIN customers c ON c.id=o.customer_id WHERE o.status='pending_founder_review' ORDER BY b.submitted_at ASC LIMIT 100` |
| `/admin/orders/[id]` (review) | `orders`, `briefs`, `customers`, `analysis_runs`, `activity_log` | Order + brief + customer + `analysis_runs WHERE is_current=true AND brief_id=?` + `activity_log WHERE order_id=? OR brief_id=? ORDER BY occurred_at ASC` |
| `/admin/orders/[id]` (timeline) | `orders`, `customers`, `activity_log`, `payments`, `analysis_runs` | All `activity_log` events + payments row + analysis_runs history |
| `/admin/paid-orders` | `orders`, `customers`, `payments`, `briefs` | `SELECT ... WHERE o.status='paid' ORDER BY o.paid_at DESC LIMIT 25 OFFSET ?` |

RLS already enforces founder-role access on all five tables (per migration 0001 policies). Server Component reads pass without service-role.

### 6.2 Realtime channels (browser client, anon + founder JWT)

| Channel | Subscribed events | Diff handling |
| --- | --- | --- |
| `pending-review` | `orders` INSERT/UPDATE/DELETE filtered to `status='pending_founder_review'` | INSERT → fetch joined row, prepend; UPDATE off-status → splice out; DELETE → splice out |
| `order-detail-${order_id}` | `orders.id=?`, `analysis_runs.brief_id=?`, `activity_log.order_id=?` | activity_log INSERT → append to history accordion / timeline; analysis_runs INSERT (`is_current=true`) → `router.refresh()`; orders UPDATE → `router.refresh()` (mode may change) |
| `paid-orders` | `orders` filtered to `status='paid'` | INSERT (status flipped to paid) → fetch joined row, prepend; UPDATE → reconcile in-place |

REPLICA IDENTITY FULL is set on all three published tables (per migration 0001 + verified in 0003 publication). Diffs receive full rows — gotcha #4 already mitigated.

### 6.3 Writes (apps/web client → apps/agent route → service-role)

| Action | Endpoint | Request | DB writes |
| --- | --- | --- | --- |
| Approve | `POST /v1/brief/approve` (live) | `{ order_id }` + JWT | UPDATE orders, INSERT customer_framework_history × 8, INSERT activity_log × 3, side-effects (Paystack init + Resend send) |
| Re-analyze | `POST /v1/brief/analyze` (live) | `{ brief_id, trigger_type:'re_analyze_with_note', prior_run_id, founder_note }` + JWT | INSERT ai_analysis_jobs, INSERT activity_log `ai_reanalyze_requested` + `ai_analysis_enqueued` |
| Discard | `POST /v1/brief/discard` (**new**) | `{ order_id, reason? }` + JWT | UPDATE orders SET status='discarded', INSERT activity_log `founder_discarded` |

### 6.4 `/v1/brief/discard` route detail (new code)

```
POST /v1/brief/discard
- Verify JWT via verifyJwt(); 401 if missing/invalid
- Require role='founder'; 403 otherwise
- zod validate { order_id: uuid, reason?: string (max 500) }
- SELECT orders WHERE id=order_id; 404 if not found
- 409 if status NOT IN ('pending_founder_review') — return current status
- Service-role UPDATE: orders.status='discarded', updated_at=now()
- Service-role INSERT activity_log {event_type:'founder_discarded', order_id, brief_id, actor_email, payload: {reason}}
- Return 200 {status:'discarded'}
- On any DB error: 500 + best-effort activity_log {event_type:'discard_failed', payload:{error}}
```

### 6.5 Idempotency

- Discard: naturally idempotent — the `pending_founder_review`-only guard converts re-discards to 409 (not an error from the founder's perspective; modal handles gracefully).
- Re-analyze: Phase 4's idempotency key `${brief_id}::re_analyze_with_note::${prior_run_index}` catches double-clicks at queue insert.
- Approve: Phase 4's status guard (`pending_founder_review` only) catches double-clicks; second click returns 409.

### 6.6 `orders.status` transitions touching Phase 5

```
pending_founder_review ──approve──→ founder_approved → brief_sent (4.5) → paid (4.6)
pending_founder_review ──discard──→ discarded (terminal)
pending_founder_review ──reanalyze─→ pending_founder_review (status unchanged; new analysis_runs row; is_current flips)
```

Phase 5 only writes the `pending_founder_review` → {founder_approved, discarded} boundary; everything past `founder_approved` is observed display-only.

## 7. Auth flow

1. Founder visits `/admin` (or any `/admin/*` route).
2. Middleware sees no session cookie → 307 to `/admin/sign-in`.
3. Founder enters email → `signInWithOtp({ email, options: { emailRedirectTo: `${origin}/admin/auth/callback` } })`.
4. Supabase Auth invokes project-wide `send_email_hook` — if email isn't in allowlist, hook drops the email silently. UI shows generic "If your email is allowlisted, a sign-in link is on its way."
5. If allowlisted, Resend sends the magic link. Founder clicks → `/admin/auth/callback?code=...`.
6. Callback Route Handler exchanges code for session via `@supabase/ssr` server client; sets cookies; INSERTs `founder_signed_in` activity_log row; 307 to `/admin/pending-review`.
7. Middleware now sees session + founder role → renders the admin app.

If `activity_log` RLS doesn't permit founder-role INSERTs, plan adds a tiny `POST /v1/auth/log-signin` endpoint on apps/agent that the callback POSTs to. Resolved during plan-writing by reading 0001 policies.

## 8. Error handling

### 8.1 Auth failures

| Failure | UI |
| --- | --- |
| Email not allowlisted | Generic "If allowlisted, link is on its way." |
| Magic link expired/reused | `/admin/sign-in?error=expired` — inline "That link has expired." |
| Resend down | Form shows "Couldn't send sign-in email. Try again." |
| Session cookie corruption | Middleware clears cookie + 307 `/admin/sign-in?error=session` |

### 8.2 Read failures (Server Components)

- Supabase REST 5xx during SSR → throw → `apps/web/src/app/admin/error.tsx` boundary renders "Couldn't load the CRM. Refresh the page." with `Try again` button. Sentry captures.
- RLS-empty result on `/admin/orders/[id]` → `notFound()` → 404 page.
- `analysis_runs` empty for a `pending_founder_review` order → "AI analysis hasn't completed yet" + Approve / Re-analyze disabled.

### 8.3 Realtime failures

- WS disconnect → `@supabase/realtime-js` retries with backoff. After 30s no connection: persistent banner "Live updates paused — Reconnecting…" On reconnect: clear banner + `router.refresh()` once.
- Subscribe error >3× in 60s → banner switches to "Live updates unavailable — refresh to retry." Page works without Realtime.

### 8.4 Write failures

| Endpoint | Failure | UI behaviour |
| --- | --- | --- |
| `/v1/brief/approve` 502 (Paystack) | Phase 4.5 leaves `founder_approved` | Modal stays open; inline "Couldn't initialise payment — try again." |
| `/v1/brief/approve` 502 (Resend) | Phase 4.5 flips order to `brief_email_failed` | Modal closes; toast: "Approved, but brief email failed to send. Order is at `brief_email_failed`; recovery action deferred to Phase 5.x." `router.refresh()` re-renders in Timeline mode showing the failure state. |
| `/v1/brief/analyze` 5xx | Queue insert failed | Modal stays open; inline "Couldn't enqueue re-analysis — try again." |
| `/v1/brief/discard` 5xx | DB error | Modal stays open; inline "Couldn't discard — try again." Server logs `discard_failed` best-effort. |
| `/v1/brief/discard` 409 | Status race (already actioned) | Modal closes; toast: "This order has already been actioned (status: {status})." `router.refresh()`. |

### 8.5 Activity log breadcrumbs (CLAUDE.md "observability before automation")

| Event | Where written | When |
| --- | --- | --- |
| `founder_signed_in` | `/admin/auth/callback` (or `/v1/auth/log-signin` fallback) | After successful code exchange |
| `founder_discarded` | `/v1/brief/discard` | Successful UPDATE |
| `founder_approved` + `brief_email_sent` | `/v1/brief/approve` (already live) | Phase 4.5 logic |
| `ai_reanalyze_requested` + `ai_analysis_enqueued` | `/v1/brief/analyze` (already live) | Phase 4 logic |
| `discard_failed` | `/v1/brief/discard` (best-effort) | DB error path |

`realtime_disconnect_extended` NOT logged in v0 — too noisy without aggregation. Defer to Phase 5.x if needed.

### 8.6 No silent swallows (CLAUDE.md no-shortcut)

Every error path either surfaces to the founder OR writes activity_log. Only swallow allowed: the activity_log INSERT itself (gotcha #11 pattern: own try/catch, `console.error` and continue).

### 8.7 Sentry

`apps/web` Sentry integration (existing) captures unhandled errors automatically. Add explicit `Sentry.captureException` in catch arms of action-modal handlers for one breadcrumb per write failure.

## 9. Testing strategy

### 9.1 Layer 1 — Unit (vitest in `apps/agent/test/unit`)

For `/v1/brief/discard` (TDD per CLAUDE.md "test-driven where it makes sense"):

- 401 if no `Authorization` header
- 401 if `verifyJwt` returns null
- 403 if `role !== 'founder'`
- 400 if zod fails
- 404 if order not found
- 409 if status ≠ `pending_founder_review`
- 200 happy path + UPDATE shape + activity_log INSERT shape
- 500 on DB error + `discard_failed` best-effort
- Best-effort itself doesn't throw

Target: ~9 unit tests, ~150 LoC.

### 9.2 Layer 2 — Component (NEW `apps/web/test/components`, vitest + @testing-library/react)

`apps/web` doesn't have a vitest harness yet — Phase 5 wires it up (mirroring `apps/agent/vitest.config.ts`).

- `SignInForm` — idle → sent → error state machine.
- `DiscardModal` — optional reason; 500-char max; 409 handling.
- `ReanalyzeModal` — min-10-char enable; payload shape.
- `ApproveModal` — confirm flow; loading state.
- `QueueRow` — time-since-badge color thresholds (table-driven against frozen `Date.now`).
- `HistoryAccordion` — collapse/expand; chronological order.

Target: 6 component test files, ~25 tests total.

### 9.3 Layer 3 — Integration

Folded into Layer 1 (discard route is small enough).

### 9.4 Layer 4 — Schema-reality check (NEW)

Phases 3, 4.5, 4.6 all bit us with schema drift caught only at deploy time. Phase 5 adds a targeted integration test that hits **real staging Supabase** and asserts query column shapes match expectations.

- `apps/agent/test/integration/phase5-schema-shapes.test.ts`
- Gated by `SMOKE=1` env var (skipped in default CI; runs nightly + before VPS deploy).
- Asserts:
  - Pending-review join returns the expected columns (`brief_id`, `brand_name`, `niche`, `tier`, `submitted_at`, `customer_name`, `has_photos`).
  - Order-detail returns `analysis_runs.framework_seed.selected_pairs` as 8-element array of `{framework, archetype}`.
  - Paid-orders join returns `paid_at`, `amount_ngn` from `payments`, etc.
  - `activity_log` accepts a founder-role INSERT (resolves Section 7's open question; if it fails, plan adds migration 0009).
- Cleans up its own test rows.

### 9.5 Layer 5 — Live smoke (Playwright via webapp-testing skill)

Post-deploy on staging:

- **Auth path** (manual — magic-link email): founder signs in end-to-end. Screenshot.
- **Discard path** (automatable): seed a fixture brief, navigate, click Discard, confirm, paramiko-verify `orders.status='discarded'` + activity_log row.
- **Re-analyze path** (automatable + paramiko poll): seed brief, navigate, click Re-analyze, type 20-char note, paramiko-poll for new ai_analysis_jobs + new analysis_runs `is_current=true`.
- **Approve path** — re-run existing `C:\tmp\phase4-5-smoke.py` rather than re-implement; confirms the forward path still works after CRM deploy.
- **Realtime path** (manual cross-tab): two tabs on `/admin/pending-review`; paramiko inserts a fixture pending-review order; assert tab B prepends within ~3s.

### 9.6 CI gates

- `apps/agent` test job: include new discard tests (existing vitest run).
- `apps/web` test job: NEW vitest run for component tests. ~30s addition.
- `tsc --noEmit` + `next lint` already gates per Phase 4.5.
- Nightly smoke: add schema-shapes test.

### 9.7 Verification-before-completion (final task in plan)

1. All 35+ tests pass (unit + component + schema-shapes).
2. `tsc --noEmit` clean both apps; `next lint` clean.
3. `pnpm build` clean both apps; `pnpm build:worker` clean.
4. Live smoke on staging: discard + re-analyze paths green; approve path green via Phase 4.5 smoke re-run.
5. Manual end-to-end on iPad-landscape AND 13" laptop AND a phone (CLAUDE.md file ownership "test on real mobile devices" applies).
6. Console clean; Sentry quiet.

## 10. Risks and mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `activity_log` RLS doesn't allow founder INSERTs | Medium | Schema-reality test catches it before deploy; plan branches to "use new `/v1/auth/log-signin` endpoint" if hit. |
| Cross-package transitive type resolution breaks `next build` again (Phase 4.5 lesson) | Low | `typescript.ignoreBuildErrors=true` + `eslint.ignoreDuringBuilds=true` already set in both `next.config.mjs`. CI runs separate `tsc --noEmit` + `next lint` gates. Unchanged from Phase 4.5. |
| Realtime payload truncation due to missing REPLICA IDENTITY FULL | Low | Already set on all three published tables in 0001; `\d+` confirmed during Phase 3 deploy. |
| Founder hits queue cap (100 pending) due to a stalled worker | Low | `QueueCapBanner` surfaces it; worker has stuck-job sweep (Phase 3 Task 8) reclaiming orphaned `running` jobs every 5 min. |
| iPad-landscape layout looks wrong on a 13" laptop (sticky bottom bar covers content) | Medium | Manual test on both devices in verification step 5 above. Adjust bar-height or add bottom-padding to last column accordingly. |
| Magic-link callback race (multiple browser tabs) | Low | Supabase code exchange is one-shot; second attempt returns expired error → handled in 8.1. |

## 11. Out of scope (do not build in Phase 5)

- Phase 2 production capabilities (video, carousel, FFmpeg) — different repo.
- Inline edit of AI fields, photo lightbox, alert cron, recovery action, restricted-niche flag, receipt PDF — Phase 5.x or later.
- Customer-facing analytics or dashboards.
- Subscription / recurring billing.
- Multi-currency support.
- The `@operscale-calendar/shared` package extraction — separate cleanup phase.

## 12. Files touched (for the plan to expand)

### New files

- `apps/web/src/middleware.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/lib/supabase/browser.ts`
- `apps/web/src/lib/supabase/middleware.ts`
- `apps/web/src/lib/auth/verify-jwt.ts`
- `apps/web/src/app/admin/sign-in/page.tsx`
- `apps/web/src/app/admin/sign-in/SignInForm.tsx`
- `apps/web/src/app/admin/auth/callback/route.ts`
- `apps/web/src/app/admin/paid-orders/page.tsx`
- `apps/web/src/app/admin/paid-orders/PaidOrdersTable.tsx` (`'use client'`)
- `apps/web/src/app/admin/paid-orders/LoadMoreButton.tsx` (`'use client'`)
- `apps/web/src/app/admin/pending-review/QueueTable.tsx` (`'use client'`)
- `apps/web/src/app/admin/pending-review/QueueRow.tsx`
- `apps/web/src/app/admin/pending-review/QueueCapBanner.tsx`
- `apps/web/src/app/admin/orders/[id]/components/HistoryAccordion.tsx`
- `apps/web/src/app/admin/orders/[id]/components/FormResponsesPanel.tsx`
- `apps/web/src/app/admin/orders/[id]/components/AiSnapshotPanel.tsx`
- `apps/web/src/app/admin/orders/[id]/components/ActionBar.tsx` (`'use client'`)
- `apps/web/src/app/admin/orders/[id]/components/ApproveModal.tsx`
- `apps/web/src/app/admin/orders/[id]/components/ReanalyzeModal.tsx`
- `apps/web/src/app/admin/orders/[id]/components/DiscardModal.tsx`
- `apps/web/src/app/admin/orders/[id]/components/RealtimeOrderDetail.tsx`
- `apps/web/src/app/admin/pending-review/RealtimeQueue.tsx`
- `apps/web/src/app/admin/paid-orders/RealtimePaidOrders.tsx`
- `apps/web/src/app/admin/error.tsx`
- `apps/web/vitest.config.ts`
- `apps/web/test/components/*` (~6 files)
- `apps/agent/test/unit/v1-brief-discard.test.ts`
- `apps/agent/test/integration/phase5-schema-shapes.test.ts`
- (Conditional) `apps/agent/src/app/v1/auth/log-signin/route.ts` if RLS doesn't permit founder INSERTs.
- (Conditional) `supabase/migrations/0009_activity_log_founder_insert.sql` same condition.

### Modified files

- `apps/agent/src/app/v1/brief/discard/route.ts` — replace 501 stub with full implementation.
- `apps/web/src/app/admin/layout.tsx` — extend with signed-in email + sign-out.
- `apps/web/src/app/admin/page.tsx` — change to redirect.
- `apps/web/src/app/admin/pending-review/page.tsx` — full implementation.
- `apps/web/src/app/admin/orders/[id]/page.tsx` — full implementation with mode-switching.
- `apps/web/src/app/admin/orders/[id]/components/ReviewMode.tsx` — full implementation (currently scaffold).
- `apps/web/src/app/admin/orders/[id]/components/TimelineMode.tsx` — full implementation (currently scaffold).
- `apps/web/package.json` — add `@supabase/ssr`, `@supabase/supabase-js` (direct), vitest deps.
- `apps/web/next.config.mjs` — only if route-level changes need it (probably no change).
- `.github/workflows/ci.yml` — add `apps/web` test step.
- `.github/workflows/nightly-smoke.yml` — add schema-shapes test.

## 13. Implementation phases (for the plan)

A rough split, to be expanded by writing-plans:

1. **Foundation**: Supabase SSR client factories + middleware + verifyJwt duplicate + admin layout extension + sign-in form + callback route + activity_log RLS check / fallback endpoint.
2. **Discard backend**: TDD `/v1/brief/discard` route → deploy + smoke.
3. **Pending-review queue**: server fetch + QueueTable + QueueRow + RealtimeQueue + cap banner.
4. **Brief detail (review mode)**: page mode-switch + FormResponsesPanel + AiSnapshotPanel + HistoryAccordion + ActionBar + the three modals + RealtimeOrderDetail.
5. **Brief detail (timeline mode)**: chronological activity_log render.
6. **Paid orders dashboard**: PaidOrdersPage + Table + LoadMore + RealtimePaidOrders.
7. **Schema-reality test + CI wiring + nightly smoke addition.**
8. **Live smoke + close-out** (Playwright auth + automation, paramiko verifications, Phase 4.5 smoke re-run, manual mobile/iPad/laptop test).

The plan will break each into atomic tasks with checkpoints, dependencies, and "plan keeps pace with code" hooks per Phase 4.5+.

## 14. Spec self-review log

Run after first draft (Section 7 of brainstorming skill):

- ✅ Placeholder scan: no TBDs, TODOs, or vague requirements remaining.
- ✅ Internal consistency: routes table (4.1) ↔ files-touched (12) ↔ implementation phases (13) align.
- ✅ Scope: focused enough for a single phase plan; broken into 8 implementation phases (13).
- ✅ Ambiguity check: every "should" in the doc has an explicit value (e.g., "deferred" called out, not implied).
- ⚠️ Open question tracked in 7 + 9.4 + 12: `activity_log` RLS policy on founder-role INSERTs. Plan resolves before implementation by reading 0001 policies. Mitigation path explicit (new endpoint + new migration).
