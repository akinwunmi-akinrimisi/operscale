# Spec: email templates

Phase 1 has 7 customer-facing email templates plus 1 founder-facing template. All sent via Resend. All rendered using React Email (`@react-email/components`). All have explicit triggers, idempotency keys, and retry rules.

## Templates inventory

| Template | Trigger | Latency target | Retries | Owner |
| --- | --- | --- | --- | --- |
| `auto-ack` | Form submit | < 30s | 5 | agent |
| `save-token` | Form step 3 complete | < 60s | 3 | agent |
| `brief-email` | Founder approve | < 30s after approve | 5 | agent |
| `payment-confirmation` | Paystack `charge.success` | < 60s after webhook | 5 | agent |
| `recovery-form` | Form draft 24h stale | within 1h of cron tick | 3 | edge fn |
| `recovery-brief` | Brief sent, unpaid 6h | within 1h of cron tick | 3 | edge fn |
| `recovery-payment` | Paystack init, unpaid 24h | within 1h of cron tick | 3 | edge fn |
| `magic-link` (admin) | Founder login attempt | < 30s | 3 | Supabase auth |

All customer-facing emails come from `noreply@operscale.cloud`. Magic links come from `auth@operscale.cloud`.

## Setup

### Resend account

- Domain: `operscale.cloud` verified in Resend (DKIM, SPF, DMARC records added at Cloudflare).
- API key: in agent `.env` only.
- Webhook for inbound and bounce events: configured to `https://api.operscale.cloud/v1/webhook/resend-inbound`.

### React Email components

```bash
pnpm add -D @react-email/components @react-email/render
```

Templates live at `apps/web/src/emails/<TemplateName>.tsx`. Each is a React component that returns the email body.

### Sender wrapper

`apps/agent/src/lib/email.ts`:

```typescript
import { Resend } from 'resend';
import { render } from '@react-email/render';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  template: React.ReactElement;
  reply_to?: string;
  tags?: { name: string; value: string }[];
}) {
  const html = await render(opts.template);
  const text = await render(opts.template, { plainText: true });

  const result = await resend.emails.send({
    from: 'Operscale <noreply@operscale.cloud>',
    to: opts.to,
    subject: opts.subject,
    html,
    text,
    reply_to: opts.reply_to,
    tags: opts.tags,
  });

  return result;
}
```

Idempotency: every send logs the Resend message ID to `activity_log`. We check `activity_log` for a recent send of the same template + customer + order before re-sending.

## Template 1: auto-ack

### Trigger

Form submitted (server-side, after orders row insert succeeds).

### Subject

```
Got your Operscale brief — personalised version coming within an hour
```

### Body structure

```
Hi {{first_name}},

Got your brief at {{wat_timestamp}}. Here's what happens next:

✓  Brief received
   (just now)

→  Personalised brief from our team
   (within the next hour during business hours,
    or by 9 AM tomorrow if you submitted late evening Lagos time)

→  Payment & production
   (you decide if our personalised brief lines up — if it does, payment link
    is in the email itself. Production starts within minutes of payment.)

You picked the {{tier_name}} package — {{video_count}} videos and
{{carousel_count}} carousels, delivered in {{delivery_window}}.

Need to add anything to your brief? Reply to this email or message me directly:
{{founder_whatsapp_link}}.

If you uploaded photos, here's a quick reminder: they're stored privately,
and automatically deleted 90 days after your final delivery.

Talk soon,
{{founder_name}}
{{brand_name}}
```

### Variables

- `first_name` — derived from form's customer name (split on whitespace, take first part). Fallback to "there".
- `wat_timestamp` — submission time formatted in WAT.
- `tier_name`, `video_count`, `carousel_count`, `delivery_window` — looked up from tier config based on form's tier choice.
- `founder_whatsapp_link` — `https://wa.me/{founder_whatsapp_number}`. Pre-filled with "Hi, I just submitted a brief for {business_name}".
- `founder_name`, `brand_name` — from env.

### Plain-text version

