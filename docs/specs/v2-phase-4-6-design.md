# V2 Phase 4.6 — Paystack webhook handler — Design

**Status:** approved 2026-05-05. Implementation plan to follow at `docs/plans/2026-05-05-v2-phase-4-6-paystack-webhook.md`.

**Supersedes for the loop-closing slice:** the "Phase 4.6 carry-forwards" memory entry of 2026-05-05 + the 501 stub in `apps/agent/src/app/v1/webhook/paystack/route.ts`.

**Cross-references:**
- `docs/specs/paystack-integration.md` § "Webhook Handler (CRITICAL)" — HMAC-SHA512 on raw body, charge events, idempotency.
- `docs/specs/email-templates.md` § "Template 4: payment-confirmation" — exact body/subject for the new email this phase sends.
- `docs/specs/v2-phase-4-5-design.md` — Phase 4.5 forward path. The webhook this phase handles is fired by Paystack AFTER the customer pays via the URL Phase 4.5 emails them.
- `supabase/migrations/0001_init_schema.sql` § `payments` table — `paystack_event_id NOT NULL UNIQUE` is the idempotency key.

---

## 1. Goal

When a customer completes payment on Paystack's hosted checkout (using the URL Phase 4.5 emailed them), Paystack POSTs a `charge.success` webhook. Phase 4.6's handler verifies the HMAC, records the payment, flips `orders.status` to `paid`, sets `paid_at` + `production_ready_at`, and sends a payment-confirmation email. The forward path closes here; Phase 2 (production) picks up from `production_ready_at`.

## 2. Scope

### In scope

- Replace the `501 not_implemented` stub at `apps/agent/src/app/v1/webhook/paystack/route.ts` with a real handler.
- New `apps/web/src/emails/PaymentConfirmation.tsx` React Email component matching `email-templates.md` § "Template 4" verbatim, **without** the receipt-attachment line (Phase 4.7 adds the PDF + restores the line).
- New pure function `apps/agent/src/lib/payment-confirmation-props.ts::paymentConfirmationProps()` mapping `(charge.success event, Order, Customer) → PaymentConfirmationProps`.
- Extend `apps/agent/src/lib/email.ts::sendEmail()` to support `templateKey === 'payment-confirmation'` (currently only `'brief-email'` is in the allowlist).
- HMAC verification using existing `apps/agent/src/lib/paystack.ts::verifyWebhookSignature`.
- Live staging smoke at `C:\tmp\phase4-6-smoke.py` (NOT committed) covering: Phase 4.5 setup → /approve → manual browser payment with test card → webhook fires → assertions on payments + orders + activity_log + founder inbox.

### Out of scope (deferred)

- **Phase 4.7:** PDF receipt generation (`jsPDF` or similar) + `Resend.attachments` field + restoring the "A receipt is attached" line in the email body.
- **Phase 4.6.1 / WhatsApp:** payment-confirmation WhatsApp via Evolution API. Spec mentions firing both email + WhatsApp on payment success; 4.6 sends email only.
- **Phase 4.6.2 / Recovery cron:** drop-off cron that re-engages customers who initiated payment but didn't complete. Out of 4.6's scope.
- **`charge.failure` re-engagement:** 4.6 logs `payment_failed` but does NOT change order status (customer can retry); the cron-driven recovery is a separate phase.
- **Refund webhooks:** Paystack refunds in Phase 1 are manual via dashboard. We don't subscribe to refund events.
- **Reconciliation cron** (`supabase/functions/paystack-reconciliation/`): nice-to-have, out of 4.6.
- **`payment_initiated` status flip:** Paystack does not emit a "transaction created" webhook for click events. Status remains in CHECK constraint as forward-compat; 4.6 does NOT write it.

### Pre-decided constraints (locked by existing specs/schema)

