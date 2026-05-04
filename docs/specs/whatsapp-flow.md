# Spec: WhatsApp flow (Evolution API)

WhatsApp messaging in Phase 1 — payment confirmation, drop-off recovery, founder alerts. We use the existing Evolution API instance running on the same VPS as Vision GridAI.

## What we use WhatsApp for

- **Customer-facing:** payment confirmation (within 90s of `charge.success`), payment recovery (at +2h on incomplete payment).
- **Founder-facing:** alerts when briefs sit unreviewed > 2h, when AI analysis fails 5x, when webhook signatures fail.

We do NOT use WhatsApp for:
- Initial customer outreach (cold messaging is a trust killer in Nigeria — opt-in only).
- Brief delivery (email is the canonical channel).
- Long-form support (founder messages from personal WhatsApp for that, after the customer has paid).

## Evolution API setup

Existing Evolution API instance: `https://evolution.srv1297445.hstgr.cloud`. Same instance that VG uses.

For the calendar service, we create a new instance/connection within Evolution: `operscale-calendar`. This instance reuses the founder's connected WhatsApp Business number. The instance separation is for telemetry (so we know which messages came from which service).

### Configuration (one-off)

1. Log into the Evolution API admin.
2. Create instance `operscale-calendar`.
3. Connect the founder's WhatsApp Business number via QR code (one-time scan).
4. Set webhook URL: `https://api.operscale.cloud/v1/webhook/evolution` for delivery status events.
5. Generate API key for this instance, store in agent `.env` as `EVOLUTION_API_KEY`.

## Sender wrapper

`apps/agent/src/lib/evolution.ts`:

```typescript
const EVOLUTION_BASE = process.env.EVOLUTION_API_BASE!;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!;
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME!;

export async function sendWhatsApp(opts: {
  to: string;       // E.164 format, e.g. "+2348012345678"
  body: string;
  retry?: number;   // default 3
}) {
  const phone = normaliseE164(opts.to);

  for (let attempt = 0; attempt < (opts.retry ?? 3); attempt++) {
    try {
      const response = await fetch(`${EVOLUTION_BASE}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: { 'apikey': EVOLUTION_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone.replace('+', ''), text: opts.body }),
      });

      if (response.ok) {
        const json = await response.json();
        return { ok: true, message_id: json.key.id };
      }

      if (response.status === 429) {
        await sleep(2 ** attempt * 1000);  // exponential backoff
        continue;
      }

      // 4xx errors don't retry
      if (response.status < 500) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
    } catch (err) {
      if (attempt === (opts.retry ?? 3) - 1) throw err;
      await sleep(2 ** attempt * 1000);
    }
  }

  return { ok: false, error: 'max retries exceeded' };
}
```

### Phone number normalisation

Customer-entered WhatsApp numbers come in many formats: `08012345678`, `+2348012345678`, `2348012345678`, `+234 801 234 5678`.

Normaliser:

```typescript
function normaliseE164(input: string): string {
  // Strip all non-digit characters except leading +
  let digits = input.replace(/[^\d+]/g, '');

  // If no +, assume Nigerian number and add +234
  if (!digits.startsWith('+')) {
    if (digits.startsWith('234')) {
      digits = '+' + digits;
    } else if (digits.startsWith('0')) {
      digits = '+234' + digits.slice(1);
    } else {
      digits = '+234' + digits;
    }
  }

  return digits;
}
```

We log the original AND normalised forms so we can debug delivery failures.

## Templates

### Template 1: payment-confirmation

Trigger: Paystack `charge.success` webhook, after order is updated to `paid`. Fired within 90 seconds.

Body:

```
Hi {{first_name}}, payment confirmed for your {{tier_name}} package — ₦{{amount_ngn}} received.

Your calendar is now in production. You'll receive your full delivery within {{delivery_window}}.

I'll message you when delivery is ready. Reply here if you need anything in the meantime.

— {{founder_name}}
```

### Template 2: payment-recovery

Trigger: Order in `payment_initiated` state for > 2h, no `paid_at`. Cron runs every 30 minutes.

Body:

```
Hi {{first_name}}, saw you started checkout for your {{tier_name}} package but didn't complete payment.

