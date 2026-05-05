# V2 Phase 4.5 — Paystack initialise + Resend brief email — Design

**Status:** approved 2026-05-05. Implementation plan to follow at `docs/plans/2026-05-05-v2-phase-4-5-paystack-resend.md`.

**Supersedes for the forward-path slice:** the "Phase 4.5" line items in `docs/specs/v2-pipeline-implementation-design.md` §9 (rows referencing payment initialise + brief email) and the "Phase 4.5 carry-forwards" memory entry of 2026-05-05.

**Cross-references:**
- `docs/specs/paystack-integration.md` — full Paystack contract (auth, references, channels, webhook security). Phase 4.5 implements `initializeTransaction`; webhook handler ships in Phase 4.6.
- `docs/specs/email-templates.md` §"Template 3: brief-email" — exact copy/structure/conditional blocks for the email this phase renders.
- `docs/plans/2026-05-05-v2-phase-4-route-wiring.md` — Phase 4 baseline. The `/approve` route Phase 4.5 extends.
- `supabase/migrations/0007_orders_founder_approved_status.sql` — adds `founder_approved` and `brief_email_failed` to the orders status CHECK; both consumed by 4.5 with no further migration needed.

---

## 1. Goal

After founder clicks "Approve" in the CRM, the customer must (a) receive a personalised brief email containing a working Paystack payment link, and (b) have their order's status flip to `brief_sent` (or `brief_email_failed` if Resend errors after Paystack succeeded). Phase 4.5 closes the forward path; Phase 4.6 closes the loop with the webhook handler.

## 2. Scope

### In scope

- Implement `apps/agent/src/lib/paystack.ts::initializeTransaction()` against the Paystack `POST /transaction/initialize` API. Replaces the current `throw new Error('not implemented')` stub.
- Implement `apps/agent/src/lib/email.ts::sendEmail()` for the `brief-email` template only. Other template keys throw `not_implemented`.
- New `apps/web/src/emails/BriefEmail.tsx` React Email component matching `email-templates.md` §"Template 3" verbatim.
- New pure function `apps/agent/src/lib/snapshot-to-email-props.ts::snapshotToEmailProps()` that maps `(analysis_run, order, customer, paymentLink) → BriefEmailProps`.
- Extend `apps/agent/src/app/v1/brief/approve/route.ts` to call Paystack initialise → render template → Resend send → flip status, in that order.
- Extend route + lib unit tests; extend the L2 cassette test to cover the new code paths (mocked Paystack + mocked Resend).
- Live staging smoke at `C:\tmp\phase4-5-smoke.py` (NOT committed).

### Out of scope (Phase 4.6 or later)

- `apps/agent/src/app/v1/webhook/paystack/route.ts` — the webhook handler (charge.success → `paid`, payment-confirmation email, raw-body HMAC, idempotency on `paystack_tx_ref`).
- `payment-confirmation`, `auto-ack`, `save-token`, recovery-* templates.
- "Resend brief email" CRM action for orders stuck in `brief_email_failed` (filed as Phase 4.5.1).
- Resend bounce/complaint webhook handler.
- WhatsApp send paths (separate phase entirely).
- `payment_initiated` status as a distinct state — Paystack does not emit a "transaction created" webhook; we go straight from `brief_sent` to `paid` on `charge.success`. The status remains in the CHECK constraint for forward compatibility but Phase 4.5 does not write it.

### Pre-decided constraints (locked by existing specs)

- Email template engine: **React Email** (`@react-email/components` + `@react-email/render`). Templates live in `apps/web/src/emails/`. (`email-templates.md` §Setup.)
- Paystack callback strategy: **both** callback URL (`https://operscale.cloud/payment/return?order_id=…`) AND webhook are configured. Callback URL is UX-only; webhook is the source of truth for state transitions. (`paystack-integration.md` §"Initialise transaction".)
- Reference format: `ops-cal-{order_id}-{unix_ts}` — already implemented in `paystack.ts::paystackReference`.
- HMAC-SHA512 webhook verification — already implemented in `paystack.ts::verifyWebhookSignature`. Phase 4.5 does not consume it; Phase 4.6 does.
- Test mode keys only in 4.5 (`PAYSTACK_SECRET_KEY=sk_test_*`, `PAYSTACK_PUBLIC_KEY=pk_test_*`).