- **Idempotency on `payments.paystack_event_id`** — already declared `NOT NULL UNIQUE` in `0001_init_schema.sql`. The webhook stub's existing comment block already documents this choice. (`paystack_tx_ref` lives on `orders`, not unique on `payments`.)
- **HMAC-SHA512 on raw body** before any JSON parse. `req.text()` then `JSON.parse(rawBody)` — NOT `req.json()` (which consumes the body stream).
- **Constant-time comparison** via `crypto.timingSafeEqual` (already implemented in `paystack.ts::verifyWebhookSignature`).
- **Cloudflare DNS-only** for `api.operscale.cloud` (NOT proxied) so raw bytes survive. Documented in `paystack-integration.md` and `deployment.md`.
- **Test mode keys only in 4.6** (`PAYSTACK_SECRET_KEY=sk_test_*`).
- **Email template engine:** React Email + `@react-email/components` + `@react-email/render` (already deps in both `apps/agent` and `apps/web` from Phase 4.5).
- **`production_ready_at` flip in 4.6:** column already on `orders`; one-line UPDATE. Phase 2 isn't built but the timestamp is the boundary marker for when it does.

---

## 3. Architecture

```
[Paystack] POST /v1/webhook/paystack
   │  Headers: x-paystack-signature: <hmac-sha512-hex>
   │  Body:    raw bytes (DO NOT parse before HMAC)
   ▼
apps/agent/src/app/v1/webhook/paystack/route.ts (rewritten)
   │  runtime: nodejs (need node:crypto)
   │  dynamic: force-dynamic
   │
   ├─[0] const rawBody = await req.text()        ← raw bytes survive
   │     const sig     = req.headers.get('x-paystack-signature')
   │
   ├─[1] verifyWebhookSignature(rawBody, sig, PAYSTACK_SECRET_KEY)
   │     ↳ false: writeActivityLog(webhook_signature_failed); return 401
   │
   ├─[2] event = JSON.parse(rawBody)             ← only AFTER HMAC verifies
   │
   ├─[3] dispatch by event.event:
   │      • 'charge.success'  → handleChargeSuccess(event)
   │      • 'charge.failure'  → handleChargeFailure(event)
   │      • 'transfer.success' → log + skip (not subscribed semantically)
   │      • <unknown>         → writeActivityLog(webhook_unhandled_event)
   │
   └─[4] return 200 { received: true }            ← inside Paystack's 3s ack budget

handleChargeSuccess(event):
   ├─[a] Idempotency: SELECT payments.id WHERE paystack_event_id=event.id
   │     ↳ found → return (Paystack retried; we already processed)
   ├─[b] SELECT orders WHERE paystack_tx_ref=event.data.reference
   │     ↳ not found → writeActivityLog(webhook_unknown_tx_ref); return
   ├─[c] Amount sanity: if event.data.amount !== order.amount_ngn*100 →
   │     writeActivityLog(webhook_amount_mismatch); STILL PROCESS
   │     (better to record an underpayment than silently drop it)
   ├─[d] INSERT payments {order_id, paystack_event_id, event_type:'charge.success',
   │     amount_ngn: event.data.amount/100, raw_payload: event.data}
   ├─[e] UPDATE orders SET status='paid', paid_at=NOW(),
   │     production_ready_at=NOW()
   ├─[f] writeActivityLog(payment_succeeded, {tx_ref, amount_ngn, payment_method})
   ├─[g] SELECT customer details (full_name, email)
   ├─[h] paymentConfirmationProps(event, order, customer) → props
   ├─[i] render <PaymentConfirmation .../> via @react-email/render → {html, text}
   └─[j] sendEmail({to:customer.email, templateKey:'payment-confirmation', ...})
         ↳ EmailSendError caught: writeActivityLog
           (payment_confirmation_email_failed, {error, tx_ref, paystack_event_id});
           DO NOT throw; return normally (200 to Paystack so it doesn't retry the
           webhook just because the email broke; payment IS recorded)

handleChargeFailure(event):
   ├─ writeActivityLog(payment_failed, {tx_ref, gateway_response, paystack_event_id})
   └─ return (no orders.status change; customer can retry; recovery cron handles)
```

The whole handler is a single route file. No queue, no inter-service hops. The 3s Paystack ack budget is comfortable for the synchronous Resend send (typical 200-500ms).

## 4. Components

### 4.1 `apps/web/src/emails/PaymentConfirmation.tsx` (new)

React Email component. Body matches `email-templates.md` § "Template 4" exactly, except the "A receipt is attached for your records." line is **omitted in 4.6** (Phase 4.7 restores it alongside the PDF).

Props (flat, dumb renderer):