The text version uses the same content with formatting removed. React Email's `render` with `plainText: true` handles this.

### Footer

Standard email footer (mandatory):

```
Operscale Limited
Privacy: operscale.cloud/privacy   Terms: operscale.cloud/terms
NDPC Registration: {ndpc_reg_number}
```

## Template 2: save-token

### Trigger

Customer completes form step 3 (the first server-persisted step). Fires once per save token.

### Subject

```
Your Operscale brief draft is saved
```

### Body structure

```
Hi {{first_name}},

You've started your {{tier_name}} brief. Your draft is saved — pick it up
where you left off:

→ {{resume_url}}

This link works on any device. Your draft is held for 7 days.

If you didn't start this brief, you can ignore this email; nothing happens
without your action.

— Operscale
```

### Variables

- `first_name` — from form's customer name.
- `tier_name` — from tier choice.
- `resume_url` — `https://operscale.cloud/brief/{save_token}`.

## Template 3: brief-email

### Trigger

Founder clicks "Approve and send" in the CRM. The materialised AI snapshot is the data source.

### Subject

```
Your Operscale calendar brief is ready — {{tier_name}}, {{video_count}} videos
```

### Body structure

```
Hi {{first_name}},

Here's your personalised content brief.

WHAT WE HEARD
{{brief_summary}}

3 ANGLES WE'D OPEN THE CALENDAR WITH

1. {{angle_1}}
   Hook: {{hook_1}}
   Why this works for you: {{why_it_fits_1}}

2. {{angle_2}}
   Hook: {{hook_2}}
   Why this works for you: {{why_it_fits_2}}

3. {{angle_3}}
   Hook: {{hook_3}}
   Why this works for you: {{why_it_fits_3}}

A TASTE OF HOW THE FIRST VIDEO WOULD LAND

Topic: {{video_1_topic}}

The first 1.5 seconds: "{{video_1_hook}}"

The 30-second arc:
- {{outline_1}}
- {{outline_2}}
- {{outline_3}}

THE VISUAL DIRECTION WE HAVE IN MIND

{{visual_style.recommended_camera_treatment}}

Captions: {{visual_style.recommended_caption_style}}

{{#if photos_uploaded}}
A note on your reference photos: {{photo_aesthetic.recommended_avatar_treatment}}
{{/if}}

YOUR PACKAGE

{{tier_name}} — ₦{{price_ngn}}
{{video_count}} short-form videos ({{ugc_count}} with you on camera, {{t2v_count}} cinematic)
{{carousel_count}} carousels ({{carousel_pages}} image cards total)
Delivered in {{delivery_window}}.

{{#if should_upsell}}
ONE THOUGHT — would the {{recommended_tier}} package be a better fit?

{{upsell_reasoning}}

That's an extra ₦{{upsell_price_delta}}, totalling ₦{{recommended_tier_price}}.
You can choose either tier on the payment page.
{{/if}}

NEXT STEP

Pay securely via Paystack:

→ {{payment_link}}

If anything in this brief doesn't quite fit, just reply to this email
with what you'd change. No need to pay yet.

— {{founder_name}}
{{brand_name}}
```

### Conditional rendering

- The "note on your reference photos" block renders only if photos were uploaded.
- The upsell block renders only if `upsell_recommendation.should_upsell == true`.

### React Email implementation

```tsx
// apps/web/src/emails/BriefEmail.tsx
import { Html, Head, Body, Section, Heading, Text, Button, Hr } from '@react-email/components';

export default function BriefEmail({
  firstName,
  briefSummary,
  angles,
  scriptSeed,
  visualStyle,
  photoAesthetic,
  tierName,
  priceNgn,
  videoCount,
  carouselCount,
  ugcCount,
  t2vCount,
  carouselPages,
  deliveryWindow,
  shouldUpsell,
  upsellRec,
  paymentLink,
  founderName,
  brandName,
}: BriefEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Section>
          <Text>Hi {firstName},</Text>
          <Text>Here's your personalised content brief.</Text>
        </Section>
        <Section>
          <Heading as="h2">WHAT WE HEARD</Heading>
          <Text>{briefSummary}</Text>
        </Section>
        {/* ... etc */}
      </Body>
    </Html>
  );
}
```