Need a hand? Common reasons people pause:
- Card declined → bank transfer or USSD might be easier
- Wanted to think it over → totally fine, payment link still works

Your link: {{payment_link}}

Reply here if anything's blocking you.

— {{founder_name}}
```

### Template 3: delivery-ready (Phase 2 — included for forward-compat)

Trigger: Phase 2 completes a delivery. Out of Phase 1 scope; placeholder.

## Founder alerts (internal)

When a founder-facing event triggers a WhatsApp:

```
[Operscale Calendar Alert]
{{event_type}}
{{detail}}

Open CRM: https://operscale.cloud/admin/orders/{{order_id}}
```

Events that trigger founder alerts:

- `brief_unreviewed_2h` — brief in `pending_founder_review` for > 2h during business hours.
- `ai_analysis_failed` — Claude API failed 5 times.
- `webhook_signature_failed` — Paystack webhook signature failed (potential probe).
- `payment_amount_mismatch` — Paystack paid amount doesn't match expected.
- `email_send_failed` — Resend failed 5 times for a customer-facing email.
- `whatsapp_send_failed` — WhatsApp send failed 3 times.
- `paystack_webhook_unknown_tx_ref` — webhook fired for a tx_ref we don't recognise.

All sent to the founder's number from env `NEXT_PUBLIC_FOUNDER_WHATSAPP`.

## Idempotency

Each WhatsApp send writes to `activity_log` with `event_type = 'whatsapp_sent'` and the Evolution message_id. Before sending the same template to the same number for the same order, we check activity_log for a recent send (within 1 hour for confirmations, 24 hours for recovery).

## Failure handling

| Failure | Retry | Final fallback |
| --- | --- | --- |
| 5xx from Evolution API | 3 attempts, exponential backoff | Mark `whatsapp_failed`, log to founder alert (the alert itself doesn't go via WhatsApp to avoid loop — uses email instead) |
| 4xx (invalid number, not on WhatsApp) | 0 retries | Log, surface in CRM. Customer's email is canonical channel anyway. |
| Evolution API instance disconnected (QR session expired) | n/a | Founder gets email alert. Manual reconnect via QR scan. |

## Inbound (customer replies)

Evolution API webhooks fire on inbound messages. We:

1. Verify webhook signature (Evolution signs payloads).
2. Parse the from number and message body.
3. Match to customer by WhatsApp number. If multiple matches (rare), surface in CRM for manual disambiguation.
4. Insert into `customer_messages` table:
   ```sql
   INSERT INTO customer_messages (customer_id, order_id, direction, channel, body, raw_payload)
   VALUES (..., 'inbound', 'whatsapp', '...', ...);
   ```
5. Surface in CRM Order Detail timeline.
6. Founder reads in CRM, replies via personal WhatsApp app (Phase 1 doesn't have an in-CRM reply UI).

## Privacy considerations

- WhatsApp numbers are personal data under NDPC. Same retention rules as other customer data.
- We log message metadata (timestamps, message IDs, delivery status) but NOT message bodies in our application logs (the bodies live in `customer_messages` table which is RLS-locked).
- Inbound messages are stored. If the customer requests deletion, all `customer_messages` rows for them are deleted alongside the rest.

## What this spec does NOT cover

- WhatsApp Business API (the Meta-direct flavor). We use Evolution which is a self-hosted bridge.
- WhatsApp templates / template approval (not needed because we send from a real WhatsApp Business connection, not the API).
- Bulk messaging campaigns. Out of scope.
- Customer opt-out preferences. Phase 1 sends only on transaction events; opt-out is implicit (don't be a customer). Phase 2 may need explicit opt-out for marketing messages.

## Where to look next

- `apps/agent/src/lib/evolution.ts` — sender wrapper.
- `apps/agent/src/api/v1/webhook/evolution/route.ts` — inbound handler.
- `docs/specs/email-templates.md` — paired email templates.
- `docs/security.md` — webhook security context.