---

## 3. Architecture

```
[CRM] POST /v1/brief/approve {order_id}
   │
   ▼
apps/agent/src/app/v1/brief/approve/route.ts (extended)
   │
   ├─[Phase 4 work, unchanged]
   │   • verifyJwt → role:'founder' or 401/403
   │   • SELECT orders + customer JOIN
   │   • status check (APPROVABLE_STATUSES)
   │   • SELECT analysis_runs is_current=true
   │   • INSERT customer_framework_history rows
   │   • UPDATE orders status='founder_approved' + founder_approved_at
   │     + founder_approved_by + approved_analysis_run_id
   │
   ├─[Phase 4.5 NEW: Paystack initialise]
   │   • paystackReference(order.id) → tx_ref
   │   • initializeTransaction({email, amountNgn, reference, callbackUrl, metadata})
   │     ↳ on PaystackInitError or 5xx-after-retries:
   │        return 502 {error:'paystack_init_failed'}; order stays founder_approved
   │     ↳ on duplicate-reference (rare resume case):
   │        GET /transaction/verify/:reference, reuse authorization_url
   │   • UPDATE orders {paystack_tx_ref, paystack_authorization,
   │                    payment_initiated_at: now()}
   │
   ├─[Phase 4.5 NEW: Email send]
   │   • snapshotToEmailProps(run, order, customer, authorization_url) → props
   │   • render <BriefEmail {...props}/> via @react-email/render to {html, text}
   │   • sendEmail({to, templateKey:'brief-email', subject, html, text,
   │                customerId, orderId, briefId})
   │     ↳ idempotency: check activity_log for brief_email_sent on this order
   │       within 1h. If found, reuse resend_message_id, skip Resend POST.
   │     ↳ on EmailSendError or 5xx-after-retries:
   │        UPDATE orders status='brief_email_failed'
   │        return 502 {error:'email_send_failed', tx_ref}
   │   • INSERT activity_log {event_type:'brief_email_sent',
   │                          payload:{resend_message_id, template_key}}
   │   • UPDATE orders {status:'brief_sent', brief_email_sent_at: now()}
   │
   └─ Return 200 {order_id, framework_history_rows_written, paystack_tx_ref,
                  brief_email_sent: true, resend_message_id}
```

The route stays a single handler. No queue, no service-to-service hops, no new env vars beyond `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_SENDER` (all already on the VPS).

## 4. Components

### 4.1 `apps/web/src/emails/BriefEmail.tsx` (new)

React Email component. Body matches `email-templates.md` §"Template 3" exactly. Conditional rendering:

- Photos block: only if `photoAesthetic !== null`.
- Upsell block: only if `upsell !== null`.

Props are flat (no nested objects beyond the conditional blocks) so the rendering layer stays dumb:

```ts
type BriefEmailProps = {
  firstName: string;
  briefSummary: string;
  angles: Array<{title: string; hook: string; whyItFits: string}>;
  scriptSeed: {topic: string; openingHook: string; outline: string[]};
  visualStyle: {recommendedCameraTreatment: string; recommendedCaptionStyle: string};
  photoAesthetic: {recommendedAvatarTreatment: string} | null;
  tierName: string;
  priceNgn: number;
  videoCount: number; carouselCount: number;
  ugcCount: number; t2vCount: number; carouselPages: number;
  deliveryWindow: string;
  upsell: {
    recommendedTier: string;
    reasoning: string;
    priceDeltaNgn: number;
    recommendedTierPriceNgn: number;
  } | null;
  paymentLink: string;
  founderName: string;
  brandName: string;
};
```