```ts
type PaymentConfirmationProps = {
  firstName: string;
  amountNgn: number;             // whole NGN, NOT kobo
  paymentMethod: string;         // 'card' | 'bank_transfer' | 'ussd' | 'qr' | 'mobile_money' | 'bank'
  paidAtIso: string;             // ISO8601 from Paystack event
  tierName: string;
  videoCount: number;
  carouselCount: number;
  deliveryWindow: string;
  founderWhatsappLink: string;   // https://wa.me/<E.164 minus +>
  founderName: string;
  brandName: string;
};
```

Headings ALL-CAPS in JSX source (Phase 4.5 lesson — `textTransform: 'uppercase'` is stripped by `render(..., {plainText: true})`).

### 4.2 `apps/agent/src/lib/payment-confirmation-props.ts` (new, pure)

```ts
export function paymentConfirmationProps(
  event: PaystackChargeSuccessEvent,
  order: { id: string; tier: Tier; amount_ngn: number },
  customer: { full_name: string | null; email: string },
): PaymentConfirmationProps;
```

Pulls:
- `firstName` ← first whitespace-split token of `customer.full_name`, fallback `'there'` (mirror of Phase 4.5).
- `amountNgn` ← `event.data.amount / 100` (Paystack returns kobo).
- `paymentMethod` ← `event.data.channel` (mapping: `'card'`, `'bank_transfer'`, etc — passthrough).
- `paidAtIso` ← `event.data.paid_at`.
- `tierName`, `videoCount`, `carouselCount`, `deliveryWindow` ← `TIER_DISPLAY[order.tier]` (existing const from `snapshot-to-email-props.ts`).
- `founderWhatsappLink` ← `https://wa.me/${process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP.replace(/^\+/, '')}` (env var `+2348165799032` per master `.env`).
- `founderName`, `brandName` ← env-var fallback (same pattern as Phase 4.5).

Pure: no DB, no fetch.

**Carry-forward from Phase 4.5:** plain relative imports (`from './types/v2'`, `from './post-processor'`); excluded from `tsconfig.worker.json`.

### 4.3 `apps/agent/src/app/v1/webhook/paystack/route.ts` (rewritten)

Replaces the 501 stub. Structure:

```ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyWebhookSignature } from '@/lib/paystack';
import { sendEmail, EmailSendError } from '@/lib/email';
import { paymentConfirmationProps } from '@/lib/payment-confirmation-props';
import { PaymentConfirmation } from '@operscale-calendar/web/emails/PaymentConfirmation';
import { render } from '@react-email/render';
import * as React from 'react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  const secret = process.env.PAYSTACK_SECRET_KEY;
  // ... verification → dispatch → 200
}
```

Two private async helper functions inside the route file (not exported): `handleChargeSuccess(event, supabase)` and `handleChargeFailure(event, supabase)`. Kept inline because the route is small enough; if it grows past ~250 lines, split into `apps/agent/src/lib/paystack-events.ts` (a la the spec doc reference, lines 119-261 of `paystack-integration.md`).

The route uses `@/` aliases for sibling lib files (matches Phase 4 + 4.5 route convention; `@/` resolves natively in Next.js webpack via tsconfig paths).

### 4.4 `apps/agent/src/lib/email.ts` extension

Add `'payment-confirmation'` to `SUPPORTED_TEMPLATES`:

```ts
const SUPPORTED_TEMPLATES: ReadonlyArray<TemplateKey> = [
  'brief-email',
  'payment-confirmation',
];
```

`event_type` derivation already handles this (`'payment-confirmation'.replace(/-/g,'_') + '_sent'` → `'payment_confirmation_sent'`). The 1h activity_log idempotency cache works for any template — no other changes needed.

## 5. State machine (orders.status)

```
pending_founder_review     (form submit)
        │ founder approves
        ▼
founder_approved           (Phase 4 transient)
        │ Paystack init OK + Resend OK
        ▼
brief_sent                 (Phase 4.5 final state — email landed in inbox)
        │ customer clicks Pay → Paystack hosted checkout → success
        │ Paystack POSTs charge.success webhook
        ▼
paid                       (Phase 4.6 final state)
        │ + paid_at, production_ready_at, payment_succeeded activity_log
        │ + payment-confirmation email sent (best-effort)
        │
        │ (Phase 2 picks up from production_ready_at — out of this scope)


Failure / unrelated paths
─────────────────────────
brief_sent + Paystack charge.failure    → log payment_failed; status STAYS brief_sent.
brief_sent + Paystack webhook signature → 401, no state change.
brief_sent + duplicate event_id          → 200 idempotent skip.
brief_sent + amount mismatch             → log + STILL flip to paid; founder reconciles.
brief_sent + unknown tx_ref              → log + 200 (not our order).
paid + Resend confirmation fails          → log payment_confirmation_email_failed;
                                            order STAYS paid; CRM action retries.
```

