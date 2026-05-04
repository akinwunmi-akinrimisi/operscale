# Spec: Paystack integration

Phase 1's payment processing. NGN-only, hosted-checkout, webhook-driven. We use Paystack because it's the most reliable Nigerian payment gateway, the developer experience is decent, and it lets us avoid PCI scope (cards never touch our servers).

If you're touching `apps/agent/src/api/v1/payment/initialize/route.ts` or `apps/agent/src/api/v1/webhook/paystack/route.ts` or `apps/agent/src/lib/paystack.ts`, read this whole document first. Webhook signature verification is the single most security-critical piece of the integration.

## What we use Paystack for

- One-off payments in NGN. No subscriptions in Phase 1.
- Hosted checkout. Customers redirect to Paystack's domain, complete payment there, redirect back.
- Webhook-driven order state machine. We don't poll; Paystack tells us when something happens.
- Manual refunds via the Paystack dashboard, with CRM marking after the fact.

We do NOT use Paystack for:

- Storing card data (it's hosted-checkout — we never see cards).
- Customer profiles. Each transaction is independent.
- Saving cards for re-charge. Phase 1 doesn't have repeat customers within the timeframe to justify it.
- Subscriptions. Out of scope for Phase 1.

## Account setup

1. Paystack business account at paystack.com (business mode, NGN settlement currency).
2. BVN-verified for the business owner.
3. Settlement bank account configured (settlement is T+1 by default).
4. Test mode keys generated. Live mode keys generated only at Day 15 of build (right before launch).
5. Webhook URL configured in Paystack dashboard: `https://api.operscale.cloud/v1/webhook/paystack` (DNS-only, not Cloudflare-proxied — see `architecture.md`).
6. Webhook events subscribed: `charge.success`, `charge.failure`, `transfer.success` (we don't use the last but enable it for future reconciliation).

### Test cards (for development)

Paystack provides test cards for various scenarios:

- Success: `4084 0840 8408 4081`, CVV any 3 digits, expiry any future date.
- Insufficient funds: `4084 0840 8408 4081` with PIN `0000` triggers decline.
- 3DS challenge: separate test card per Paystack docs.

We use these throughout the Day 7-14 testing windows. Live keys swap in only after end-to-end test passes on test mode.

## Initialise transaction

When the customer clicks "Pay Now" in the brief email, the link points to a Paystack URL. We initialise the transaction first via the API to embed metadata.

### Endpoint

`POST /v1/payment/initialize`

Server-side only. Triggered when the brief email's "Pay Now" link is generated (during `/v1/brief/approve`).

### Request to Paystack

```typescript
const response = await fetch('https://api.paystack.co/transaction/initialize', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: customer.email,
    amount: order.amount_kobo,  // amount in kobo (NGN × 100)
    currency: 'NGN',
    reference: order.paystack_tx_ref,  // we generate this; format: 'ops-cal-{order_id}-{timestamp}'
    callback_url: `https://${BRAND_DOMAIN}/payment/return?order_id=${order.id}`,
    metadata: {
      order_id: order.id,
      customer_id: order.customer_id,
      tier: order.tier,
      brief_id: order.brief_id,
    },
    channels: ['card', 'bank_transfer', 'ussd', 'qr', 'mobile_money', 'bank'],
  }),
});

const json = await response.json();
const checkoutUrl = json.data.authorization_url;
```

### Reference scheme

`paystack_tx_ref` follows the format: `ops-cal-{order_id_short}-{unix_ts}`. Example: `ops-cal-7a8f3e2b-1714742400`.

We pre-generate this and persist on the order BEFORE calling Paystack. This makes the call idempotent — if we crash after Paystack accepts but before we save, we can recover by re-querying Paystack with our reference.

### Response handling

If Paystack returns 200 with `data.authorization_url`, we use that URL in the email. If Paystack errors, we surface a "payment system temporarily unavailable" message in the brief email and alert founder.

### Amount in kobo

The `amount` field on Paystack is in **kobo** (1 NGN = 100 kobo). Always multiply by 100 before sending. Always divide by 100 when displaying. Never confuse the two.

```typescript
// CORRECT
const amountKobo = order.amount_ngn * 100;

// WRONG — sends ₦27,500 instead of ₦275,000
const amountKobo = order.amount_ngn;
```

## Webhook handling — the security-critical piece

When the customer completes payment, Paystack POSTs a webhook to our endpoint. We must:

1. Verify the HMAC-SHA512 signature on the raw body, BEFORE any JSON parsing.
2. Reject with 401 if the signature doesn't match.
3. Idempotency-check by `paystack_tx_ref` UNIQUE.
4. Process the event.
5. Return 200 within 3 seconds.

### Implementation

`apps/agent/src/api/v1/webhook/paystack/route.ts`:

```typescript
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { handlePaystackEvent } from '@/lib/paystack-events';