Workspace-imported by the agent. The agent's `tsconfig.json` already maps `@operscale-calendar/web` (verify in implementation; if not, the simplest path is a relative `import BriefEmail from '../../../web/src/emails/BriefEmail'` since both apps live in the same workspace).

### 4.2 `apps/agent/src/lib/snapshot-to-email-props.ts` (new, pure)

```ts
export function snapshotToEmailProps(
  run: { ai_output: AiOutput; framework_seed: FrameworkSeed },
  order: { id: string; tier: 'starter'|'standard'|'calendar'; amount_ngn: number },
  customer: { full_name: string | null; email: string },
  paymentLink: string,
): BriefEmailProps;
```

Pulls `briefSummary`, `angles[]`, `scriptSeed`, `visualStyle`, `photoAesthetic`, and `upsell` directly from `run.ai_output` (the post-processor already shapes these — see `apps/agent/src/lib/post-processor.ts`). Computes:

- `firstName` = first whitespace-split token of `customer.full_name`, fallback to `'there'`.
- `tierName`, `videoCount`, `carouselCount`, `ugcCount`, `t2vCount`, `carouselPages`, `deliveryWindow` from a single `TIER_CONFIG` const inside this file (mirrors `TIER_COUNTS` from `apps/agent/src/lib/types/v2.ts` but adds the human-readable strings).
- `founderName`, `brandName` from `process.env.NEXT_PUBLIC_FOUNDER_NAME` (TBD — likely "Akinwunmi") and `process.env.NEXT_PUBLIC_BRAND_NAME` (already "Operscale").

Pure: no DB, no fetch, fully unit-testable.

### 4.3 `apps/agent/src/lib/paystack.ts::initializeTransaction()` (fill stub)

```ts
export async function initializeTransaction(
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult>;
```

Implementation:

1. Read `process.env.PAYSTACK_SECRET_KEY` at call time. Throw `PaystackInitError('missing_secret')` if absent.
2. POST to `${PAYSTACK_API_BASE}/transaction/initialize` with bearer auth. Body matches `paystack-integration.md` §"Request to Paystack" verbatim — `amount: amountNgn * 100` (kobo), currency `'NGN'`, our `reference`, `callback_url`, `metadata`, `channels: ['card','bank_transfer','ussd','qr','mobile_money','bank']`.
3. On HTTP 200: parse `data.authorization_url`, `data.access_code`, `data.reference`. Return `{authorizationUrl, accessCode, reference}`.
4. On HTTP 4xx: parse `message`, throw `PaystackInitError({status, message})`.
5. On HTTP 5xx or network error: retry 3× with exp backoff (500ms, 1000ms, 2000ms). On final failure throw `PaystackInitError({status:5xx-or-0, message})`.
6. On the specific Paystack error code for "duplicate reference" (response `status === false && message contains "Duplicate Transaction Reference"`): GET `${API}/transaction/verify/${reference}`, reuse `data.authorization_url`. Same return shape.

Define and export `class PaystackInitError extends Error { constructor(public detail: {status: number; message: string}) }`.

### 4.4 `apps/agent/src/lib/email.ts::sendEmail()` (fill stub)

```ts
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
```

Implementation:

