# V2 Pipeline Phase 4.6 — Paystack webhook handler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 501 stub at `apps/agent/src/app/v1/webhook/paystack/route.ts` with a real handler that verifies Paystack's HMAC-SHA512 signature on the raw body, dispatches by event type (`charge.success` / `charge.failure` / `transfer.success` / unknown), records payments idempotently on `paystack_event_id`, flips `orders.status` to `paid`, sets `paid_at` + `production_ready_at`, and sends a payment-confirmation email via Resend.

**Architecture:** One rewritten route handler + one new React Email component + one new pure props mapper + a 1-line `email.ts` allowlist extension. Two concentric idempotency boundaries (DB UNIQUE on `payments.paystack_event_id` + 1h activity_log cache in `sendEmail`). Best-effort email send (Resend failure does NOT roll back the payment record). Synchronous handler stays inside Paystack's 3s ack budget.

**Tech Stack:** Next.js 15 App Router (Node runtime — needs `node:crypto` for `timingSafeEqual`), `@supabase/supabase-js` 2.45.x, `resend` 4.0.x (already a dep), `@react-email/components` + `@react-email/render` (already deps from Phase 4.5). Vitest 1.6.x. No new deps, no new migrations.

**Source spec:** `docs/specs/v2-phase-4-6-design.md` (commit `47f813b`). All 8 design decisions are settled there; this plan is execution.

---

## Decisions baked into this plan

**Decision Z (build-discipline carry-forwards from Phase 4.5):**
- `apps/agent/src/lib/payment-confirmation-props.ts` is a NEW route-only lib file. Per Phase 4.5 lesson it MUST:
  - Use plain relative imports (`from './types/v2'`, `from './snapshot-to-email-props'`) — no `.js` extension, no `@/` alias.
  - Be EXCLUDED from `tsconfig.worker.json` via the `exclude` array. Worker doesn't import it; including it would re-trigger the cross-package resolution failures fixed in Phase 4.5.
- `apps/agent/src/app/v1/webhook/paystack/route.ts` is a route file — uses `@/` aliases for sibling lib files (matches Phase 4 + 4.5 route convention).
- `apps/web/src/emails/PaymentConfirmation.tsx` headings ALL-CAPS in JSX source (Phase 4.5 lesson — `textTransform: 'uppercase'` is stripped by `render(..., {plainText: true})`).
- VPS rebuild MUST use `C:\tmp\vps-rebuild.py` (already bakes in `git fetch + git reset --hard origin/main` and the typescript.ignoreBuildErrors override).