### Send flow

```typescript
const snapshot = materialiseEdits(currentRun, edits);
const emailComponent = <BriefEmail {...snapshotToProps(snapshot, order)} />;

const sendResult = await sendEmail({
  to: customer.email,
  subject: `Your ${BRAND_NAME} calendar brief is ready — ${tierName}, ${videoCount} videos`,
  template: emailComponent,
  reply_to: 'founder@operscale.cloud',
  tags: [
    { name: 'template', value: 'brief-email' },
    { name: 'order_id', value: order.id },
  ],
});

await activityLog({
  event_type: 'brief_email_sent',
  order_id: order.id,
  customer_id: customer.id,
  payload: { resend_message_id: sendResult.data.id, snapshot },
});
```

## Template 4: payment-confirmation

### Trigger

Paystack `charge.success` webhook fires.

### Subject

```
Payment received — your Operscale calendar is now in production
```

### Body structure

```
Hi {{first_name}},

Payment confirmed. ₦{{amount_ngn}} received via {{payment_method}} at {{paid_at}}.

Your {{tier_name}} package is now in production.

WHAT HAPPENS NEXT
- We start producing your {{video_count}} videos and {{carousel_count}} carousels.
- You'll receive your full delivery within {{delivery_window}}.
- I'll WhatsApp you when delivery is ready.

A receipt is attached for your records.

Questions? Reply directly or message me on WhatsApp:
{{founder_whatsapp_link}}.

— {{founder_name}}
{{brand_name}}
```

### Receipt attachment

PDF receipt generated using the `pdf` skill or jsPDF. Contents:

- Header with brand
- Customer details (name, email)
- Order ID
- Tier and breakdown
- Amount paid
- Payment method
- Paystack reference
- Date / WAT timestamp
- NDPC registration number
- "Tax invoice" caveat (we add a TIN once registered for VAT — Phase 2 concern)

Attachment generated server-side at the time of email send.

## Template 5: recovery-form (24h stale draft)

### Trigger

Cron Edge Function `drop-off-recovery` runs every 30 minutes. For each `briefs` row where:

- `submitted_at IS NULL`
- `current_step >= 3` (saved past the save-token step)
- `last_updated_at < now() - 24h`
- No `recovery_form_sent` event in `activity_log` for this brief

Send the recovery email.

### Subject

```
Your Operscale brief draft — pick up where you left off?
```

### Body structure

```
Hi {{first_name}},

You started a brief for {{business_name}} yesterday and saved your progress at
step {{step_number}} of 7. Your draft is still here:

→ {{resume_url}}

If something's blocking you from finishing, just reply with what you'd change
and I'll help.

— Operscale
```

## Template 6: recovery-brief (6h stale brief)

### Trigger

Order is in `brief_sent` state but `paid_at IS NULL` and `brief_email_sent_at < now() - 6h`. No recovery_brief_sent event.

### Subject

```
Quick reminder — your Operscale brief and payment link
```

### Body structure

```
Hi {{first_name}},

Sent your personalised brief 6 hours ago. Just resending the payment link
in case it got buried.

Your {{tier_name}} package: ₦{{price_ngn}}

→ {{payment_link}}

If anything in the brief doesn't sit right, reply with what you'd change.
Happy to revise.

— {{founder_name}}
```

## Template 7: recovery-payment (24h stale init)

### Trigger

Order is in `payment_initiated` state but `paid_at IS NULL` and the most recent `payment_initiated` activity_log event is > 24h old. No recovery_payment_sent event.

This template is for cases where the customer started Paystack checkout but didn't complete and didn't try again. The +2h WhatsApp is the first nudge; this email is the follow-up.

### Subject

```
Need a hand with payment for your Operscale calendar?
```

### Body structure