1. Accept only `templateKey === 'brief-email'` for Phase 4.5; throw `EmailSendError('not_implemented_template')` for other keys.
2. Idempotency check: `SELECT id, payload FROM activity_log WHERE event_type='brief_email_sent' AND order_id=$1 AND occurred_at > now() - interval '1 hour' ORDER BY occurred_at DESC LIMIT 1`. If found, return `{resendMessageId: payload.resend_message_id}` without calling Resend.
3. Otherwise, `import { Resend } from 'resend'`, instantiate with `process.env.RESEND_API_KEY`, call `resend.emails.send({from: process.env.RESEND_SENDER, to, subject, html, text, tags:[{name:'template',value:templateKey},{name:'order_id',value:orderId}]})`.
4. Resend 4xx → throw `EmailSendError({status, message})`. Resend 5xx / network → 3× exp backoff, then throw.
5. On success, INSERT `activity_log {event_type:'brief_email_sent', actor:'system', brief_id, order_id, occurred_at: now(), payload: {resend_message_id, template_key:'brief-email'}}`. The activity_log INSERT is best-effort (per CLAUDE.md gotcha #11) — failure is stderr-logged but does not throw.
6. Return `{resendMessageId: response.data.id}`.

Define and export `class EmailSendError extends Error { constructor(public detail: string | {status: number; message: string}) }`.

### 4.5 `apps/agent/src/app/v1/brief/approve/route.ts` (extended)

Modify the existing handler. After the existing Phase 4 INSERT customer_framework_history + UPDATE orders to `founder_approved` block:

1. **Widen the order-fetch query** to include `customers.email, customers.full_name, orders.amount_ngn, orders.tier`. Implementation: change the `.from('orders').select(...)` to use a foreign-key join or do a second `.from('customers').select('email, full_name').eq('id', order.customer_id).single()` after the order fetch. The Phase 4 selection currently lists `id, brief_id, customer_id, status` — needs `+amount_ngn, +tier`.
2. **Generate tx_ref**: `const txRef = paystackReference(order.id);`
3. **Call Paystack**:
   ```ts
   let paystackResult: InitializeTransactionResult;
   try {
     paystackResult = await initializeTransaction({
       email: customer.email,
       amountNgn: order.amount_ngn,
       reference: txRef,
       callbackUrl: `https://${process.env.NEXT_PUBLIC_BRAND_DOMAIN}/payment/return?order_id=${order.id}`,
       metadata: { order_id: order.id, customer_id: order.customer_id, brief_id: order.brief_id, tier: order.tier },
     });
   } catch (e) {
     await writeActivityLog({eventType:'paystack_init_failed', actor:'system', orderId: order.id, payload:{error: String(e)}}, supabase);
     return NextResponse.json({error: 'paystack_init_failed', detail: String(e)}, {status: 502});
   }
   ```
4. **Persist Paystack response**:
   ```ts
   await supabase.from('orders').update({
     paystack_tx_ref: paystackResult.reference,
     paystack_authorization: paystackResult, // full response object
     payment_initiated_at: new Date().toISOString(),
   }).eq('id', order.id);
   ```
5. **Render and send**:
   ```ts
   const props = snapshotToEmailProps(run, order, customer, paystackResult.authorizationUrl);
   const subject = `Your ${props.brandName} calendar brief is ready — ${props.tierName}, ${props.videoCount} videos`;
   const html = await render(<BriefEmail {...props} />);
   const text = await render(<BriefEmail {...props} />, {plainText: true});
   try {
     const sent = await sendEmail({
       to: customer.email,
       templateKey: 'brief-email',
       subject, html, text,
       customerId: order.customer_id, briefId: order.brief_id, orderId: order.id,
     });
     await supabase.from('orders').update({
       status: 'brief_sent',
       brief_email_sent_at: new Date().toISOString(),
     }).eq('id', order.id);
     return NextResponse.json({
       order_id: order.id,
       framework_history_rows_written: rowsWritten,
       paystack_tx_ref: paystackResult.reference,
       brief_email_sent: true,
       resend_message_id: sent.resendMessageId,
     }, {status: 200});
   } catch (e) {
     await supabase.from('orders').update({status: 'brief_email_failed'}).eq('id', order.id);
     await writeActivityLog({eventType:'brief_email_send_failed', actor:'system', orderId: order.id, payload:{error: String(e), tx_ref: paystackResult.reference}}, supabase);
     return NextResponse.json({error: 'email_send_failed', tx_ref: paystackResult.reference, detail: String(e)}, {status: 502});
   }
   ```

The intermediate `founder_approved` UPDATE remains. It serves as a recovery point: if the route crashes between framework_history INSERT and Paystack call, the order is at `founder_approved` and the founder retries.

## 5. State machine (orders.status)

```
pending_founder_review            (Phase 1: form submit)
        │ founder approves in CRM
        ▼