export async function POST(req: NextRequest) {
  // CRITICAL: read raw body BEFORE any JSON parsing.
  // Re-parsing reformats whitespace and breaks HMAC.
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';

  // Compute HMAC-SHA512 of raw body using secret key.
  const computed = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks.
  const sigBuf = Buffer.from(signature, 'hex');
  const compBuf = Buffer.from(computed, 'hex');
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
    // Log signature mismatch for ops alert.
    await logSecurityEvent('webhook_signature_failed', {
      provided_signature: signature,
      computed_signature: computed,
      ip: req.headers.get('x-forwarded-for'),
    });
    return new Response('', { status: 401 });
  }

  // Parse and dispatch.
  const event = JSON.parse(rawBody);
  await handlePaystackEvent(event);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### Why we read the raw body twice

We read `await req.text()` once. We then `JSON.parse(rawBody)` ourselves, NOT use `req.json()`. This is because:

- Calling `req.json()` consumes the body stream — we can't read it again.
- The HMAC is computed on the exact bytes Paystack sent. If we let Next.js parse and re-stringify, whitespace differences break the HMAC.
- The order of operations is non-negotiable: text → verify → JSON.parse.

### Constant-time comparison

`crypto.timingSafeEqual` prevents timing attacks where an attacker tries to learn the signature byte-by-byte. The plain `===` comparison short-circuits on the first mismatched character, leaking timing info. `timingSafeEqual` always reads all bytes.

### What if signature mismatch is legitimate?

Most likely causes of mismatch:

1. We're using the wrong secret key (test vs live mismatch).
2. Paystack rotated their webhook secret (rare).
3. A proxy is mangling the body (Cloudflare proxy on the webhook subdomain — that's why the webhook subdomain is DNS-only).
4. Genuine attempted spoofing.

For (1) and (2), we update env and redeploy. For (3), we fix DNS. For (4), we log and review.

## Event handling

### `charge.success`

The happy path. Customer paid, money settled (or pending settlement) at Paystack.

Handler:

```typescript
async function handleChargeSuccess(event: PaystackEvent) {
  const data = event.data;
  const txRef = data.reference;

  // Idempotency: lookup by paystack_tx_ref.
  const existing = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('paystack_tx_ref', txRef)
    .maybeSingle();

  if (existing.data) {
    // Already processed. Return success — Paystack just retried.
    return;
  }

  // Find the order.
  const order = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, amount_kobo, status')
    .eq('paystack_tx_ref', txRef)
    .single();

  if (order.error) {
    // Webhook fired for a tx_ref we don't recognise. Log and skip — don't error.
    await logSecurityEvent('webhook_unknown_tx_ref', { tx_ref: txRef });
    return;
  }

  // Verify amount matches what we expected.
  if (data.amount !== order.data.amount_kobo) {
    await logSecurityEvent('webhook_amount_mismatch', {
      order_id: order.data.id,
      expected: order.data.amount_kobo,
      actual: data.amount,
    });
    // Still process — better to record an underpayment than silently drop it.
    // Founder reconciles manually.
  }

  // Insert payment row.
  await supabaseAdmin.from('payments').insert({
    order_id: order.data.id,
    paystack_tx_ref: txRef,
    amount_kobo: data.amount,
    currency: data.currency,
    payment_method: data.channel,  // 'card', 'bank_transfer', etc.
    status: 'paid',
    paystack_paid_at: data.paid_at,
    webhook_payload: data,  // full payload for audit
  });

  // Update order.
  await supabaseAdmin
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', order.data.id);

  // Activity log.
  await supabaseAdmin.from('activity_log').insert({
    order_id: order.data.id,
    customer_id: order.data.customer_id,
    event_type: 'payment_succeeded',
    payload: { tx_ref: txRef, amount_kobo: data.amount },
  });

  // Fire side-effects: confirmation email, WhatsApp.
  await sendPaymentConfirmationEmail(order.data.customer_id, order.data.id);
  await sendPaymentConfirmationWhatsApp(order.data.customer_id, order.data.id);

  // Phase 2 handoff: set production_ready_at.
  await supabaseAdmin
    .from('orders')
    .update({ production_ready_at: new Date().toISOString() })
    .eq('id', order.data.id);
}
```

### `charge.failure`

The customer attempted to pay and the payment was declined (insufficient funds, expired card, 3DS failure).

Handler logs the event. Does NOT change the order's status from `payment_initiated` (the customer can retry). Does fire a recovery WhatsApp at +2h if they don't try again.

```typescript
async function handleChargeFailure(event: PaystackEvent) {
  const data = event.data;
  const txRef = data.reference;

  await supabaseAdmin.from('activity_log').insert({
    event_type: 'payment_failed',
    order_id: /* lookup by tx_ref */,
    payload: { reason: data.gateway_response, tx_ref: txRef },
  });

  // Order status unchanged — customer may retry. Drop-off cron will pick up at +2h.
}
```

### Other events

- `transfer.success`: we don't initiate transfers (refunds are manual via dashboard). Log and skip.
- Anything we don't recognise: log as `webhook_unhandled_event`, return 200 (don't make Paystack think we're broken).

## Idempotency in detail

### Why it matters

Paystack can send the same webhook multiple times — on initial delivery, on retry if our endpoint returned non-200, on manual replay from their dashboard. We MUST handle this without double-processing.

### The mechanism

`payments.paystack_tx_ref UNIQUE`. The handler checks for existing first. If it exists, return success without doing anything else.

### What about partially-processed webhooks?

If we crash after inserting the `payments` row but before updating the order, we have a payment without a paid order. On webhook retry:

- Lookup `payments` by tx_ref → found, return success.
- The order is still in `payment_initiated`.

This is a bug. Mitigation: wrap payment insert + order update + activity_log + side-effects in a single transaction where possible. The side-effects (email, WhatsApp) can't be in a DB transaction, but we run them AFTER the DB transaction commits, with their own retry logic.

If this race actually happens, the order shows `payment_initiated` in CRM despite money having moved. Founder catches in their daily review. We update the order manually.

## Refund flow

Refunds in Phase 1 are manual.

### Process

1. Customer requests refund (or founder decides to refund).
2. Founder logs into Paystack dashboard, finds the transaction by reference.
3. Founder issues refund through Paystack UI. Paystack handles the actual money movement.
4. Paystack sends a webhook (we don't subscribe to refund events in Phase 1, so nothing automated).
5. Founder returns to CRM, opens the order, clicks "Mark as refunded".
6. Modal: founder enters refund_reason (free text).
7. Order status → `refunded`. Payment row updated: `status = 'refunded'`, `refunded_at = now()`, `refund_reason = '...'`.
8. Activity log entry.

### Why manual

Phase 1 volume is low (target ~30 paid orders/day max). Manual refund handling lets the founder ensure each refund is justified before processing. Phase 2 may automate.

### Reconciliation

A weekly job (cron at 09:00 every Monday) pulls Paystack's transaction list for the past 7 days and compares against our `payments` table. If Paystack shows refunds we haven't marked, the job sends a reconciliation report to the founder via email.

Implementation: `supabase/functions/paystack-reconciliation/`. Phase 1 nice-to-have; can be skipped if pressed for time.

## Refund policy (customer-facing)

In `operscale.cloud/terms`:

```
Refunds: We offer a full refund if you request it before production starts on
your calendar. Once production has begun, refunds are evaluated case-by-case.
Email refunds@operscale.cloud within 24 hours of payment to request a refund.
```

In Phase 1, "production has begun" doesn't apply — Phase 2 isn't built yet. Practically: any refund request in Phase 1 gets a full refund.

## Error scenarios

| Scenario | Detection | Handling |
| --- | --- | --- |
| Customer pays, webhook lost | Paystack delivered but our server was down | Paystack retries 6 times over 24h. If still missing, weekly reconciliation catches. |
| Webhook signature fails | Constant 401 in handler logs | If genuine attack: block IP at Cloudflare. If env mismatch: rotate keys. |
| Customer pays twice (two cards / bank attempts) | Two `payments` rows, same `order_id`, different tx_ref | First wins; second is duplicate. Founder refunds the second within 24h. |
| Wrong amount paid | `webhook_amount_mismatch` log entry | Founder contacts customer; either refund difference or deliver downgraded tier |
| Network failure during initialise | We saved tx_ref but Paystack didn't return URL | Retry initialise once; on second failure, surface error in brief email and alert founder |
| Customer pays in test mode (live launch hasn't happened yet) | Tx amount in test currency context | Refuse to mark order paid; redirect to live URL |

## What this spec does NOT cover

- Subscription billing / recurring charges. Out of scope.
- Saved cards / "pay with saved card" flow. Out of scope.
- Multi-currency. NGN only.
- Split payments / marketplace flows. Out of scope.
- Payment Plans / instalments via Paystack. Out of scope.

## Where to look next

- `docs/security.md` — broader webhook security context.
- `docs/data-model.md` — `orders`, `payments` schema details.
- `apps/agent/src/lib/paystack.ts` — the wrapper library.
- `apps/agent/src/api/v1/payment/initialize/route.ts` — the init endpoint.
- `apps/agent/src/api/v1/webhook/paystack/route.ts` — the webhook handler.
- `supabase/functions/paystack-reconciliation/` — weekly reconciliation cron (if built).