`payment_initiated` remains in the CHECK constraint as forward-compat. Phase 4.6 does NOT write it.

## 6. Idempotency

Two concentric idempotency boundaries:

1. **`payments.paystack_event_id UNIQUE`** — first line of defense. Paystack retries (same event ID) hit this on the SELECT lookup before INSERT and short-circuit to a 200. Even if multiple webhook attempts race, the UNIQUE constraint at the DB layer prevents double-INSERT.

2. **`sendEmail` 1h activity_log cache** — second line of defense. If somehow the same `charge.success` is processed twice (e.g., a partial-failure retry that crossed the payments INSERT but failed before the email), the cache lookup on `event_type='payment_confirmation_sent' + order_id + occurred_at > now()-1h` returns the cached `resend_message_id` instead of re-sending.

Net effect: every `charge.success` results in **exactly one** payments row, **at most one** orders.status='paid' transition, and **at most one** payment-confirmation email per order per hour.

## 7. Error handling

| Failure mode | HTTP response to Paystack | Side effects |
|---|---|---|
| HMAC signature mismatch | 401 | `writeActivityLog(webhook_signature_failed, {provided_sig, ip})`. No body parse. |
| Missing `PAYSTACK_SECRET_KEY` env | 500 | Server config bug; alerts via Sentry. |
| Duplicate event_id | 200 | Skip processing. |
| Unknown tx_ref | 200 | `writeActivityLog(webhook_unknown_tx_ref, {tx_ref})`. |
| Amount mismatch | 200 | `writeActivityLog(webhook_amount_mismatch, {expected, actual, tx_ref})`. STILL process the payment (record under-payment for founder reconciliation). |
| Unknown event type | 200 | `writeActivityLog(webhook_unhandled_event, {event_type})`. |
| `payments` INSERT fails | 500 | Paystack retries (6× over 24h). Recovery via reconciliation cron (Phase 4.6.2). |
| `orders` UPDATE fails after `payments` INSERT succeeded | 500 | Paystack retries; idempotency skip on next attempt + manual recovery via founder. |
| Resend send fails | 200 | `writeActivityLog(payment_confirmation_email_failed, {error, tx_ref, event_id})`. Payment IS recorded; founder retries email manually (CRM action — Phase 4.5.1+). |
| `charge.failure` event | 200 | `writeActivityLog(payment_failed, {tx_ref, gateway_response, event_id})`. Order status UNCHANGED (customer can retry the same Paystack URL). |
| `transfer.success` event | 200 | Log + skip. We don't initiate transfers in Phase 1 (refunds are manual via dashboard). |

## 8. Test plan

### 8.1 Unit (Vitest, mocked externals)

- `payment-confirmation-props.test.ts` — pure mapping, ~6 tests:
  - happy path (standard tier, all fields populated)
  - firstName fallback when `full_name` is null/empty
  - amountNgn divides kobo correctly (e.g., 27500000 → 275000)
  - all 3 tiers map to correct counts + delivery window
  - `paidAt` ISO passthrough
  - `founderWhatsappLink` strips leading `+` from phone

- `email.test.ts` (extend) — add 1 test asserting `templateKey: 'payment-confirmation'` is now SUPPORTED (was throwing `not_implemented_template`). Existing brief-email tests still pass.

- `webhook/paystack/route.test.ts` (new) — ~10 tests:
  1. 401 on bad HMAC signature; activity log written; raw body NEVER parsed.
  2. 200 on valid signature with `event.event === 'transfer.success'` (skip+log).
  3. 200 on valid signature with unknown event type (log `webhook_unhandled_event`).
  4. 200 on duplicate `paystack_event_id` (idempotent skip — payments table mock returns existing row).
  5. 200 on `charge.success` happy path → mocked supabase asserts: payments INSERT shape, orders UPDATE shape (`status='paid'`, `paid_at`, `production_ready_at` all set), activity_log INSERT, sendEmail called with correct props.
  6. 200 on `charge.success` when sendEmail throws `EmailSendError` → activity log `payment_confirmation_email_failed` written; payments + orders writes still committed; route does NOT throw.
  7. 200 on `charge.failure` → activity log `payment_failed`; no orders UPDATE; no sendEmail.
  8. 200 on amount mismatch (event.amount !== order.amount_kobo) → activity log `webhook_amount_mismatch` AND payments INSERT still happens AND orders flips to `'paid'`.
  9. 200 on unknown `paystack_tx_ref` (orders SELECT returns null) → activity log `webhook_unknown_tx_ref`; no payments INSERT.
  10. Constant-time-compare: assert `verifyWebhookSignature` is called with the raw body bytes (not parsed JSON).