founder_approved                  (Phase 4: history written; Phase 4.5: TRANSIENT)
        │ Paystack init OK
        │ (paystack_tx_ref + paystack_authorization + payment_initiated_at SET)
        │ Resend send OK
        ▼
brief_sent                        (Phase 4.5: customer has the email)
        │ customer pays via Paystack
        │ (Phase 4.6: charge.success webhook fires)
        ▼
paid                              (Phase 4.6)


Failure branches in 4.5
─────────────────────────
founder_approved + Paystack 4xx/5xx → STAYS founder_approved → 502 to caller, founder retries.
founder_approved + Paystack OK + Resend fail → brief_email_failed (4.5.1 retry path TBD).
brief_email_failed + founder retries /approve → APPROVABLE_STATUSES allows it; idempotency
   on activity_log within 1h prevents duplicate Resend POST. After 1h, deliberate retry.
```

`payment_initiated` is unused in 4.5. Phase 4.6 may or may not write it (depending on whether Paystack offers a "transaction created" webhook; current understanding is no, so we go straight `brief_sent → paid`).

## 6. Idempotency

Three idempotency boundaries:

1. **Paystack initialise** — pre-generated `paystack_tx_ref` is unique. If we crash after Paystack accepts but before our DB UPDATE commits, the next /approve call regenerates a NEW tx_ref (since `paystackReference()` includes `unix_ts`). To handle the rare case where the same tx_ref is somehow re-submitted, `initializeTransaction()` catches Paystack's "duplicate reference" error and falls back to `GET /transaction/verify/:reference` to retrieve the existing `authorization_url`. Net effect: every retry succeeds without creating a phantom transaction.

2. **Resend send** — within `sendEmail`, check activity_log for `brief_email_sent` events on this order in the last hour. If found, return cached `resend_message_id` instead of re-sending. After 1h, deliberate resends are allowed (e.g. founder retrying after fixing customer email).

3. **/approve route** — the route's own idempotency comes from `APPROVABLE_STATUSES`. `brief_sent` is NOT in that list, so a duplicate /approve on a successfully-emailed order returns 409. `brief_email_failed` IS in the list, so it's a recovery point. `founder_approved` is NOT in the list either — if the route crashes mid-flight, the order is stuck and the founder must use a CRM "retry" action that reads the current state and decides which step to resume from. Phase 4.5 does NOT build this retry action; Phase 4.5.1 does. Practical impact: founder-side rare crashes require a CRM-side intervention.

## 7. Test plan

### 7.1 Unit (Vitest, mocked externals)

- `snapshot-to-email-props.test.ts` — pure function, ~10 tests: photos-with/without conditional; upsell-with/without conditional; firstName extraction (single name, multiple names, null fallback); tier mapping (all 3 tiers); paymentLink threading.
- `paystack.test.ts` (extend existing) — `initializeTransaction`: 200 happy path; 4xx throws PaystackInitError; 5xx-then-200 retry succeeds; 5xx-3-times throws; duplicate-reference fallback to verify endpoint; missing PAYSTACK_SECRET_KEY throws; amount-in-kobo correctness (assert request body has `amount: amountNgn * 100`).
- `email.test.ts` (extend existing) — `sendEmail`: 200 happy + activity_log INSERT verified; idempotency cache hit returns cached message_id without calling Resend; 4xx throws; 5xx-then-200 retry succeeds; unsupported templateKey throws; activity_log INSERT failure does not block return (best-effort).
- `approve/route.test.ts` (extend existing 7 tests) — add 7: paystack-init-fails-stays-founder-approved-returns-502; paystack-OK-resend-fails-flips-brief-email-failed-returns-502; both-succeed-flips-brief-sent-returns-200-with-resend-message-id; retry-on-brief-email-failed-within-1h-no-second-resend; retry-on-brief-email-failed-after-1h-sends-again; widened-order-query-includes-amount-ngn-and-tier; missing-customer-email-returns-400.

### 7.2 Integration (extend L2 cassette pattern)

Modify `test/integration/initial-fashion-tier-2.test.ts` (or add a sibling). Mock both Paystack and Resend at the `fetch` level. Run /approve end-to-end against mocked Supabase. Assert:

- One Paystack POST to `/transaction/initialize` with correct headers + body.
- One Resend POST with HTML+text containing the rendered brief.
- Order UPDATEs in correct sequence: `founder_approved` → `paystack_tx_ref` set → `brief_sent`.
- One activity_log INSERT for `brief_email_sent` with `resend_message_id`.

### 7.3 Live staging smoke (`C:\tmp\phase4-5-smoke.py`, NOT committed)

Mirror Phase 4 smoke. Steps:

1. INSERT customer (real email — use `RESEND_SENDER` itself so the email lands in the founder's inbox), brief, order.
2. POST /v1/brief/analyze (existing Phase 4 path).
3. Poll to completed (~140s).
4. POST /v1/brief/approve.
5. Assert response 200 with `paystack_tx_ref`, `brief_email_sent: true`, `resend_message_id`.
6. SELECT `orders.paystack_authorization->>'authorization_url'`; assert it starts with `https://checkout.paystack.com/`.
7. SELECT `orders.status='brief_sent'`, `brief_email_sent_at IS NOT NULL`.
8. (Manual confirmation step) Open the founder's inbox; verify the brief email arrived with rendered content and a working Pay button.
9. (Manual payment step) Open the Paystack URL, complete payment with test card `4084 0840 8408 4081`. This will NOT be observed by 4.5 (no webhook handler yet); 4.6 verifies that path.
10. Cleanup test rows (orders, briefs, customer_framework_history, analysis_runs, ai_analysis_jobs, activity_log, customers).