**Decision Y (PaystackChargeSuccessEvent type — what we model from Paystack's webhook payload):**

```ts
// apps/agent/src/lib/paystack.ts (extend with public type)
export interface PaystackChargeSuccessEvent {
  event: 'charge.success';
  data: {
    id: number;                    // Paystack's internal event id (we use as paystack_event_id)
    reference: string;             // matches our orders.paystack_tx_ref
    amount: number;                // KOBO (multiply NGN × 100)
    currency: 'NGN';
    paid_at: string;               // ISO8601
    channel: 'card' | 'bank_transfer' | 'ussd' | 'qr' | 'mobile_money' | 'bank';
    customer: { email: string };
    metadata?: { order_id?: string; customer_id?: string; brief_id?: string; tier?: string };
    [key: string]: unknown;        // Paystack adds fields over time; pass through to raw_payload
  };
}

export interface PaystackChargeFailureEvent {
  event: 'charge.failure';
  data: {
    id: number;
    reference: string;
    gateway_response?: string;
    [key: string]: unknown;
  };
}
```

We use `event.data.id` (Paystack's internal id) as the `paystack_event_id` for idempotency. This is distinct from `event.data.reference` (which matches our `orders.paystack_tx_ref`).

---

## File structure (Phase 4.6)

| Path | Status | Responsibility |
|---|---|---|
| `apps/agent/src/lib/payment-confirmation-props.ts` | Create | Pure mapper `(PaystackChargeSuccessEvent, Order, Customer) → PaymentConfirmationProps`. Derives `firstName`, `amountNgn` (kobo→NGN), `paymentMethod`, `paidAtIso`, tier metadata via existing `TIER_DISPLAY`, `founderWhatsappLink`, env-var `founderName`/`brandName`. |
| `apps/agent/src/lib/payment-confirmation-props.test.ts` | Create | Unit tests (~6) for the pure mapper. |
| `apps/agent/src/lib/paystack.ts` | Modify | Append `PaystackChargeSuccessEvent` + `PaystackChargeFailureEvent` exports. No behavior change. |
| `apps/web/src/emails/PaymentConfirmation.tsx` | Create | React Email component matching `email-templates.md` § "Template 4" verbatim, MINUS the receipt-attachment line. |
| `apps/web/src/emails/PaymentConfirmation.test.tsx` | Create | Render + plain-text tests (~4). |
| `apps/agent/src/lib/email.ts` | Modify | Add `'payment-confirmation'` to `SUPPORTED_TEMPLATES` (1-line). |
| `apps/agent/src/lib/email.test.ts` | Modify | Add 1 test asserting `'payment-confirmation'` no longer throws `not_implemented_template`. |
| `apps/agent/src/app/v1/webhook/paystack/route.ts` | Rewrite | Replaces 501 stub. Verify HMAC, dispatch, idempotent process. |
| `apps/agent/src/app/v1/webhook/paystack/route.test.ts` | Create | ~10 tests covering all failure modes from design § 7. |
| `apps/agent/tsconfig.worker.json` | Modify | Add `src/lib/payment-confirmation-props.ts` to `exclude`. |
| `docs/plans/2026-05-05-v2-phase-4-6-paystack-webhook.md` | This file | The plan. |

---

## Surface contracts (informational — locked by design doc)

```ts
// payment-confirmation-props.ts
export type PaymentConfirmationProps = {
  firstName: string;
  amountNgn: number;             // whole NGN (NOT kobo)
  paymentMethod: string;         // 'card' | 'bank_transfer' | 'ussd' | 'qr' | 'mobile_money' | 'bank'
  paidAtIso: string;             // ISO8601 from Paystack event.data.paid_at
  tierName: string;
  videoCount: number;
  carouselCount: number;
  deliveryWindow: string;
  founderWhatsappLink: string;   // https://wa.me/<E.164 minus +>
  founderName: string;
  brandName: string;
};

export function paymentConfirmationProps(
  event: PaystackChargeSuccessEvent,
  order: { id: string; tier: Tier; amount_ngn: number },
  customer: { full_name: string | null; email: string },
): PaymentConfirmationProps;

// /v1/webhook/paystack response shapes
type WebhookResponse =
  | { received: true }                                       // 200 (default for verified events)
  | { error: 'unauthorized' }                                // 401 (HMAC mismatch)
  | { error: 'missing_secret' };                             // 500 (server config bug)
```

---

## Task 1 — `paystack.ts` event type exports

**Files:**
- Modify: `apps/agent/src/lib/paystack.ts` (append types)

- [ ] **Step 1: Write failing test**

Create or extend `apps/agent/src/lib/paystack.test.ts` with:

```ts
import type { PaystackChargeSuccessEvent, PaystackChargeFailureEvent } from './paystack';

describe('PaystackChargeSuccessEvent type shape', () => {
  it('compiles with the expected fields', () => {
    const e: PaystackChargeSuccessEvent = {
      event: 'charge.success',
      data: {
        id: 12345,
        reference: 'ops-cal-abc-1714742400',
        amount: 27500000,
        currency: 'NGN',
        paid_at: '2026-05-05T10:00:00Z',
        channel: 'card',
        customer: { email: 't@x.z' },
        metadata: { order_id: 'order-1' },
      },
    };
    expect(e.data.amount).toBe(27500000);
  });
});

describe('PaystackChargeFailureEvent type shape', () => {
  it('compiles with minimal fields', () => {
    const e: PaystackChargeFailureEvent = {
      event: 'charge.failure',
      data: { id: 999, reference: 'ops-cal-x', gateway_response: 'declined' },
    };
    expect(e.data.gateway_response).toBe('declined');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/agent
npx vitest run src/lib/paystack.test.ts
```

Expected: 2 new failures with "Module 'paystack' has no exported member 'PaystackChargeSuccessEvent'" (existing 13 paystack tests still pass).

- [ ] **Step 3: Append type exports to `paystack.ts`**

Append at the end of `apps/agent/src/lib/paystack.ts`:

```ts
export interface PaystackChargeSuccessEvent {
  event: 'charge.success';
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: 'NGN';
    paid_at: string;
    channel: 'card' | 'bank_transfer' | 'ussd' | 'qr' | 'mobile_money' | 'bank';
    customer: { email: string };
    metadata?: {
      order_id?: string;
      customer_id?: string;
      brief_id?: string;
      tier?: string;
    };
    [key: string]: unknown;
  };
}

export interface PaystackChargeFailureEvent {
  event: 'charge.failure';
  data: {
    id: number;
    reference: string;
    gateway_response?: string;
    [key: string]: unknown;
  };
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/lib/paystack.test.ts
npm run typecheck
```

Expected: 15/15 tests pass (13 existing + 2 new); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/paystack.ts apps/agent/src/lib/paystack.test.ts
git commit -m "feat(agent): paystack — public event types for webhook handler"
```

---

## Task 2 — `payment-confirmation-props.ts` pure mapping

**Files:**
- Create: `apps/agent/src/lib/payment-confirmation-props.ts`
- Create: `apps/agent/src/lib/payment-confirmation-props.test.ts`
- Modify: `apps/agent/tsconfig.worker.json` (add to exclude — Phase 4.5 carry-forward)

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/lib/payment-confirmation-props.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { paymentConfirmationProps } from './payment-confirmation-props';
import type { PaystackChargeSuccessEvent } from './paystack';

const ORIGINAL_WA = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP;
const ORIGINAL_NAME = process.env.NEXT_PUBLIC_FOUNDER_NAME;
const ORIGINAL_BRAND = process.env.NEXT_PUBLIC_BRAND_NAME;

function restoreEnv(key: string, original: string | undefined): void {
  if (original === undefined) delete process.env[key];
  else process.env[key] = original;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP = '+2348165799032';
  delete process.env.NEXT_PUBLIC_FOUNDER_NAME;
  delete process.env.NEXT_PUBLIC_BRAND_NAME;
});
afterEach(() => {
  restoreEnv('NEXT_PUBLIC_FOUNDER_WHATSAPP', ORIGINAL_WA);
  restoreEnv('NEXT_PUBLIC_FOUNDER_NAME', ORIGINAL_NAME);
  restoreEnv('NEXT_PUBLIC_BRAND_NAME', ORIGINAL_BRAND);
});

const baseEvent: PaystackChargeSuccessEvent = {
  event: 'charge.success',
  data: {
    id: 12345,
    reference: 'ops-cal-order-1-1714742400',
    amount: 27500000,
    currency: 'NGN',
    paid_at: '2026-05-05T10:00:00Z',
    channel: 'card',
    customer: { email: 'tola@example.com' },
    metadata: { order_id: 'order-1', tier: 'standard' },
  },
};

const baseOrder = { id: 'order-1', tier: 'standard' as const, amount_ngn: 275_000 };
const baseCustomer = { full_name: 'Tola Adekunle', email: 'tola@example.com' };

describe('paymentConfirmationProps', () => {
  it('maps the happy path: standard tier, card payment', () => {
    const props = paymentConfirmationProps(baseEvent, baseOrder, baseCustomer);
    expect(props.firstName).toBe('Tola');
    expect(props.amountNgn).toBe(275_000);
    expect(props.paymentMethod).toBe('card');
    expect(props.paidAtIso).toBe('2026-05-05T10:00:00Z');
    expect(props.tierName).toBe('Standard');
    expect(props.videoCount).toBe(14);
    expect(props.carouselCount).toBe(7);
    expect(props.deliveryWindow).toBe('7-10 business days');
    expect(props.founderWhatsappLink).toBe('https://wa.me/2348165799032');
    expect(props.founderName).toBe('Akinwunmi');
    expect(props.brandName).toBe('Operscale');
  });

  it('falls back to "there" when full_name is null', () => {
    const props = paymentConfirmationProps(baseEvent, baseOrder, { full_name: null, email: 'x@y.z' });
    expect(props.firstName).toBe('there');
  });

  it('divides kobo to NGN correctly', () => {
    const e = { ...baseEvent, data: { ...baseEvent.data, amount: 15_000_000 } };
    const props = paymentConfirmationProps(e, { ...baseOrder, amount_ngn: 150_000 }, baseCustomer);
    expect(props.amountNgn).toBe(150_000);
  });

  it('passes payment method through unchanged', () => {
    const e = { ...baseEvent, data: { ...baseEvent.data, channel: 'bank_transfer' as const } };
    const props = paymentConfirmationProps(e, baseOrder, baseCustomer);
    expect(props.paymentMethod).toBe('bank_transfer');
  });

  it('maps starter tier counts and delivery window', () => {
    const props = paymentConfirmationProps(baseEvent, { ...baseOrder, tier: 'starter', amount_ngn: 150_000 }, baseCustomer);
    expect(props.videoCount).toBe(7);
    expect(props.carouselCount).toBe(3);
    expect(props.deliveryWindow).toBe('5-7 business days');
    expect(props.tierName).toBe('Starter');
  });

  it('maps calendar tier counts and delivery window', () => {
    const props = paymentConfirmationProps(baseEvent, { ...baseOrder, tier: 'calendar', amount_ngn: 525_000 }, baseCustomer);
    expect(props.videoCount).toBe(30);
    expect(props.carouselCount).toBe(14);
    expect(props.deliveryWindow).toBe('10-14 business days');
    expect(props.tierName).toBe('Calendar');
  });

  it('strips leading + from founder WhatsApp env var', () => {
    process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP = '+2348165799032';
    const props = paymentConfirmationProps(baseEvent, baseOrder, baseCustomer);
    expect(props.founderWhatsappLink).toBe('https://wa.me/2348165799032');
    expect(props.founderWhatsappLink).not.toContain('+');
  });

  it('uses env-var overrides for founderName and brandName when set', () => {
    process.env.NEXT_PUBLIC_FOUNDER_NAME = 'Femi';
    process.env.NEXT_PUBLIC_BRAND_NAME = 'Acme';
    const props = paymentConfirmationProps(baseEvent, baseOrder, baseCustomer);
    expect(props.founderName).toBe('Femi');
    expect(props.brandName).toBe('Acme');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/payment-confirmation-props.test.ts
```

Expected: 8 failures with "Cannot find module './payment-confirmation-props'".

- [ ] **Step 3: Implement the mapper**

Create `apps/agent/src/lib/payment-confirmation-props.ts`:

```ts
// apps/agent/src/lib/payment-confirmation-props.ts
//
// Pure mapping: Paystack charge.success event + Order + Customer →
// PaymentConfirmationProps. Consumed by /v1/webhook/paystack to render
// PaymentConfirmation.tsx.
//
// Carry-forward from Phase 4.5: this file is route-consumed only (the
// worker doesn't import it), so it uses plain relative imports and is
// excluded from tsconfig.worker.json.

import type { PaystackChargeSuccessEvent } from './paystack';
import type { Tier } from './types/v2';
import { TIER_DISPLAY } from './snapshot-to-email-props';

export type PaymentConfirmationProps = {
  firstName: string;
  amountNgn: number;
  paymentMethod: string;
  paidAtIso: string;
  tierName: string;
  videoCount: number;
  carouselCount: number;
  deliveryWindow: string;
  founderWhatsappLink: string;
  founderName: string;
  brandName: string;
};

function deriveFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0]!;
}

function buildWhatsappLink(): string {
  const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP ?? '+2348165799032';
  return `https://wa.me/${phone.replace(/^\+/, '')}`;
}

export function paymentConfirmationProps(
  event: PaystackChargeSuccessEvent,
  order: { id: string; tier: Tier; amount_ngn: number },
  customer: { full_name: string | null; email: string },
): PaymentConfirmationProps {
  const tierD = TIER_DISPLAY[order.tier]!;
  return {
    firstName: deriveFirstName(customer.full_name),
    amountNgn: Math.round(event.data.amount / 100),
    paymentMethod: event.data.channel,
    paidAtIso: event.data.paid_at,
    tierName: tierD.tierName,
    videoCount: tierD.videoCount,
    carouselCount: tierD.carouselCount,
    deliveryWindow: tierD.deliveryWindow,
    founderWhatsappLink: buildWhatsappLink(),
    founderName: process.env.NEXT_PUBLIC_FOUNDER_NAME ?? 'Akinwunmi',
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Operscale',
  };
}
```

- [ ] **Step 4: Exclude from `tsconfig.worker.json`**

Modify `apps/agent/tsconfig.worker.json` `exclude` array — append `"src/lib/payment-confirmation-props.ts"`:

```jsonc
"exclude": [
  "**/*.test.ts",
  "src/lib/__fixtures__/**",
  "src/lib/__sanity__/**",
  "src/lib/webhook-405.ts",
  "src/lib/email.ts",
  "src/lib/snapshot-to-email-props.ts",
  "src/lib/payment-confirmation-props.ts"
]
```

- [ ] **Step 5: Verify tests pass + typecheck + build:worker**

```bash
npx vitest run src/lib/payment-confirmation-props.test.ts
npm run typecheck
npm run build:worker
```

Expected: 8/8 tests pass; typecheck clean; build:worker clean (no errors despite the new lib file using bundler-style imports — it's excluded from worker tsc).

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/lib/payment-confirmation-props.ts apps/agent/src/lib/payment-confirmation-props.test.ts apps/agent/tsconfig.worker.json
git commit -m "feat(agent): payment-confirmation-props pure mapper for webhook email

Maps PaystackChargeSuccessEvent + Order + Customer to
PaymentConfirmationProps. Pure, 7 unit tests, no DB or network.
Reuses TIER_DISPLAY from snapshot-to-email-props (single source).
Excluded from tsconfig.worker.json per Phase 4.5 route-only-lib
convention."
```

---

## Task 3 — `PaymentConfirmation.tsx` React Email component

**Files:**
- Create: `apps/web/src/emails/PaymentConfirmation.tsx`
- Create: `apps/web/src/emails/PaymentConfirmation.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/emails/PaymentConfirmation.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { PaymentConfirmation } from './PaymentConfirmation';
import type { PaymentConfirmationProps } from '@operscale-calendar/agent/lib/payment-confirmation-props';

const baseProps: PaymentConfirmationProps = {
  firstName: 'Tola',
  amountNgn: 275_000,
  paymentMethod: 'card',
  paidAtIso: '2026-05-05T10:00:00Z',
  tierName: 'Standard',
  videoCount: 14,
  carouselCount: 7,
  deliveryWindow: '7-10 business days',
  founderWhatsappLink: 'https://wa.me/2348165799032',
  founderName: 'Akinwunmi',
  brandName: 'Operscale', // fixture value only — not a locked-brand reference
};

describe('PaymentConfirmation render', () => {
  it('renders all 8 substantive variables in the HTML body', async () => {
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).toContain('Tola');
    expect(html).toContain('275,000'); // formatted NGN
    expect(html).toContain('card');
    expect(html).toContain('Standard');
    expect(html).toContain('14 videos');
    expect(html).toContain('7 carousels');
    expect(html).toContain('7-10 business days');
    expect(html).toContain('https://wa.me/2348165799032');
  });

  it('renders paidAt in WAT (UTC+1) using ICU-free manual formatting', async () => {
    // 2026-05-05T10:00:00Z UTC → 2026-05-05 11:00 WAT.
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).toContain('5 May 2026');
    expect(html).toContain('11:00 WAT');
  });

  it('renders ALL-CAPS heading "WHAT HAPPENS NEXT" in plain text', async () => {
    const text = await render(<PaymentConfirmation {...baseProps} />, { plainText: true });
    expect(text).toContain('WHAT HAPPENS NEXT');
    expect(text).toContain('275,000');
  });

  it('does NOT include the receipt-attachment line (deferred to Phase 4.7)', async () => {
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).not.toContain('A receipt is attached');
    const text = await render(<PaymentConfirmation {...baseProps} />, { plainText: true });
    expect(text).not.toContain('A receipt is attached');
  });

  it('subject preview matches spec', async () => {
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).toContain(`Payment received — your ${baseProps.brandName} calendar is now in production`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web
npx vitest run src/emails/PaymentConfirmation.test.tsx
```

Expected: 5 failures with "Cannot find module './PaymentConfirmation'".

- [ ] **Step 3: Implement `PaymentConfirmation.tsx`**

Create `apps/web/src/emails/PaymentConfirmation.tsx`:

```tsx
// apps/web/src/emails/PaymentConfirmation.tsx
//
// React Email component for the payment-confirmation email.
// SOURCE OF TRUTH: docs/specs/email-templates.md §"Template 4: payment-confirmation".
// Phase 4.6 omits the "A receipt is attached" line — Phase 4.7 restores it.

import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Link,
} from '@react-email/components';
import type { PaymentConfirmationProps } from '@operscale-calendar/agent/lib/payment-confirmation-props';

const body: React.CSSProperties = { backgroundColor: '#f5f4f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 0', color: '#1a1a1a' };
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', padding: '32px', borderRadius: '4px' };
const h2: React.CSSProperties = { fontSize: '14px', letterSpacing: '0.06em', color: '#5a5a5a', marginTop: '24px', marginBottom: '8px' };
const p: React.CSSProperties = { fontSize: '16px', lineHeight: 1.55, marginBottom: '12px' };
const small: React.CSSProperties = { fontSize: '13px', color: '#5a5a5a' };

function fmtNgn(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n);
}

// Format a UTC ISO timestamp into West Africa Time (UTC+1, no DST) without
// relying on Intl/ICU locale data. The agent + web containers run on
// node:20.11-alpine which ships small-icu — `toLocaleString('en-NG', {dateStyle,
// timeStyle})` silently degrades to the C locale there. Manual formatting keeps
// the output deterministic across hosts.
const FMT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtPaidAt(iso: string): string {
  const utcMs = new Date(iso).getTime();
  if (!Number.isFinite(utcMs)) return iso;
  const wat = new Date(utcMs + 60 * 60 * 1000); // WAT = UTC+1, no DST
  const day = wat.getUTCDate();
  const month = FMT_MONTHS[wat.getUTCMonth()];
  const year = wat.getUTCFullYear();
  const hh = String(wat.getUTCHours()).padStart(2, '0');
  const mm = String(wat.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm} WAT`;
}

export function PaymentConfirmation(props: PaymentConfirmationProps): JSX.Element {
  const subjectPreview = `Payment received — your ${props.brandName} calendar is now in production`;
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={p}>Hi {props.firstName},</Text>
          <Text style={p}>
            Payment confirmed. ₦{fmtNgn(props.amountNgn)} received via {props.paymentMethod} at {fmtPaidAt(props.paidAtIso)}.
          </Text>
          <Text style={p}>Your {props.tierName} package is now in production.</Text>

          <Heading as="h2" style={h2}>WHAT HAPPENS NEXT</Heading>
          <Text style={p}>— We start producing your {props.videoCount} videos and {props.carouselCount} carousels.</Text>
          <Text style={p}>— You&apos;ll receive your full delivery within {props.deliveryWindow}.</Text>
          <Text style={p}>— I&apos;ll WhatsApp you when delivery is ready.</Text>

          <Hr />

          <Text style={p}>
            Questions? Reply directly or message me on WhatsApp: <Link href={props.founderWhatsappLink}>{props.founderWhatsappLink}</Link>.
          </Text>

          <Text style={p}>— {props.founderName}<br />{props.brandName}</Text>

          <Hr />
          <Text style={small}>Operscale Limited · operscale.cloud/privacy · operscale.cloud/terms</Text>
        </Container>
        {/* Subject preview helper — hidden, used by tests */}
        <span style={{ display: 'none' }}>{subjectPreview}</span>
      </Body>
    </Html>
  );
}

export default PaymentConfirmation;
```

- [ ] **Step 4: Verify tests pass**

```bash
cd apps/web
npx vitest run src/emails/PaymentConfirmation.test.tsx
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/emails/PaymentConfirmation.tsx apps/web/src/emails/PaymentConfirmation.test.tsx
git commit -m "feat(web): PaymentConfirmation React Email component for /v1/webhook/paystack

Matches email-templates.md §Template 4 verbatim, MINUS the
receipt-attachment line (Phase 4.7 restores it alongside the PDF).
ALL-CAPS heading per Phase 4.5 plain-text-render lesson. Renders
₦amount with en-NG locale formatting and paid_at in WAT timezone."
```

---

## Task 4 — `email.ts` allowlist extension

**Files:**
- Modify: `apps/agent/src/lib/email.ts`
- Modify: `apps/agent/src/lib/email.test.ts`

- [ ] **Step 1: Write failing test**

Append to `apps/agent/src/lib/email.test.ts` (inside the existing `describe('sendEmail', ...)` block):

```ts
  it('accepts templateKey="payment-confirmation" without throwing not_implemented_template', async () => {
    resendSpy.mockResolvedValueOnce({ data: { id: 'pc-msg-1' }, error: null });
    const result = await sendEmail({ ...baseInput, templateKey: 'payment-confirmation' });
    expect(result).toEqual({ resendMessageId: 'pc-msg-1' });
    expect(resendSpy).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify it fails**

```bash
cd apps/agent
npx vitest run src/lib/email.test.ts
```

Expected: 1 new failure ("EmailSendError: not_implemented_template: payment-confirmation"); existing 6 pass.

- [ ] **Step 3: Add `'payment-confirmation'` to `SUPPORTED_TEMPLATES`**

Modify `apps/agent/src/lib/email.ts`:

```ts
const SUPPORTED_TEMPLATES: ReadonlyArray<TemplateKey> = ['brief-email', 'payment-confirmation'];
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/lib/email.test.ts
npm run typecheck
```

Expected: 7/7 tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/email.ts apps/agent/src/lib/email.test.ts
git commit -m "feat(agent): email — allow templateKey='payment-confirmation' for Phase 4.6 webhook"
```

---

## Task 5 — `/v1/webhook/paystack` route rewrite

**Files:**
- Rewrite: `apps/agent/src/app/v1/webhook/paystack/route.ts`
- Create: `apps/agent/src/app/v1/webhook/paystack/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/app/v1/webhook/paystack/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { POST } from './route';

const SECRET = 'sk_test_dummy';
const ORIGINAL_SECRET = process.env.PAYSTACK_SECRET_KEY;

let paymentsRows: any[];
let ordersRow: any;
let customerRow: any;
let activityLogs: any[];
let ordersUpdates: any[];
let paymentsInserts: any[];
let sendEmailMock: ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: paymentsRows[0] ?? null, error: null })),
            }),
          }),
          insert: vi.fn().mockImplementation(async (row: any) => {
            paymentsInserts.push(row);
            return { error: null };
          }),
        };
      }
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: ordersRow, error: null })),
            }),
          }),
          update: vi.fn().mockImplementation((row: any) => ({
            eq: vi.fn().mockImplementation(async (col: string, val: any) => {
              ordersUpdates.push({ row, where: { [col]: val } });
              return { error: null };
            }),
          })),
        };
      }
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: customerRow, error: null })),
            }),
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockImplementation(async (entry: any) => { activityLogs.push(entry); }),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: (...args: any[]) => sendEmailMock(...args),
  EmailSendError: class extends Error { constructor(public detail: any) { super('email_send_failed'); } },
}));

vi.mock('@operscale-calendar/web/emails/PaymentConfirmation', () => ({
  PaymentConfirmation: () => null,
  default: () => null,
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>payment</html>'),
}));

function makeEvent(overrides: any = {}): any {
  return {
    event: 'charge.success',
    data: {
      id: 12345,
      reference: 'ops-cal-order-1-1714742400',
      amount: 27_500_000,
      currency: 'NGN',
      paid_at: '2026-05-05T10:00:00Z',
      channel: 'card',
      customer: { email: 'tola@example.com' },
      metadata: { order_id: 'order-1' },
      ...overrides,
    },
  };
}

function makeReq(rawBody: string, signature: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== null) headers['x-paystack-signature'] = signature;
  return new Request('http://x/v1/webhook/paystack', { method: 'POST', headers, body: rawBody });
}

function sign(rawBody: string): string {
  return createHmac('sha512', SECRET).update(rawBody).digest('hex');
}

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  paymentsRows = [];
  ordersRow = { id: 'order-1', customer_id: 'cust-1', brief_id: 'brief-1', status: 'brief_sent', tier: 'standard', amount_ngn: 275_000, paystack_tx_ref: 'ops-cal-order-1-1714742400' };
  customerRow = { full_name: 'Tola', email: 'tola@example.com' };
  activityLogs = [];
  ordersUpdates = [];
  paymentsInserts = [];
  sendEmailMock = vi.fn().mockResolvedValue({ resendMessageId: 'pc-msg-1' });
});

afterEach(() => {
  process.env.PAYSTACK_SECRET_KEY = ORIGINAL_SECRET;
  vi.clearAllMocks();
});

describe('POST /v1/webhook/paystack', () => {
  it('returns 401 on bad HMAC signature; raw body never parsed', async () => {
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, 'wrong-sig'));
    expect(res.status).toBe(401);
    expect(activityLogs.find((e) => e.eventType === 'webhook_signature_failed')).toBeDefined();
    expect(paymentsInserts).toHaveLength(0);
    expect(ordersUpdates).toHaveLength(0);
  });

  it('returns 200 + skip on duplicate paystack_event_id', async () => {
    paymentsRows = [{ id: 'existing-payment-1' }];
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(0);
    expect(ordersUpdates).toHaveLength(0);
  });

  it('happy path: charge.success → payments INSERT + orders flipped to paid + activity log + email sent', async () => {
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(1);
    expect(paymentsInserts[0]).toMatchObject({ order_id: 'order-1', paystack_event_id: '12345', event_type: 'charge.success', amount_ngn: 275_000 });
    const finalOrderUpdate = ordersUpdates[ordersUpdates.length - 1];
    expect(finalOrderUpdate.row).toMatchObject({ status: 'paid' });
    expect(finalOrderUpdate.row.paid_at).toBeDefined();
    expect(finalOrderUpdate.row.production_ready_at).toBeDefined();
    expect(activityLogs.find((e) => e.eventType === 'payment_succeeded')).toBeDefined();
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: 'payment-confirmation',
      to: 'tola@example.com',
    }));
  });

  it('Resend failure does NOT throw or roll back; logs payment_confirmation_email_failed and returns 200', async () => {
    const { EmailSendError } = await import('@/lib/email');
    sendEmailMock.mockRejectedValueOnce(new (EmailSendError as any)({ status: 422, message: 'Bad email' }));
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(1);
    expect(activityLogs.find((e) => e.eventType === 'payment_confirmation_email_failed')).toBeDefined();
  });

  it('charge.failure: logs payment_failed; no orders status change; no payments INSERT; no email', async () => {
    const event = { event: 'charge.failure', data: { id: 999, reference: 'ops-cal-order-1-x', gateway_response: 'declined' } };
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'payment_failed')).toBeDefined();
    expect(ordersUpdates).toHaveLength(0);
    expect(paymentsInserts).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('amount mismatch: logs webhook_amount_mismatch AND still flips orders to paid', async () => {
    const event = makeEvent({ amount: 1_000_000 }); // Paystack reports 10,000 NGN; order is 275,000
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_amount_mismatch')).toBeDefined();
    expect(paymentsInserts).toHaveLength(1);
    const finalOrderUpdate = ordersUpdates[ordersUpdates.length - 1];
    expect(finalOrderUpdate.row.status).toBe('paid');
  });

  it('unknown paystack_tx_ref: logs webhook_unknown_tx_ref; no payments INSERT; 200', async () => {
    ordersRow = null;
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_unknown_tx_ref')).toBeDefined();
    expect(paymentsInserts).toHaveLength(0);
  });

  it('transfer.success event: log + skip + 200', async () => {
    const event = { event: 'transfer.success', data: { id: 555, reference: 'tr-x' } };
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(0);
    expect(ordersUpdates).toHaveLength(0);
  });

  it('unknown event type: log webhook_unhandled_event + 200', async () => {
    const event = { event: 'invoice.create', data: { id: 777 } };
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_unhandled_event')).toBeDefined();
  });

  it('returns 500 if PAYSTACK_SECRET_KEY env is missing', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, 'any-sig'));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/v1/webhook/paystack/route.test.ts
```

Expected: 10 failures (current stub returns 501 for everything).

- [ ] **Step 3: Implement the route**

Replace the entire body of `apps/agent/src/app/v1/webhook/paystack/route.ts`:

```ts
// apps/agent/src/app/v1/webhook/paystack/route.ts
//
// Paystack webhook handler. Phase 4.6 implementation per
// docs/specs/paystack-integration.md and docs/specs/v2-phase-4-6-design.md.
//
// CRITICAL ordering (do NOT change):
//   1. Read raw body via req.text() — DO NOT JSON.parse first
//   2. Read header x-paystack-signature
//   3. verifyWebhookSignature(rawBody, sig, secret) using HMAC-SHA512
//   4. ON MISMATCH: 401, log security event, no body parse
//   5. ON MATCH: JSON.parse, dispatch by event.event
//
// Cloudflare proxy MUST be off for api.operscale.cloud (DNS-only) so the raw
// body bytes reach us unmodified. See docs/deployment.md.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyWebhookSignature } from '@/lib/paystack';
import type { PaystackChargeSuccessEvent, PaystackChargeFailureEvent } from '@/lib/paystack';
import { sendEmail, EmailSendError } from '@/lib/email';
import { paymentConfirmationProps } from '@/lib/payment-confirmation-props';
import { PaymentConfirmation } from '@operscale-calendar/web/emails/PaymentConfirmation';
import { render } from '@react-email/render';
import * as React from 'react';
import { webhookGetExplainer } from '@/lib/webhook-405';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = () =>
  webhookGetExplainer({ caller: 'Paystack', spec: 'docs/specs/paystack-integration.md' });

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    return NextResponse.json({ error: 'missing_secret' }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    const supabase = getSupabaseAdmin();
    await writeActivityLog(
      {
        eventType: 'webhook_signature_failed',
        actor: 'system',
        payload: {
          provided_signature: signature ?? null,
          ip: req.headers.get('x-forwarded-for') ?? null,
        },
      },
      supabase,
    );
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  switch (event?.event) {
    case 'charge.success':
      await handleChargeSuccess(event as PaystackChargeSuccessEvent, supabase);
      break;
    case 'charge.failure':
      await handleChargeFailure(event as PaystackChargeFailureEvent, supabase);
      break;
    case 'transfer.success':
      await writeActivityLog(
        { eventType: 'webhook_transfer_success_skipped', actor: 'system', payload: { event_id: event.data?.id } },
        supabase,
      );
      break;
    default:
      await writeActivityLog(
        { eventType: 'webhook_unhandled_event', actor: 'system', payload: { event_type: event?.event } },
        supabase,
      );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleChargeSuccess(
  event: PaystackChargeSuccessEvent,
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<void> {
  const eventId = String(event.data.id);
  const txRef = event.data.reference;

  // Idempotency: skip if we've processed this event before.
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('paystack_event_id', eventId)
    .maybeSingle();
  if (existing) return;

  // Find the order by tx_ref.
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, brief_id, status, tier, amount_ngn, paystack_tx_ref')
    .eq('paystack_tx_ref', txRef)
    .maybeSingle();
  if (!order) {
    await writeActivityLog(
      { eventType: 'webhook_unknown_tx_ref', actor: 'system', payload: { tx_ref: txRef, event_id: eventId } },
      supabase,
    );
    return;
  }

  const expectedKobo = order.amount_ngn * 100;
  if (event.data.amount !== expectedKobo) {
    await writeActivityLog(
      {
        eventType: 'webhook_amount_mismatch',
        actor: 'system',
        orderId: order.id,
        payload: { expected_kobo: expectedKobo, actual_kobo: event.data.amount, tx_ref: txRef },
      },
      supabase,
    );
    // Still process — record under-payment for founder reconciliation.
  }

  await supabase.from('payments').insert({
    order_id: order.id,
    paystack_event_id: eventId,
    event_type: 'charge.success',
    amount_ngn: Math.round(event.data.amount / 100),
    raw_payload: event.data,
  });

  const nowIso = new Date().toISOString();
  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: nowIso, production_ready_at: nowIso })
    .eq('id', order.id);

  await writeActivityLog(
    {
      eventType: 'payment_succeeded',
      actor: 'system',
      orderId: order.id,
      briefId: order.brief_id,
      payload: {
        tx_ref: txRef,
        event_id: eventId,
        amount_ngn: Math.round(event.data.amount / 100),
        payment_method: event.data.channel,
      },
    },
    supabase,
  );

  // Fetch customer + send confirmation email (best-effort).
  const { data: customer } = await supabase
    .from('customers')
    .select('full_name, email')
    .eq('id', order.customer_id)
    .maybeSingle();
  if (!customer || !customer.email) {
    await writeActivityLog(
      { eventType: 'payment_confirmation_email_failed', actor: 'system', orderId: order.id, payload: { error: 'customer_or_email_missing' } },
      supabase,
    );
    return;
  }

  try {
    const props = paymentConfirmationProps(event, { id: order.id, tier: order.tier, amount_ngn: order.amount_ngn }, customer);
    const subject = `Payment received — your ${props.brandName} calendar is now in production`;
    const element = React.createElement(PaymentConfirmation, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    await sendEmail({
      to: customer.email,
      templateKey: 'payment-confirmation',
      subject, html, text,
      customerId: order.customer_id, briefId: order.brief_id, orderId: order.id,
    });
  } catch (e) {
    const detail = e instanceof EmailSendError ? e.message : String(e);
    await writeActivityLog(
      { eventType: 'payment_confirmation_email_failed', actor: 'system', orderId: order.id, briefId: order.brief_id, payload: { error: detail, tx_ref: txRef, event_id: eventId } },
      supabase,
    );
  }
}

async function handleChargeFailure(
  event: PaystackChargeFailureEvent,
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<void> {
  const txRef = event.data.reference;
  const eventId = String(event.data.id);
  await writeActivityLog(
    {
      eventType: 'payment_failed',
      actor: 'system',
      payload: { tx_ref: txRef, event_id: eventId, gateway_response: event.data.gateway_response ?? null },
    },
    supabase,
  );
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/app/v1/webhook/paystack/route.test.ts
npm run typecheck
```

Expected: 10/10 tests pass; typecheck clean.

- [ ] **Step 5: Run full agent suite**

```bash
npm test
```

Expected: ~270 pass / 3 nightly skipped.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/app/v1/webhook/paystack/route.ts apps/agent/src/app/v1/webhook/paystack/route.test.ts
git commit -m "feat(agent): /v1/webhook/paystack — verify HMAC, dispatch, idempotent process

Phase 4.6. Replaces 501 stub. CRITICAL ordering enforced:
read raw body -> verify HMAC-SHA512 with constant-time compare ->
JSON.parse only after verification -> dispatch by event.event.

charge.success path: idempotency on payments.paystack_event_id ->
INSERT payments + UPDATE orders (status=paid, paid_at,
production_ready_at) + writeActivityLog(payment_succeeded) -> render
PaymentConfirmation.tsx + sendEmail (best-effort; Resend failure
logs payment_confirmation_email_failed but does NOT roll back the
payment record).

charge.failure: log payment_failed; no orders.status change.
transfer.success / unknown event: log + skip + 200.

Failure responses:
  - HMAC mismatch -> 401 + webhook_signature_failed log
  - Missing PAYSTACK_SECRET_KEY -> 500
  - Amount mismatch -> log webhook_amount_mismatch but still flip to
    paid (record under-payment for founder reconciliation)
  - Unknown tx_ref -> log webhook_unknown_tx_ref + 200

10 unit tests covering all failure modes."
```

---

## Task 6 — Live staging smoke

**Files:**
- Create: `C:\tmp\phase4-6-smoke.py` (NOT committed; mirrors `C:\tmp\phase4-5-smoke.py`)

- [ ] **Step 1: Push Tasks 1-5 to origin/main**

```bash
git push origin main
```

- [ ] **Step 2: Pull on VPS + rebuild agent + web images**

```bash
PYTHONIOENCODING=utf-8 python C:\tmp\vps-rebuild.py
```

Expected: agent + web rebuilt cleanly (~3 min). After rebuild:
- `curl https://api.operscale.cloud/v1/health` returns 200.
- `curl -X POST https://api.operscale.cloud/v1/webhook/paystack` returns 401 (was 501; live now).

- [ ] **Step 3: Write smoke script**

Create `C:\tmp\phase4-6-smoke.py`. Start by copying `C:\tmp\phase4-5-smoke.py` and modify the post-`/approve` flow:

After `/approve` succeeds (asserts identical to Phase 4.5), the Phase 4.6 smoke does:

```python
# After Phase 4.5 happy-path assertions, capture authorization_url:
authorization_url = psql_one(
    c,
    f"select paystack_authorization->>'authorizationUrl' from orders where id='{ORDER_ID}'",
)
print(f"\n[manual] open in browser to complete payment with test card 4084 0840 8408 4081:")
print(f"    {authorization_url}")
input("Press Enter AFTER you have completed payment on Paystack...")

# Wait for webhook to fire (5-15s).
print("\n[wait] polling payments table for charge.success event (up to 60s)...")
deadline = time.time() + 60
while time.time() < deadline:
    payments = psql_one(c, f"select count(*) from payments where order_id='{ORDER_ID}'")
    if int(payments) >= 1:
        break
    time.sleep(3)
else:
    print("    WEBHOOK DID NOT FIRE within 60s")
    c.close(); sys.exit(1)

# Phase 4.6 assertions:
print("\n[verify] payments + orders + activity_log…")
payment = psql_one(c, f"select event_type, paystack_event_id, amount_ngn, raw_payload->>'channel' from payments where order_id='{ORDER_ID}'")
print(f"    payment: {payment}")
parts = payment.split("|")
assert parts[0] == "charge.success", f"expected event_type=charge.success, got {parts[0]}"
assert parts[1], f"paystack_event_id must be set"
assert int(parts[2]) == 275_000, f"amount_ngn must be 275000, got {parts[2]}"

order = psql_one(c, f"select status, paid_at is not null, production_ready_at is not null from orders where id='{ORDER_ID}'")
print(f"    order:   {order}")
parts = order.split("|")
assert parts[0] == "paid", f"expected status=paid, got {parts[0]}"
assert parts[1] == "t", "paid_at not set"
assert parts[2] == "t", "production_ready_at not set"

succ = psql_one(c, f"select count(*) from activity_log where order_id='{ORDER_ID}' and event_type='payment_succeeded'")
assert int(succ) == 1, f"expected 1 payment_succeeded event, got {succ}"

email = psql_one(c, f"select payload->>'resend_message_id' from activity_log where order_id='{ORDER_ID}' and event_type='payment_confirmation_sent' order by occurred_at desc limit 1")
print(f"    payment_confirmation Resend id: {email}")
assert email, "payment_confirmation_sent activity log row missing"

# Cleanup adds payments + activity_log:
CLEANUP_SQL_46 = CLEANUP_SQL + f"\ndelete from payments where order_id = '{ORDER_ID}';\n"
out, err = psql(c, CLEANUP_SQL_46)
print(f"\n[8] cleanup: {out.strip()[:200] or '(empty)'}")

print("\n" + "=" * 60)
print("PHASE 4.6 SMOKE: PASS")
print(f"  • Webhook fired and verified within 60s")
print(f"  • Payments row written; orders.status=paid; both timestamps set")
print(f"  • Resend payment-confirmation message_id: {email}")
print(f"  • MANUAL CONFIRMATION: check {CUSTOMER_EMAIL} inbox for payment-confirmation email.")
print("=" * 60)
```

- [ ] **Step 4: Run smoke**

```bash
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-6-smoke.py
```

Manual steps required:
1. When prompted with the Paystack URL, open it in a browser.
2. Complete payment with test card `4084 0840 8408 4081`, CVV any 3 digits, expiry any future date.
3. Hit Enter in the terminal once Paystack confirms payment.
4. Manually check the founder inbox for the rendered payment-confirmation email.

Expected: `PHASE 4.6 SMOKE: PASS`. All Phase 4.6 assertions green; founder inbox receives the email.

- [ ] **Step 5: Document the smoke in commit body**

Don't commit smoke output. Capture key details (paystack_event_id, payment_confirmation Resend id, the assertions that passed) for the close-out commit.

---

## Task 7 — Close-out

**Files:**
- Modify: `docs/plans/2026-05-05-v2-phase-4-6-paystack-webhook.md` (this file — flip checkboxes)
- Modify: `prompt.md` (rewrite as Phase 5 / CRM handoff)
- Modify: memory `project_state.md`

- [ ] **Step 1: Run full verification**

```bash
cd apps/agent
npm test
npm run typecheck
npm run build:worker
```

Expected: ~270 tests pass / 3 nightly skipped; typecheck + build:worker clean.

- [ ] **Step 2: Push everything**

```bash
git push origin main
```

(All Phase 4.6 implementation commits already pushed in Task 6 Step 1.)

- [ ] **Step 3: Update memory project_state.md**

Append `## V2 Phase 4.6 — ✅ COMPLETE 2026-05-XX` with:
- Commit range
- Components shipped (route rewrite, PaymentConfirmation.tsx, payment-confirmation-props.ts, email.ts allowlist extension)
- Smoke results (manual browser payment with test card, webhook fired in <60s, all assertions green)
- Phase 5 (CRM) carry-forwards: founder review interface, magic-link auth, edit-field/discard/approve actions, pending-review list with AI snapshot.

- [ ] **Step 4: Rewrite prompt.md as Phase 5 / CRM handoff**

Same pattern as the Phase 4.5 → 4.6 handoff. Catch-up section reflects Phases 1, 2, 3, 4, 4.5, 4.6 complete; first-message guides brainstorming for Phase 5 (Founder CRM). Decisions to surface: magic-link flow vs alternative, list-view filter set, edit-field UX, AI-snapshot edit history rendering.

- [ ] **Step 5: Commit close-out**

```bash
git add docs/plans/2026-05-05-v2-phase-4-6-paystack-webhook.md prompt.md
git commit -F C:\tmp\commit-msg.txt
git push origin main
```

Suggested commit body covered in Task 6 Step 5 capture.

---

## Out of scope for Phase 4.6 (carry forward)

- **Phase 4.7** — Receipt PDF generation + restore "A receipt is attached" line in PaymentConfirmation body.
- **Phase 4.6.1** — WhatsApp send on `charge.success` via Evolution API.
- **Phase 4.6.2** — Drop-off recovery cron for `charge.failure` re-engagement at +2h.
- **Phase 4.6.3** — Reconciliation cron (`supabase/functions/paystack-reconciliation/`) — weekly Paystack ledger compare.
- **Phase 5** — Founder CRM (magic-link auth, pending-review list, brief detail with AI snapshot, edit-field, discard, approve, paid-orders dashboard with Phase 4.6 data).

## Self-review notes

- **Spec coverage:** Design § 1 (goal) → Tasks 5+6. § 3 (architecture) → Task 5. § 4.1 (PaymentConfirmation) → Task 3. § 4.2 (props mapper) → Task 2. § 4.3 (route) → Task 5. § 4.4 (email.ts) → Task 4. § 5 (state machine) → Task 5. § 6 (idempotency) → Task 5. § 7 (failure modes) → Task 5 tests + Task 6 smoke. § 8 (test plan) → Tasks 2+3+4+5 unit tests + Task 6 live smoke. § 9 (acceptance) → Task 7 close-out.
- **Type consistency:** `PaymentConfirmationProps` shape identical between `payment-confirmation-props.ts` (Task 2) and `PaymentConfirmation.tsx` (Task 3). `PaystackChargeSuccessEvent` from Task 1 is consumed by Tasks 2 + 5. `TIER_DISPLAY` from existing `snapshot-to-email-props.ts` is reused in Task 2.
- **No placeholders.** Every step has executable code or commands.
- **HMAC ordering** is documented explicitly in Task 5 Step 3's file header AND tested in Task 5 Step 1's first test.
- **Phase 4.5 carry-forwards honored:** Task 2 excludes `payment-confirmation-props.ts` from `tsconfig.worker.json`; route uses `@/` aliases; PaymentConfirmation.tsx uses ALL-CAPS heading literals.