```
Hi {{first_name}},

Saw you started checking out yesterday but didn't complete payment.

Common reasons people pause here:
- Card declined → bank transfer or USSD might be easier
- Wanted to think it over → totally fine, the payment link is still active
- Had questions → just reply, I'm right here

Your link: {{payment_link}}

— {{founder_name}}
```

## Template 8: magic-link (admin auth)

This is generated by Supabase auth, not by us. Customisable via Supabase email template settings.

We override the default Supabase template to match brand. Body is short:

```
Hi,

Click below to log in to Operscale CRM:

→ {{magic_link}}

This link expires in 10 minutes.

If you didn't request this, you can ignore the email.

— Operscale
```

## Idempotency keys

Per-customer-per-template-per-order, we record the most recent send in activity_log. Before sending, we check:

```sql
SELECT 1 FROM activity_log
WHERE event_type = 'auto_ack_sent'
  AND order_id = $1
  AND created_at > now() - interval '1 hour'
LIMIT 1;
```

If found, we skip the send. The 1-hour window prevents accidental double-sends from retry storms.

For recovery emails, the window is 24 hours (we don't want to nag).

## Bounce / complaint handling

Resend webhooks fire on:
- `email.delivered` — log to activity_log.
- `email.bounced` — log to activity_log, mark customer email as bounced. Surface in CRM.
- `email.complained` — same. Add the email to a suppression list (NEVER send to a complained address again).

A separate `customer_email_status` table:

```sql
CREATE TABLE customer_email_status (
  customer_id uuid PRIMARY KEY REFERENCES customers(id),
  status text NOT NULL CHECK (status IN ('active', 'bounced', 'complained')),
  last_event_at timestamptz NOT NULL,
  last_event_payload jsonb
);
```

Before sending any email, we check this table. If status is `complained`, abort. If `bounced`, abort and notify founder via WhatsApp.

## Inbound email handling

Resend supports inbound. We configure:

- Inbound MX records pointing to Resend.
- Inbound webhook to `/v1/webhook/resend-inbound`.

When a customer replies to a brief email, the inbound webhook fires. We:

1. Verify the webhook signature (Resend signs inbound webhooks).
2. Parse the `from`, `to`, `subject`, `body_text`.
3. Match the `from` to a customer (or queue for manual review if no match).
4. Insert into `customer_messages` table:

```sql
CREATE TABLE customer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  order_id uuid REFERENCES orders(id),
  direction text CHECK (direction IN ('inbound', 'outbound')),
  channel text CHECK (channel IN ('email', 'whatsapp')),
  subject text,
  body text NOT NULL,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);
```

5. Surface in CRM Order Detail timeline as `customer_replied`.
6. Founder reads in CRM, replies via personal email (Phase 1 doesn't have an in-CRM reply UI).

## Failure handling

| Failure | Retry | Final fallback |
| --- | --- | --- |
| Resend 5xx | 5 attempts, exponential backoff (1s, 2s, 4s, 8s, 16s) | Mark `email_failed`, founder WhatsApp alert |
| Resend 4xx (validation error) | 0 retries | Mark `email_failed`, founder alert with details |
| Bounce | n/a (already failed) | Mark customer email as bounced |
| Complaint | n/a | Block all future emails to this address |
| Founder approves but Resend down for hours | manual retry from CRM | Founder can also send manually from personal email |

## What's NOT in this spec

- Email A/B testing. Phase 1 doesn't have the volume.
- Email tracking pixels / open rates. We don't track opens (privacy choice).
- Localisation (multilingual). All emails are English. Niche-specific tone variations happen in the brief content itself, not in template structure.
- Newsletter / drip campaigns. Out of scope for Phase 1.

## Where to look next

- `apps/web/src/emails/*.tsx` — the template components.
- `apps/agent/src/lib/email.ts` — the sender wrapper.
- `supabase/functions/drop-off-recovery/` — the cron that fires recovery emails.
- `docs/specs/whatsapp-flow.md` — WhatsApp templates that pair with these.
- `docs/customer-journey.md` — the journey states these emails fire from.