The "manual confirmation" and "manual payment" steps are documented in the close-out commit body. They cannot be automated in 4.5 because (a) we don't proxy the founder's inbox in test infra, (b) the webhook handler ships in 4.6.

## 8. Open questions for the plan stage

These are details to resolve when writing the implementation plan, not in this design:

- **Workspace import path** — does the agent's tsconfig already resolve `apps/web/src/emails/`, or do we need to add a path alias / a relative import? Resolve in plan Task 1.
- **`TIER_CONFIG` data location** — co-located in `snapshot-to-email-props.ts` vs imported from a shared `types/v2.ts` extension. Recommend co-located until a second consumer appears.
- **`founder_name` env var** — needs adding to the agent's `.env.example` and to `/etc/operscale-calendar/agent.env` on the VPS. Plan Task X documents the manual VPS step.
- **Resend "from" address** — `RESEND_SENDER` is currently `akinwunmi.akinrimisi@operscale.cloud` (founder personal). Spec calls for `noreply@operscale.cloud`. Phase 4.5 keeps the current sender to avoid a Resend domain re-verification side quest; spec divergence is recorded here and addressed in a brand-comms cleanup phase.

## 9. Acceptance criteria

Phase 4.5 is complete when:

1. Vitest suite passes (~226 tests after additions).
2. `tsc --noEmit` clean across both `apps/agent` and `apps/web`.
3. `tsc -p tsconfig.worker.json` clean (worker untouched in 4.5).
4. Live staging smoke passes end-to-end against `https://api.operscale.cloud`:
   - `/approve` returns 200 with `paystack_tx_ref`, `brief_email_sent`, `resend_message_id`.
   - Real email arrives at the founder's inbox with rendered brief content.
   - `orders.status = 'brief_sent'` post-call.
   - Cleanup leaves zero leftovers.
5. The two simulated failure paths verified via the live smoke (one run with intentionally-bad Resend API key → `brief_email_failed`; one run with `amount_ngn = -1` to trip Paystack 4xx → stays `founder_approved`).
6. Plan checkboxes all flipped to `[x]`.
7. Memory `project_state.md` updated; `prompt.md` rewritten as Phase 4.6 handoff.