### 8.2 Integration (PaymentConfirmation render)

- `PaymentConfirmation.test.tsx` — 4 tests:
  - HTML render contains all 7 substantive variables (firstName, amountNgn, paymentMethod, paidAt, tierName, videoCount, founderWhatsappLink).
  - Plain-text version retains ALL-CAPS heading "WHAT HAPPENS NEXT".
  - The "A receipt is attached" line is ABSENT (Phase 4.7 will add a test for its presence).
  - Subject preview: `Payment received — your <BrandName> calendar is now in production`.

### 8.3 Live staging smoke (`C:\tmp\phase4-6-smoke.py`, NOT committed)

1. **Setup** (reuse Phase 4.5 fixture): INSERT customer (real email — `akinolaakinrimisi+phase4-6-smoke@gmail.com`) + brief + order at `pending_founder_review`.
2. POST `/v1/brief/analyze` → poll to `completed`.
3. POST `/v1/brief/approve` → 200 with paystack_tx_ref + paystack_authorization stored.
4. **Manual step**: open `paystack_authorization.authorizationUrl` in a browser. Complete payment with test card `4084 0840 8408 4081`, CVV any 3 digits, expiry any future date. (Documented in commit body.)
5. Wait 5-15s for Paystack to fire the `charge.success` webhook to `https://api.operscale.cloud/v1/webhook/paystack`.
6. SELECT `payments` WHERE `order_id=$ORDER_ID` → assert exactly 1 row with:
   - `event_type='charge.success'`
   - `paystack_event_id` non-null
   - `amount_ngn=275000` (or whatever the order's amount was)
7. SELECT `orders` WHERE `id=$ORDER_ID` → assert:
   - `status='paid'`
   - `paid_at IS NOT NULL`
   - `production_ready_at IS NOT NULL`
8. SELECT `activity_log` WHERE `order_id=$ORDER_ID AND event_type='payment_succeeded'` → assert 1 row.
9. SELECT `activity_log` WHERE `order_id=$ORDER_ID AND event_type='payment_confirmation_sent'` → assert 1 row with `payload->>'resend_message_id'` non-null.
10. **Manual step**: check the founder's `+phase4-6-smoke@gmail.com` inbox for the rendered payment-confirmation email.
11. Cleanup test rows (orders, payments, briefs, customers, analysis_runs, ai_analysis_jobs, customer_framework_history, activity_log).

The two manual steps (browser payment + inbox check) are documented in the close-out commit body. They cannot be automated in 4.6 because (a) Paystack hosted checkout requires browser-driven 3DS-style interaction, (b) we don't proxy the founder's inbox.

## 9. Acceptance criteria

Phase 4.6 is complete when:

1. Vitest suite passes (~270 tests after additions: 249 baseline + ~21 new across props/email/route/PaymentConfirmation tests).
2. `tsc --noEmit` clean across `apps/agent` and `apps/web`.
3. `tsc -p tsconfig.worker.json` clean (worker untouched in 4.6).
4. Live staging smoke passes end-to-end against `https://api.operscale.cloud`:
   - Manual browser payment completes on Paystack hosted checkout.
   - Webhook fires within 15s and is received with valid HMAC.
   - `payments` row written, `orders.status='paid'`, both timestamps set.
   - `activity_log` shows `payment_succeeded` + `payment_confirmation_sent` events.
   - Founder inbox receives the rendered payment-confirmation email.
5. The forward-error path verified: temporarily-bad HMAC (e.g., flip the signing secret on the agent's env) returns 401 + writes `webhook_signature_failed`.
6. Plan checkboxes all flipped to `[x]`.
7. Memory `project_state.md` updated; `prompt.md` rewritten as Phase 5 (CRM) handoff per the user's confirmed prioritisation.
