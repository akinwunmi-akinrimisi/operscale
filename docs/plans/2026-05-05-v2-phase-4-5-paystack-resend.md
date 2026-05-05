# V2 Pipeline Phase 4.5 — Paystack initialise + Resend brief email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `/v1/brief/approve` to (a) initialise a Paystack transaction, (b) render and send a personalised brief email via Resend containing the payment URL, (c) flip `orders.status` to `brief_sent` (or `brief_email_failed` if Resend fails after Paystack succeeded). Forward path only; webhook handler is Phase 4.6.

**Architecture:** Extend the existing Phase 4 `/approve` handler in-place. Three new files (`snapshot-to-email-props.ts`, `apps/web/src/emails/BriefEmail.tsx`, plus tests). Two existing stubs filled (`paystack.ts::initializeTransaction`, `email.ts::sendEmail`). No new routes, no new DB migrations, no new env vars beyond what's already on the VPS (`PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_SENDER`, `NEXT_PUBLIC_BRAND_DOMAIN`, plus a new `NEXT_PUBLIC_FOUNDER_NAME`).

**Tech Stack:** Next.js 15 App Router (Node runtime), zod 3.23, `@supabase/supabase-js` 2.45.x, `resend` 4.0.x (already a dep), `@react-email/components` + `@react-email/render` (new deps in `apps/web`), `@operscale-calendar/web` workspace dep added to `apps/agent` so the agent can import `BriefEmail` from `apps/web/src/emails/`. Vitest 1.6.x.

**Source spec:** `docs/specs/v2-phase-4-5-design.md` (commit `7c4aee2`). All design decisions are settled there; this plan is execution.

---

## Decisions baked into this plan

**Decision A — AiOutput → email-prop mapping (resolved during plan-writing).**
The email-templates.md spec describes email-friendly fields (`angles`, `scriptSeed`, `visualStyle.recommendedCameraTreatment`, etc.) that don't appear directly on `AiOutput`/`SupersetOutput`. Phase 4.5 derives them from existing fields:

- `briefSummary` ← `run.ai_output.brief_summary` (SupersetOutput, written by post-processor).
- `angles[]` ← first 3 entries of `run.ai_output.calendar_plan`. Each maps `{title: slot.topic, hook: slot.hook, whyItFits: slot.core_beats[0] ?? slot.cta}`.
- `scriptSeed` ← `calendar_plan[0]` mapped to `{topic, openingHook: slot.hook, outline: slot.core_beats}`.
- `visualStyle.recommendedCameraTreatment` ← `${visual_aesthetic.lighting}; ${visual_aesthetic.setting}; ${visual_aesthetic.wardrobe_props}`.
- `visualStyle.recommendedCaptionStyle` ← derived from `brand_voice.sentence_rhythm + energy_register` — concrete formula in Task 1.
- `photoAesthetic.recommendedAvatarTreatment` ← `visual_aesthetic.photo_quality_summary` only when `visual_aesthetic.photos_present === true`. Otherwise the props field is `null` (template skips the photos block).
- `upsell` ← `run.ai_output.upsell_recommendation`. When `should_upsell === true` AND `recommended_tier !== null`, props field is populated; else `null`.

Plan keeps pace with code: Task 1 lands the mapping AND a comment block in `snapshot-to-email-props.ts` cross-referencing both the email-templates.md spec and the AiOutput type, so the divergence is documented at the source.

**Decision B — Workspace dep wiring.**
`apps/agent` adds `"@operscale-calendar/web": "workspace:*"` to its `dependencies` so the agent can `import { BriefEmail } from '@operscale-calendar/web/emails/BriefEmail'`. This requires `apps/web/package.json` to either expose `./emails/*` via the `exports` field OR for the import to use a deep relative-from-workspace-root path. Cleanest: `apps/web/package.json` adds `"exports": { "./emails/*": "./src/emails/*" }`. Task 4 owns this.

**Decision C — Sender address kept as-is.**
`RESEND_SENDER` on the VPS is currently `akinwunmi.akinrimisi@operscale.cloud`. Spec calls for `noreply@operscale.cloud`. Phase 4.5 keeps the current sender — switching would require a Resend domain re-verification and DKIM check. The `from` line in the actual email reads `Operscale <akinwunmi.akinrimisi@operscale.cloud>` for now. Brand-comms cleanup is a separate phase.

**Decision D — `NEXT_PUBLIC_FOUNDER_NAME` env var added.**
The brief email signs off as the founder. We need a `NEXT_PUBLIC_FOUNDER_NAME` env var (value: `Akinwunmi`). Task 7 documents the manual VPS step to add it to `/etc/operscale-calendar/agent.env`. The code falls back to `'Operscale'` if unset.

**Decision E — Status `payment_initiated` is unused in 4.5.**
Per the design doc §5, Phase 4.5 transitions `founder_approved → brief_sent` directly. `payment_initiated_at` IS set when Paystack init succeeds (column on `orders`), but `status='payment_initiated'` is NOT written. Phase 4.6 may reuse that status if a Paystack "transaction created" webhook ever exists; for now it's reserved.

---

## File structure (Phase 4.5)

| Path | Status | Responsibility |
|---|---|---|
| `apps/agent/src/lib/snapshot-to-email-props.ts` | Create | Pure mapping `(SupersetOutput, Order, Customer, paymentLink) → BriefEmailProps`. Contains `TIER_DISPLAY` const for human-readable tier metadata. |
| `apps/agent/src/lib/snapshot-to-email-props.test.ts` | Create | Unit tests (10 cases) for the pure mapper. |
| `apps/agent/src/lib/paystack.ts` | Modify | Implement `initializeTransaction()`. Adds `PaystackInitError` exported class. |
| `apps/agent/src/lib/paystack.test.ts` | Create | Unit tests for `initializeTransaction` (7 cases) + extends existing `verifyWebhookSignature` cases (already in scope). |
| `apps/agent/src/lib/email.ts` | Modify | Implement `sendEmail()` for `templateKey === 'brief-email'` only. Adds `EmailSendError` exported class. |
| `apps/agent/src/lib/email.test.ts` | Create | Unit tests for `sendEmail` (6 cases). |
| `apps/web/src/emails/BriefEmail.tsx` | Create | React Email component matching email-templates.md §"Template 3" verbatim. |
| `apps/web/src/emails/BriefEmail.test.tsx` | Create | Snapshot test that renders with mock props and asserts conditional blocks toggle correctly. |
| `apps/web/package.json` | Modify | Add `@react-email/components` + `@react-email/render` deps; add `exports./emails/*` field. |
| `apps/agent/package.json` | Modify | Add `"@operscale-calendar/web": "workspace:*"` workspace dep. |
| `apps/agent/src/app/v1/brief/approve/route.ts` | Modify | Extend post-Phase-4 handler with Paystack init + email render+send + status flips. |
| `apps/agent/src/app/v1/brief/approve/route.test.ts` | Modify | Extend existing 7 tests with 7 new (per design §7.1). |
| `docs/plans/2026-05-05-v2-phase-4-5-paystack-resend.md` | This file | The plan. |

---

## Surface contracts (informational — locked by design doc)

```ts
// snapshot-to-email-props.ts
export type BriefEmailProps = {
  firstName: string;
  briefSummary: string;
  angles: Array<{ title: string; hook: string; whyItFits: string }>;
  scriptSeed: { topic: string; openingHook: string; outline: string[] };
  visualStyle: { recommendedCameraTreatment: string; recommendedCaptionStyle: string };
  photoAesthetic: { recommendedAvatarTreatment: string } | null;
  tierName: string;
  priceNgn: number;
  videoCount: number;
  carouselCount: number;
  ugcCount: number;
  t2vCount: number;
  carouselPages: number;
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

export function snapshotToEmailProps(
  run: { ai_output: SupersetOutput },
  order: { id: string; tier: Tier; amount_ngn: number; customer_id: string; brief_id: string },
  customer: { full_name: string | null; email: string },
  paymentLink: string,
): BriefEmailProps;

// paystack.ts
export class PaystackInitError extends Error {
  constructor(public detail: { status: number; message: string });
}

// email.ts
export class EmailSendError extends Error {
  constructor(public detail: string | { status: number; message: string });
}

// /v1/brief/approve response (Phase 4.5)
type ApproveResponse =
  | { order_id: string; framework_history_rows_written: number; paystack_tx_ref: string;
      brief_email_sent: true; resend_message_id: string }                                   // 200
  | { error: 'paystack_init_failed'; detail: string }                                       // 502
  | { error: 'email_send_failed'; tx_ref: string; detail: string };                         // 502
```

---

## Task 1 — `snapshot-to-email-props.ts` (pure mapping)

**Files:**
- Create: `apps/agent/src/lib/snapshot-to-email-props.ts`
- Create: `apps/agent/src/lib/snapshot-to-email-props.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/lib/snapshot-to-email-props.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { snapshotToEmailProps, TIER_DISPLAY } from './snapshot-to-email-props';
import type { SupersetOutput } from './types/v2.js';

const baseAi: SupersetOutput = {
  brand_voice: { voice_phrases: ['hand-finished'], sentence_rhythm: 'short_punchy', avoid_words: [], energy_register: 'calm', voice_corpus_quality: 'thick' },
  specificity_inventory: { numbers: ['14 hours'], proper_nouns: ['Lagos'], process_steps: ['hand-finishing'], specificity_corpus_quality: 'thick' },
  expertise_map: [],
  visual_aesthetic: { lighting: 'natural daylight', setting: 'studio in Lekki', wardrobe_props: 'ankara fabric rolls', photo_quality_summary: 'clean, well-lit', photos_present: false },
  calendar_plan: [
    { slot_index: 1, day: 1, format: 'ugc_30s', framework_slot: 'AIDA', archetype_slot: 'QUALITY_MOMENT', topic: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', core_beats: ['Three weeks. Not six. Three.', 'Hand-finishing on every seam', 'Lekki studio'], cta: 'Book a fitting', fabrication_risk_check: 'passed' },
    { slot_index: 2, day: 2, format: 'ugc_30s', framework_slot: 'PAS',  archetype_slot: 'PROCESS_TOUR',   topic: 'Inside the hand-finishing process', hook: 'Why your last ankara dress fell apart', core_beats: ['Cheap thread', 'Wrong wash temperature', 'How we differ'], cta: 'See the workshop', fabrication_risk_check: 'passed' },
    { slot_index: 3, day: 3, format: 'ugc_60s', framework_slot: 'COST_REVEAL', archetype_slot: 'OUTCOME_SHOWCASE', topic: 'Real customer outcome', hook: 'She wore this to her promotion dinner', core_beats: ['Brief', 'Fitting', 'Final piece'], cta: 'Submit your brief', fabrication_risk_check: 'passed' },
  ],
  fabrication_audit: { lines_checked: 3, violations_found: [], audit_passed: true },
  flags_for_review: [],
  brief_summary: 'Bespoke ankara tailoring with three-week guaranteed turnaround for Lagos professionals.',
  upsell_recommendation: { should_upsell: false, recommended_tier: null, reasoning: '', upsell_price_delta: 0 },
  estimated_brief_quality_score: 0.82,
};

const baseOrder = { id: 'order-1', tier: 'standard' as const, amount_ngn: 150_000, customer_id: 'cust-1', brief_id: 'brief-1' };
const baseCustomer = { full_name: 'Tola Adekunle', email: 'tola@example.com' };
const paymentLink = 'https://checkout.paystack.com/abc123';

describe('snapshotToEmailProps', () => {
  it('maps the happy path: standard tier, no photos, no upsell', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, baseCustomer, paymentLink);
    expect(props.firstName).toBe('Tola');
    expect(props.briefSummary).toBe(baseAi.brief_summary);
    expect(props.angles).toHaveLength(3);
    expect(props.angles[0]).toEqual({ title: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', whyItFits: 'Three weeks. Not six. Three.' });
    expect(props.scriptSeed).toEqual({ topic: 'Three-week turnaround', openingHook: 'You think bespoke means waiting six weeks?', outline: ['Three weeks. Not six. Three.', 'Hand-finishing on every seam', 'Lekki studio'] });
    expect(props.visualStyle.recommendedCameraTreatment).toBe('natural daylight; studio in Lekki; ankara fabric rolls');
    expect(props.photoAesthetic).toBeNull();
    expect(props.upsell).toBeNull();
    expect(props.tierName).toBe(TIER_DISPLAY.standard.tierName);
    expect(props.videoCount).toBe(14);
    expect(props.carouselCount).toBe(7);
    expect(props.ugcCount).toBe(TIER_DISPLAY.standard.ugcCount);
    expect(props.t2vCount).toBe(TIER_DISPLAY.standard.t2vCount);
    expect(props.priceNgn).toBe(150_000);
    expect(props.paymentLink).toBe(paymentLink);
    expect(props.founderName).toBe('Akinwunmi'); // env fallback default
    expect(props.brandName).toBe('Operscale');
  });

  it('renders photos block when visual_aesthetic.photos_present', () => {
    const ai = { ...baseAi, visual_aesthetic: { ...baseAi.visual_aesthetic, photos_present: true, photo_quality_summary: 'sharp, well-lit, founder visible' } };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.photoAesthetic).toEqual({ recommendedAvatarTreatment: 'sharp, well-lit, founder visible' });
  });

  it('renders upsell block when should_upsell + recommended_tier', () => {
    const ai = { ...baseAi, upsell_recommendation: { should_upsell: true, recommended_tier: 'calendar' as const, reasoning: 'Audience belief gap is wide; calendar tier gives 30 videos to drill.', upsell_price_delta: 200_000 } };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.upsell).toEqual({
      recommendedTier: TIER_DISPLAY.calendar.tierName,
      reasoning: 'Audience belief gap is wide; calendar tier gives 30 videos to drill.',
      priceDeltaNgn: 200_000,
      recommendedTierPriceNgn: TIER_DISPLAY.calendar.priceNgn,
    });
  });

  it('skips upsell block when should_upsell true but recommended_tier null', () => {
    const ai = { ...baseAi, upsell_recommendation: { should_upsell: true, recommended_tier: null, reasoning: 'Mismatch', upsell_price_delta: 0 } };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.upsell).toBeNull();
  });

  it('falls back to "there" when full_name is null', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, { full_name: null, email: 'x@y.z' }, paymentLink);
    expect(props.firstName).toBe('there');
  });

  it('falls back to "there" when full_name is empty string', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, { full_name: '   ', email: 'x@y.z' }, paymentLink);
    expect(props.firstName).toBe('there');
  });

  it('takes first whitespace-split token as firstName', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, { full_name: 'Mary-Jane Watson Smith', email: 'x@y.z' }, paymentLink);
    expect(props.firstName).toBe('Mary-Jane');
  });

  it('uses cta as whyItFits fallback when core_beats is empty', () => {
    const ai = { ...baseAi, calendar_plan: [
      { ...baseAi.calendar_plan[0], core_beats: [] },
      ...baseAi.calendar_plan.slice(1),
    ] };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.angles[0].whyItFits).toBe(ai.calendar_plan[0].cta);
  });

  it('maps starter tier counts and price', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, { ...baseOrder, tier: 'starter', amount_ngn: TIER_DISPLAY.starter.priceNgn }, baseCustomer, paymentLink);
    expect(props.videoCount).toBe(7);
    expect(props.carouselCount).toBe(3);
    expect(props.tierName).toBe(TIER_DISPLAY.starter.tierName);
  });

  it('captionStyle is derived from brand_voice rhythm + register', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, baseCustomer, paymentLink);
    expect(props.visualStyle.recommendedCaptionStyle).toMatch(/short, punchy/i);
    expect(props.visualStyle.recommendedCaptionStyle).toMatch(/calm/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/agent
npx vitest run src/lib/snapshot-to-email-props.test.ts
```

Expected: 10 failures with "Cannot find module './snapshot-to-email-props'".

- [ ] **Step 3: Implement `snapshot-to-email-props.ts`**

Create `apps/agent/src/lib/snapshot-to-email-props.ts`:

```ts
// apps/agent/src/lib/snapshot-to-email-props.ts
//
// Pure mapping: SupersetOutput (analysis_runs.ai_output) + Order + Customer
// → BriefEmailProps. Consumed by /v1/brief/approve to render BriefEmail.tsx.
//
// AiOutput → email-prop divergence (see plan Decision A): the email-templates.md
// spec describes email-friendly fields (angles, scriptSeed, visualStyle.*)
// that are not first-class on AiOutput. We derive them here from
// calendar_plan[0..2], visual_aesthetic, and brand_voice.

import type { SupersetOutput, Tier } from './types/v2.js';

export type BriefEmailProps = {
  firstName: string;
  briefSummary: string;
  angles: Array<{ title: string; hook: string; whyItFits: string }>;
  scriptSeed: { topic: string; openingHook: string; outline: string[] };
  visualStyle: { recommendedCameraTreatment: string; recommendedCaptionStyle: string };
  photoAesthetic: { recommendedAvatarTreatment: string } | null;
  tierName: string;
  priceNgn: number;
  videoCount: number;
  carouselCount: number;
  ugcCount: number;
  t2vCount: number;
  carouselPages: number;
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

interface TierDisplay {
  tierName: string;
  priceNgn: number;
  videoCount: number;
  carouselCount: number;
  ugcCount: number;
  t2vCount: number;
  carouselPages: number;
  deliveryWindow: string;
}

// Mirrors TIER_COUNTS in types/v2.ts and TIER_PRICES_NGN in post-processor.ts.
// Co-located here so the email-prop layer has one source for human-readable
// tier metadata. If a second consumer ever needs these strings, lift them.
export const TIER_DISPLAY: Record<Tier, TierDisplay> = {
  starter: {
    tierName: 'Starter',
    priceNgn: 150_000,
    videoCount: 7,
    carouselCount: 3,
    ugcCount: 4,
    t2vCount: 3,
    carouselPages: 18,
    deliveryWindow: '5-7 business days',
  },
  standard: {
    tierName: 'Standard',
    priceNgn: 350_000,
    videoCount: 14,
    carouselCount: 7,
    ugcCount: 8,
    t2vCount: 6,
    carouselPages: 42,
    deliveryWindow: '7-10 business days',
  },
  calendar: {
    tierName: 'Calendar',
    priceNgn: 750_000,
    videoCount: 30,
    carouselCount: 14,
    ugcCount: 16,
    t2vCount: 14,
    carouselPages: 84,
    deliveryWindow: '10-14 business days',
  },
};

const RHYTHM_LABEL: Record<SupersetOutput['brand_voice']['sentence_rhythm'], string> = {
  short_punchy: 'short, punchy lines',
  mid_length:   'measured, mid-length lines',
  dense:        'dense, layered lines',
};

const REGISTER_LABEL: Record<SupersetOutput['brand_voice']['energy_register'], string> = {
  calm:           'calm authority',
  urgent:         'urgent edge',
  playful:        'playful energy',
  authoritative:  'firm authority',
  irreverent:     'irreverent bite',
  warm:           'warm tone',
};

function deriveFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0]!;
}

export function snapshotToEmailProps(
  run: { ai_output: SupersetOutput },
  order: { id: string; tier: Tier; amount_ngn: number; customer_id: string; brief_id: string },
  customer: { full_name: string | null; email: string },
  paymentLink: string,
): BriefEmailProps {
  const ai = run.ai_output;
  const tierD = TIER_DISPLAY[order.tier];

  // Angles: first 3 calendar slots → marketing-shaped triple.
  const slots = ai.calendar_plan.slice(0, 3);
  const angles = slots.map((slot) => ({
    title: slot.topic,
    hook:  slot.hook,
    whyItFits: slot.core_beats[0] ?? slot.cta,
  }));

  // ScriptSeed: deeper read of slot[0] for the email's "first video" preview.
  const seed = ai.calendar_plan[0]!;
  const scriptSeed = {
    topic: seed.topic,
    openingHook: seed.hook,
    outline: seed.core_beats,
  };

  // Visual style: concatenate physical aesthetic; describe caption tone from brand_voice.
  const va = ai.visual_aesthetic;
  const visualStyle = {
    recommendedCameraTreatment: `${va.lighting}; ${va.setting}; ${va.wardrobe_props}`,
    recommendedCaptionStyle:    `${RHYTHM_LABEL[ai.brand_voice.sentence_rhythm]} with ${REGISTER_LABEL[ai.brand_voice.energy_register]}`,
  };

  const photoAesthetic = va.photos_present
    ? { recommendedAvatarTreatment: va.photo_quality_summary }
    : null;

  // Upsell: only render block if we have both a flag AND a recommended tier.
  const ur = ai.upsell_recommendation;
  const upsell = ur.should_upsell && ur.recommended_tier
    ? {
        recommendedTier: TIER_DISPLAY[ur.recommended_tier].tierName,
        reasoning: ur.reasoning,
        priceDeltaNgn: ur.upsell_price_delta,
        recommendedTierPriceNgn: TIER_DISPLAY[ur.recommended_tier].priceNgn,
      }
    : null;

  return {
    firstName: deriveFirstName(customer.full_name),
    briefSummary: ai.brief_summary,
    angles,
    scriptSeed,
    visualStyle,
    photoAesthetic,
    tierName: tierD.tierName,
    priceNgn: order.amount_ngn,
    videoCount: tierD.videoCount,
    carouselCount: tierD.carouselCount,
    ugcCount: tierD.ugcCount,
    t2vCount: tierD.t2vCount,
    carouselPages: tierD.carouselPages,
    deliveryWindow: tierD.deliveryWindow,
    upsell,
    paymentLink,
    founderName: process.env.NEXT_PUBLIC_FOUNDER_NAME ?? 'Akinwunmi',
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Operscale',
  };
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/lib/snapshot-to-email-props.test.ts
npm run typecheck
```

Expected: 10/10 pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/snapshot-to-email-props.ts apps/agent/src/lib/snapshot-to-email-props.test.ts
git commit -m "feat(agent): snapshot-to-email-props pure mapping for brief email

Maps SupersetOutput + Order + Customer + paymentLink → BriefEmailProps.
Resolves the AiOutput-to-email-template divergence by deriving
angles/scriptSeed/visualStyle/photoAesthetic from existing AiOutput
fields (calendar_plan[0..2], visual_aesthetic, brand_voice). Pure,
10 unit tests, no DB or network."
```

---

## Task 2 — `paystack.ts::initializeTransaction` (fill stub)

**Files:**
- Modify: `apps/agent/src/lib/paystack.ts`
- Create: `apps/agent/src/lib/paystack.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/lib/paystack.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeTransaction, PaystackInitError, paystackReference, ngnToKobo, verifyWebhookSignature } from './paystack';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_KEY = process.env.PAYSTACK_SECRET_KEY;

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_dummy';
  vi.useFakeTimers();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  process.env.PAYSTACK_SECRET_KEY = ORIGINAL_KEY;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  global.fetch = vi.fn().mockImplementation(impl as any) as any;
}

const validInput = {
  email: 'tola@example.com',
  amountNgn: 150_000,
  reference: 'ops-cal-order-1-1714742400',
  callbackUrl: 'https://operscale.cloud/payment/return?order_id=order-1',
  metadata: { order_id: 'order-1', brief_id: 'brief-1' },
};

describe('initializeTransaction', () => {
  it('returns authorizationUrl on 200 happy path', async () => {
    mockFetch(async (url, init) => {
      expect(url).toBe('https://api.paystack.co/transaction/initialize');
      const body = JSON.parse(init.body as string);
      expect(body.amount).toBe(15_000_000); // amountNgn × 100 = kobo
      expect(body.currency).toBe('NGN');
      expect(body.reference).toBe(validInput.reference);
      expect(body.callback_url).toBe(validInput.callbackUrl);
      expect(body.metadata).toEqual(validInput.metadata);
      expect(body.channels).toEqual(['card', 'bank_transfer', 'ussd', 'qr', 'mobile_money', 'bank']);
      expect((init.headers as any).Authorization).toBe('Bearer sk_test_dummy');
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'access-1', reference: validInput.reference } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await initializeTransaction(validInput);
    expect(result).toEqual({ authorizationUrl: 'https://checkout.paystack.com/abc', accessCode: 'access-1', reference: validInput.reference });
  });

  it('throws PaystackInitError on 4xx with parsed message', async () => {
    mockFetch(async () => new Response(JSON.stringify({ status: false, message: 'Invalid amount' }), { status: 400, headers: { 'content-type': 'application/json' } }));
    await expect(initializeTransaction(validInput)).rejects.toMatchObject({
      detail: { status: 400, message: 'Invalid amount' },
    });
  });

  it('throws PaystackInitError when PAYSTACK_SECRET_KEY missing', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    await expect(initializeTransaction(validInput)).rejects.toMatchObject({ detail: { message: expect.stringContaining('missing') } });
  });

  it('retries on 5xx and succeeds on second attempt', async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls === 1) return new Response('upstream', { status: 503 });
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/y', access_code: 'a2', reference: validInput.reference } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const promise = initializeTransaction(validInput);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/y');
    expect(calls).toBe(2);
  });

  it('throws after 3 5xx retries', async () => {
    mockFetch(async () => new Response('upstream', { status: 502 }));
    const promise = initializeTransaction(validInput);
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
    await expect(promise).rejects.toBeInstanceOf(PaystackInitError);
  });

  it('falls back to verify on duplicate-reference error', async () => {
    let calls = 0;
    mockFetch(async (url) => {
      calls++;
      if (calls === 1) {
        expect(url).toContain('/transaction/initialize');
        return new Response(JSON.stringify({ status: false, message: 'Duplicate Transaction Reference' }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      expect(url).toContain(`/transaction/verify/${validInput.reference}`);
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/dup', reference: validInput.reference, access_code: 'access-existing' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await initializeTransaction(validInput);
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/dup');
    expect(calls).toBe(2);
  });

  it('throws on network error after retries', async () => {
    mockFetch(async () => { throw new TypeError('Network down'); });
    const promise = initializeTransaction(validInput);
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
    await expect(promise).rejects.toBeInstanceOf(PaystackInitError);
  });
});

describe('paystackReference', () => {
  it('produces ops-cal-{order_id}-{unix_ts}', () => {
    const ref = paystackReference('abc-123');
    expect(ref).toMatch(/^ops-cal-abc-123-\d{10}$/);
  });
});

describe('ngnToKobo', () => {
  it('multiplies whole NGN by 100', () => {
    expect(ngnToKobo(150_000)).toBe(15_000_000);
  });
  it('throws on non-positive integer', () => {
    expect(() => ngnToKobo(0)).toThrow();
    expect(() => ngnToKobo(-10)).toThrow();
    expect(() => ngnToKobo(1.5)).toThrow();
  });
});

describe('verifyWebhookSignature', () => {
  const SECRET = 'sk_test_dummy';
  it('returns true on valid HMAC-SHA512', () => {
    const body = '{"event":"charge.success"}';
    const sig = require('node:crypto').createHmac('sha512', SECRET).update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
  });
  it('returns false on mismatched HMAC', () => {
    expect(verifyWebhookSignature('{"event":"x"}', 'aaaa', SECRET)).toBe(false);
  });
  it('returns false on missing signature', () => {
    expect(verifyWebhookSignature('{}', null, SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/paystack.test.ts
```

Expected: 7 failures in `initializeTransaction` block (current stub throws `'not implemented'`); the 4 helper tests for `paystackReference`/`ngnToKobo`/`verifyWebhookSignature` may already pass (existing impl). Net: at least 7 failures.

- [ ] **Step 3: Implement `initializeTransaction`**

Replace the stub in `apps/agent/src/lib/paystack.ts`. Keep the existing helpers; replace only the stub function and add `PaystackInitError`:

```ts
// Add near the top, after the existing imports:
const RETRY_DELAYS_MS = [500, 1000, 2000];

export class PaystackInitError extends Error {
  constructor(public detail: { status: number; message: string }) {
    super(`paystack_init_failed: ${detail.status} ${detail.message}`);
    this.name = 'PaystackInitError';
  }
}

interface PaystackEnvelope<T> {
  status: boolean;
  message?: string;
  data?: T;
}

interface InitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

async function paystackPost<T>(path: string, body: unknown, secret: string): Promise<{ status: number; envelope: PaystackEnvelope<T> | null }> {
  const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let envelope: PaystackEnvelope<T> | null = null;
  try { envelope = (await res.json()) as PaystackEnvelope<T>; } catch { /* non-json upstream errors */ }
  return { status: res.status, envelope };
}

async function paystackGet<T>(path: string, secret: string): Promise<{ status: number; envelope: PaystackEnvelope<T> | null }> {
  const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  });
  let envelope: PaystackEnvelope<T> | null = null;
  try { envelope = (await res.json()) as PaystackEnvelope<T>; } catch {}
  return { status: res.status, envelope };
}

const DEFAULT_CHANNELS: NonNullable<InitializeTransactionInput['channels']> = ['card', 'bank_transfer', 'ussd', 'qr', 'mobile_money', 'bank'];

export async function initializeTransaction(
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new PaystackInitError({ status: 0, message: 'missing PAYSTACK_SECRET_KEY' });
  }

  const body = {
    email: input.email,
    amount: ngnToKobo(input.amountNgn),
    currency: 'NGN' as const,
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata ?? {},
    channels: input.channels ?? DEFAULT_CHANNELS,
  };

  // Retry loop: 4 attempts (initial + 3 retries) on 5xx or network error.
  let lastErr: { status: number; message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    let result;
    try {
      result = await paystackPost<InitData>('/transaction/initialize', body, secret);
    } catch (e) {
      lastErr = { status: 0, message: e instanceof Error ? e.message : 'network_error' };
      continue;
    }
    const { status, envelope } = result;
    if (status >= 200 && status < 300 && envelope?.status === true && envelope.data) {
      return {
        authorizationUrl: envelope.data.authorization_url,
        accessCode: envelope.data.access_code,
        reference: envelope.data.reference,
      };
    }
    if (status >= 400 && status < 500) {
      const msg = envelope?.message ?? 'unknown_4xx';
      // Duplicate-reference fallback: re-fetch the existing transaction.
      if (msg.toLowerCase().includes('duplicate transaction reference')) {
        const verify = await paystackGet<InitData>(`/transaction/verify/${input.reference}`, secret);
        if (verify.status >= 200 && verify.status < 300 && verify.envelope?.status === true && verify.envelope.data) {
          return {
            authorizationUrl: verify.envelope.data.authorization_url,
            accessCode: verify.envelope.data.access_code ?? '',
            reference: verify.envelope.data.reference,
          };
        }
      }
      throw new PaystackInitError({ status, message: msg });
    }
    // 5xx → retry
    lastErr = { status, message: envelope?.message ?? 'upstream_5xx' };
  }
  throw new PaystackInitError(lastErr ?? { status: 0, message: 'init_failed_no_response' });
}
```

Update the `paystack.ts` exports and remove the old `// TODO(Operscale)` comment.

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/lib/paystack.test.ts
npm run typecheck
```

Expected: all pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/paystack.ts apps/agent/src/lib/paystack.test.ts
git commit -m "feat(agent): paystack initializeTransaction implementation

POST /transaction/initialize with bearer auth, amount in kobo, NGN.
4-attempt retry on 5xx + network (delays 500/1000/2000ms). 4xx throws
PaystackInitError with parsed message. Duplicate-reference response
falls back to GET /transaction/verify and reuses the existing
authorization_url. Helper unit tests for paystackReference/ngnToKobo/
verifyWebhookSignature included."
```

---

## Task 3 — `email.ts::sendEmail` (Resend wrapper)

**Files:**
- Modify: `apps/agent/src/lib/email.ts`
- Create: `apps/agent/src/lib/email.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/agent/src/lib/email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, EmailSendError } from './email';

const ORIGINAL_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_SENDER = process.env.RESEND_SENDER;

let activityRows: any[];
let supabaseMock: any;
let resendSpy: ReturnType<typeof vi.fn>;

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: any[]) => resendSpy(...args) };
    constructor(_apiKey: string) {}
  },
}));

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => supabaseMock,
  writeActivityLog: vi.fn(),
}));

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test_dummy';
  process.env.RESEND_SENDER = 'noreply@example.com';
  vi.useFakeTimers();
  activityRows = [];
  resendSpy = vi.fn();
  supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === 'activity_log') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: activityRows, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation(async (row: any) => { activityRows.push(row); return { error: null }; }),
        };
      }
      return {};
    }),
  };
});

afterEach(() => {
  process.env.RESEND_API_KEY = ORIGINAL_KEY;
  process.env.RESEND_SENDER = ORIGINAL_SENDER;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const baseInput = {
  to: 'tola@example.com',
  templateKey: 'brief-email' as const,
  subject: 'Your Operscale calendar brief is ready',
  html: '<p>brief</p>',
  text: 'brief',
  customerId: 'cust-1',
  briefId: 'brief-1',
  orderId: 'order-1',
};

describe('sendEmail', () => {
  it('sends via Resend on happy path and INSERTs activity_log', async () => {
    resendSpy.mockResolvedValueOnce({ data: { id: 'resend-msg-1' }, error: null });
    const result = await sendEmail(baseInput);
    expect(result).toEqual({ resendMessageId: 'resend-msg-1' });
    expect(resendSpy).toHaveBeenCalledTimes(1);
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0]).toMatchObject({
      event_type: 'brief_email_sent',
      order_id: 'order-1',
      payload: expect.objectContaining({ resend_message_id: 'resend-msg-1', template_key: 'brief-email' }),
    });
  });

  it('returns cached resend_message_id without calling Resend on idempotency hit', async () => {
    activityRows = [{ payload: { resend_message_id: 'cached-msg', template_key: 'brief-email' } }];
    // Re-mock supabase so its initial select returns the cached row.
    supabaseMock.from = vi.fn((table: string) => {
      if (table === 'activity_log') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: activityRows, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });
    const result = await sendEmail(baseInput);
    expect(result).toEqual({ resendMessageId: 'cached-msg' });
    expect(resendSpy).not.toHaveBeenCalled();
  });

  it('throws EmailSendError on Resend 4xx', async () => {
    resendSpy.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'Invalid email', statusCode: 400 } });
    await expect(sendEmail(baseInput)).rejects.toBeInstanceOf(EmailSendError);
  });

  it('retries on Resend 5xx and succeeds on second attempt', async () => {
    resendSpy
      .mockResolvedValueOnce({ data: null, error: { name: 'application_error', message: 'upstream', statusCode: 503 } })
      .mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });
    const promise = sendEmail(baseInput);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result.resendMessageId).toBe('msg-2');
    expect(resendSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after 3 5xx retries', async () => {
    resendSpy.mockResolvedValue({ data: null, error: { name: 'application_error', message: 'upstream', statusCode: 503 } });
    const promise = sendEmail(baseInput);
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
    await expect(promise).rejects.toBeInstanceOf(EmailSendError);
    expect(resendSpy).toHaveBeenCalledTimes(4);
  });

  it('throws on unsupported templateKey', async () => {
    await expect(sendEmail({ ...baseInput, templateKey: 'auto-ack' })).rejects.toBeInstanceOf(EmailSendError);
    expect(resendSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/email.test.ts
```

Expected: 6 failures from current stub throwing `'sendEmail not implemented'`.

- [ ] **Step 3: Implement `sendEmail`**

Replace the stub in `apps/agent/src/lib/email.ts`:

```ts
// apps/agent/src/lib/email.ts
//
// Resend wrapper for transactional emails. Phase 4.5 implements brief-email
// only. Other template keys throw EmailSendError('not_implemented_template').
//
// SOURCE OF TRUTH: docs/specs/email-templates.md.
//
// Idempotency: before sending, check activity_log for a brief_email_sent on
// this order within the last 1h. If present, reuse the cached resend_message_id
// without calling Resend. After 1h, deliberate retries are allowed (founder
// fixed customer email, etc.).

import { Resend } from 'resend';
import { getSupabaseAdmin } from './supabase-admin.js';

export type TemplateKey =
  | 'auto-ack'
  | 'save-token'
  | 'brief-email'
  | 'payment-confirmation'
  | 'recovery-form'
  | 'recovery-brief'
  | 'recovery-payment';

export interface SendEmailInput {
  to: string;
  templateKey: TemplateKey;
  subject: string;
  html: string;
  text: string;
  customerId: string;
  briefId?: string;
  orderId?: string;
}

export interface SendEmailResult {
  resendMessageId: string;
}

export class EmailSendError extends Error {
  constructor(public detail: string | { status: number; message: string }) {
    const msg = typeof detail === 'string' ? detail : `${detail.status} ${detail.message}`;
    super(`email_send_failed: ${msg}`);
    this.name = 'EmailSendError';
  }
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

const SUPPORTED_TEMPLATES: ReadonlyArray<TemplateKey> = ['brief-email'];

async function checkIdempotencyCache(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateKey: TemplateKey,
  orderId: string | undefined,
): Promise<string | null> {
  if (!orderId) return null;
  const eventType = `${templateKey.replace(/-/g, '_')}_sent`; // 'brief_email_sent'
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('activity_log')
    .select('payload')
    .eq('event_type', eventType)
    .eq('order_id', orderId)
    .gt('occurred_at', oneHourAgo)
    .order('occurred_at', { ascending: false })
    .limit(1);
  const row = (data ?? [])[0];
  if (!row) return null;
  const cached = (row.payload as any)?.resend_message_id;
  return typeof cached === 'string' ? cached : null;
}

async function insertActivityLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateKey: TemplateKey,
  resendMessageId: string,
  briefId: string | undefined,
  orderId: string | undefined,
  customerId: string,
): Promise<void> {
  const eventType = `${templateKey.replace(/-/g, '_')}_sent`;
  const { error } = await supabase.from('activity_log').insert({
    event_type: eventType,
    actor: 'system',
    customer_id: customerId,
    brief_id: briefId ?? null,
    order_id: orderId ?? null,
    occurred_at: new Date().toISOString(),
    payload: { resend_message_id: resendMessageId, template_key: templateKey },
  });
  if (error) {
    // Best-effort per CLAUDE.md gotcha #11; log to stderr but don't throw.
    console.error('[email] activity_log insert failed (best-effort):', error.message);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!SUPPORTED_TEMPLATES.includes(input.templateKey)) {
    throw new EmailSendError(`not_implemented_template: ${input.templateKey}`);
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailSendError('missing RESEND_API_KEY');
  const sender = process.env.RESEND_SENDER ?? 'noreply@operscale.cloud';

  const supabase = getSupabaseAdmin();

  // Idempotency cache: skip Resend entirely on hit.
  const cached = await checkIdempotencyCache(supabase, input.templateKey, input.orderId);
  if (cached) return { resendMessageId: cached };

  const resend = new Resend(apiKey);
  let lastErr: { status: number; message: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    let response;
    try {
      response = await resend.emails.send({
        from: sender,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: [
          { name: 'template', value: input.templateKey },
          ...(input.orderId ? [{ name: 'order_id', value: input.orderId }] : []),
        ],
      } as any);
    } catch (e) {
      lastErr = { status: 0, message: e instanceof Error ? e.message : 'network_error' };
      continue;
    }
    if (response.error) {
      const status = (response.error as any).statusCode ?? 0;
      const message = (response.error as any).message ?? 'unknown_resend_error';
      if (status >= 400 && status < 500) {
        throw new EmailSendError({ status, message });
      }
      lastErr = { status, message };
      continue;
    }
    const id = response.data?.id;
    if (!id) {
      lastErr = { status: 0, message: 'resend_returned_no_id' };
      continue;
    }
    await insertActivityLog(supabase, input.templateKey, id, input.briefId, input.orderId, input.customerId);
    return { resendMessageId: id };
  }

  throw new EmailSendError(lastErr ?? { status: 0, message: 'send_failed_no_response' });
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/lib/email.test.ts
npm run typecheck
```

Expected: 6/6 pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/email.ts apps/agent/src/lib/email.test.ts
git commit -m "feat(agent): email sendEmail implementation (Resend, brief-email only)

Resend SDK call with 1h idempotency cache via activity_log lookup.
4-attempt retry on 5xx + network (delays 500/1000/2000ms). 4xx throws
EmailSendError. Unsupported templateKeys (other than brief-email)
throw not_implemented_template. activity_log INSERT is best-effort
(per CLAUDE.md gotcha #11)."
```

---

## Task 4 — `BriefEmail.tsx` React Email component

**Files:**
- Create: `apps/web/src/emails/BriefEmail.tsx`
- Create: `apps/web/src/emails/BriefEmail.test.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/agent/package.json`

- [ ] **Step 1: Add deps + workspace wiring**

Add to `apps/web/package.json`:

```jsonc
{
  // ... existing fields ...
  "dependencies": {
    // ... existing ...
    "@react-email/components": "^0.0.31",
    "@react-email/render": "^1.0.3"
  },
  "exports": {
    "./emails/*": "./src/emails/*"
  }
}
```

Add to `apps/agent/package.json` (under `dependencies`):

```jsonc
"@operscale-calendar/web": "workspace:*"
```

Run `pnpm install` from the repo root.

- [ ] **Step 2: Write failing test**

Create `apps/web/src/emails/BriefEmail.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { BriefEmail } from './BriefEmail';
import type { BriefEmailProps } from '@operscale-calendar/agent/lib/snapshot-to-email-props';

const baseProps: BriefEmailProps = {
  firstName: 'Tola',
  briefSummary: 'Bespoke ankara tailoring with three-week guaranteed turnaround for Lagos professionals.',
  angles: [
    { title: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', whyItFits: 'Three weeks. Not six. Three.' },
    { title: 'Inside the hand-finishing process',  hook: 'Why your last ankara dress fell apart',         whyItFits: 'Cheap thread' },
    { title: 'Real customer outcome',                hook: 'She wore this to her promotion dinner',         whyItFits: 'Brief' },
  ],
  scriptSeed: { topic: 'Three-week turnaround', openingHook: 'You think bespoke means waiting six weeks?', outline: ['Three weeks.', 'Hand-finishing', 'Lekki studio'] },
  visualStyle: { recommendedCameraTreatment: 'natural daylight; studio in Lekki; ankara fabric rolls', recommendedCaptionStyle: 'short, punchy lines with calm authority' },
  photoAesthetic: null,
  tierName: 'Standard',
  priceNgn: 350_000,
  videoCount: 14,
  carouselCount: 7,
  ugcCount: 8,
  t2vCount: 6,
  carouselPages: 42,
  deliveryWindow: '7-10 business days',
  upsell: null,
  paymentLink: 'https://checkout.paystack.com/abc',
  founderName: 'Akinwunmi',
  brandName: 'Operscale',
};

describe('BriefEmail render', () => {
  it('renders the briefSummary, all 3 angles, and the payment link', async () => {
    const html = await render(<BriefEmail {...baseProps} />);
    expect(html).toContain(baseProps.briefSummary);
    for (const angle of baseProps.angles) {
      expect(html).toContain(angle.title);
      expect(html).toContain(angle.hook);
    }
    expect(html).toContain(baseProps.paymentLink);
    expect(html).toContain(`${baseProps.tierName}`);
  });

  it('omits the photos block when photoAesthetic is null', async () => {
    const html = await render(<BriefEmail {...baseProps} />);
    expect(html).not.toContain('A note on your reference photos');
  });

  it('renders the photos block when photoAesthetic is provided', async () => {
    const html = await render(<BriefEmail {...baseProps} photoAesthetic={{ recommendedAvatarTreatment: 'sharp, well-lit' }} />);
    expect(html).toContain('A note on your reference photos');
    expect(html).toContain('sharp, well-lit');
  });

  it('omits the upsell block when upsell is null', async () => {
    const html = await render(<BriefEmail {...baseProps} />);
    expect(html).not.toContain('would the');
  });

  it('renders the upsell block when upsell is provided', async () => {
    const html = await render(<BriefEmail {...baseProps} upsell={{ recommendedTier: 'Calendar', reasoning: 'Audience belief gap is wide.', priceDeltaNgn: 200_000, recommendedTierPriceNgn: 750_000 }} />);
    expect(html).toContain('Calendar');
    expect(html).toContain('200,000');
    expect(html).toContain('750,000');
    expect(html).toContain('Audience belief gap is wide.');
  });

  it('renders plain-text version with conditional blocks honored', async () => {
    const text = await render(<BriefEmail {...baseProps} />, { plainText: true });
    expect(text).toContain(baseProps.briefSummary);
    expect(text).not.toContain('<');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run apps/web/src/emails/BriefEmail.test.tsx
```

Expected: failures with "Cannot find module './BriefEmail'".

- [ ] **Step 4: Implement `BriefEmail.tsx`**

Create `apps/web/src/emails/BriefEmail.tsx`:

```tsx
// apps/web/src/emails/BriefEmail.tsx
//
// React Email component for the brief approval email.
// SOURCE OF TRUTH: docs/specs/email-templates.md §"Template 3: brief-email".
//
// Workspace import path: '@operscale-calendar/web/emails/BriefEmail'.

import {
  Html, Head, Body, Container, Section, Heading, Text, Button, Hr, Link,
} from '@react-email/components';
import type { BriefEmailProps } from '@operscale-calendar/agent/lib/snapshot-to-email-props';

const body: React.CSSProperties = { backgroundColor: '#f5f4f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 0', color: '#1a1a1a' };
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', padding: '32px', borderRadius: '4px' };
const h2: React.CSSProperties = { fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a5a5a', marginTop: '24px', marginBottom: '8px' };
const p: React.CSSProperties = { fontSize: '16px', lineHeight: 1.55, marginBottom: '12px' };
const small: React.CSSProperties = { fontSize: '13px', color: '#5a5a5a' };
const buttonStyle: React.CSSProperties = { backgroundColor: '#1a1a1a', color: '#ffffff', padding: '14px 24px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 };

function fmtNgn(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n);
}

export function BriefEmail(props: BriefEmailProps): JSX.Element {
  const subjectPreview = `${props.brandName} brief — ${props.tierName}, ${props.videoCount} videos`;
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={p}>Hi {props.firstName},</Text>
          <Text style={p}>Here's your personalised content brief.</Text>

          <Heading as="h2" style={h2}>What we heard</Heading>
          <Text style={p}>{props.briefSummary}</Text>

          <Heading as="h2" style={h2}>3 angles we'd open the calendar with</Heading>
          {props.angles.map((angle, i) => (
            <Section key={i}>
              <Text style={{ ...p, fontWeight: 600 }}>{i + 1}. {angle.title}</Text>
              <Text style={p}>Hook: {angle.hook}</Text>
              <Text style={p}>Why this works for you: {angle.whyItFits}</Text>
            </Section>
          ))}

          <Heading as="h2" style={h2}>A taste of how the first video would land</Heading>
          <Text style={p}>Topic: {props.scriptSeed.topic}</Text>
          <Text style={p}>The first 1.5 seconds: "{props.scriptSeed.openingHook}"</Text>
          <Text style={p}>The 30-second arc:</Text>
          {props.scriptSeed.outline.map((beat, i) => (
            <Text key={i} style={p}>— {beat}</Text>
          ))}

          <Heading as="h2" style={h2}>The visual direction we have in mind</Heading>
          <Text style={p}>{props.visualStyle.recommendedCameraTreatment}</Text>
          <Text style={p}>Captions: {props.visualStyle.recommendedCaptionStyle}</Text>
          {props.photoAesthetic && (
            <Text style={p}>A note on your reference photos: {props.photoAesthetic.recommendedAvatarTreatment}</Text>
          )}

          <Heading as="h2" style={h2}>Your package</Heading>
          <Text style={p}>{props.tierName} — ₦{fmtNgn(props.priceNgn)}</Text>
          <Text style={p}>{props.videoCount} short-form videos ({props.ugcCount} with you on camera, {props.t2vCount} cinematic)</Text>
          <Text style={p}>{props.carouselCount} carousels ({props.carouselPages} image cards total)</Text>
          <Text style={p}>Delivered in {props.deliveryWindow}.</Text>

          {props.upsell && (
            <Section>
              <Heading as="h2" style={h2}>One thought — would the {props.upsell.recommendedTier} package be a better fit?</Heading>
              <Text style={p}>{props.upsell.reasoning}</Text>
              <Text style={p}>That's an extra ₦{fmtNgn(props.upsell.priceDeltaNgn)}, totalling ₦{fmtNgn(props.upsell.recommendedTierPriceNgn)}. You can choose either tier on the payment page.</Text>
            </Section>
          )}

          <Hr />

          <Heading as="h2" style={h2}>Next step</Heading>
          <Text style={p}>Pay securely via Paystack:</Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={props.paymentLink} style={buttonStyle}>Pay now</Button>
          </Section>
          <Text style={small}>Or copy this link: <Link href={props.paymentLink}>{props.paymentLink}</Link></Text>

          <Text style={p}>If anything in this brief doesn't quite fit, just reply to this email with what you'd change. No need to pay yet.</Text>

          <Text style={p}>— {props.founderName}<br />{props.brandName}</Text>

          <Hr />
          <Text style={small}>Operscale Limited · operscale.cloud/privacy · operscale.cloud/terms</Text>
        </Container>
        {/* Subject preview helper for tests */}
        <span style={{ display: 'none' }}>{subjectPreview}</span>
      </Body>
    </Html>
  );
}

export default BriefEmail;
```

Note: the import path `@operscale-calendar/agent/lib/snapshot-to-email-props` requires the agent's `package.json` to expose `./lib/*`. If it doesn't already, add an `exports` field to `apps/agent/package.json`:

```jsonc
"exports": {
  "./lib/*": "./src/lib/*"
}
```

If circular workspace dependencies prove troublesome (web → agent for the type, agent → web for the component), the alternative is a tiny shared types-only package. For Phase 4.5 we keep it simple with mutual workspace deps.

- [ ] **Step 5: Verify tests pass + typecheck**

```bash
npx vitest run apps/web/src/emails/BriefEmail.test.tsx
# From repo root:
pnpm --filter @operscale-calendar/web typecheck   # if web has a typecheck script
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/emails/BriefEmail.tsx apps/web/src/emails/BriefEmail.test.tsx apps/web/package.json apps/agent/package.json pnpm-lock.yaml
git commit -m "feat(web): BriefEmail React Email component for /v1/brief/approve

Matches email-templates.md §Template 3 verbatim. Conditional photos
+ upsell blocks driven by null props. Workspace deps wired both ways:
apps/web exports ./emails/*, apps/agent exports ./lib/*. Adds
@react-email/components + @react-email/render to apps/web."
```

---

## Task 5 — `/v1/brief/approve` route extension

**Files:**
- Modify: `apps/agent/src/app/v1/brief/approve/route.ts`
- Modify: `apps/agent/src/app/v1/brief/approve/route.test.ts`

- [ ] **Step 1: Write failing tests** (extend existing route.test.ts)

Append the following block to `apps/agent/src/app/v1/brief/approve/route.test.ts`. Update existing mocks if needed to widen the orders SELECT (now must return `amount_ngn`, `tier`, customer JOIN data).

Add at the top of the file (after existing imports):

```ts
// Phase 4.5 mocks
let paystackInitMock: any;
let sendEmailMock: any;
let resendMessageId: string | null;

vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: any[]) => paystackInitMock(...args),
  paystackReference: (id: string) => `ops-cal-${id}-1714742400`,
  PaystackInitError: class extends Error { constructor(public detail: any) { super('paystack_init_failed'); } },
}));
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: any[]) => sendEmailMock(...args),
  EmailSendError: class extends Error { constructor(public detail: any) { super('email_send_failed'); } },
}));
vi.mock('@operscale-calendar/web/emails/BriefEmail', () => ({
  BriefEmail: () => null,
  default: () => null,
}));
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>brief</html>'),
}));
```

In the existing `beforeEach`, widen `orderRow` to include the new columns:

```ts
orderRow = {
  id: 'order-1',
  brief_id: 'brief-1',
  customer_id: 'cust-1',
  status: 'pending_founder_review',
  tier: 'standard',
  amount_ngn: 350_000,
};
// also reset Phase 4.5 mocks
paystackInitMock = vi.fn().mockResolvedValue({ authorizationUrl: 'https://checkout.paystack.com/abc', accessCode: 'ac', reference: 'ops-cal-order-1-1714742400' });
sendEmailMock = vi.fn().mockResolvedValue({ resendMessageId: 'msg-1' });
resendMessageId = null;
```

Add a `customers` table mock branch in the `from` mock so the route can fetch `email` + `full_name`:

```ts
if (table === 'customers') {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { full_name: 'Tola Adekunle', email: 'tola@example.com' }, error: null }),
      }),
    }),
  };
}
```

Append these new tests after the existing 7:

```ts
describe('Phase 4.5 — Paystack init + Resend send', () => {
  it('happy path: 200 + paystack_tx_ref + brief_email_sent + resend_message_id', async () => {
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      order_id: 'order-1',
      framework_history_rows_written: expect.any(Number),
      paystack_tx_ref: 'ops-cal-order-1-1714742400',
      brief_email_sent: true,
      resend_message_id: 'msg-1',
    });
    // orders updated 3 times: founder_approved, paystack data, brief_sent
    expect(orderUpdates.length).toBeGreaterThanOrEqual(3);
    const finalUpdate = orderUpdates[orderUpdates.length - 1];
    expect(finalUpdate.row.status).toBe('brief_sent');
    expect(finalUpdate.row.brief_email_sent_at).toBeDefined();
  });

  it('paystack init fails: 502 + order stays at founder_approved', async () => {
    const { PaystackInitError } = await import('@/lib/paystack');
    paystackInitMock.mockRejectedValueOnce(new (PaystackInitError as any)({ status: 400, message: 'bad amount' }));
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('paystack_init_failed');
    // order should NOT have been updated to brief_sent or brief_email_failed
    const statusUpdates = orderUpdates.map((u) => u.row.status).filter(Boolean);
    expect(statusUpdates).not.toContain('brief_sent');
    expect(statusUpdates).not.toContain('brief_email_failed');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('resend fails after paystack OK: 502 + order flips to brief_email_failed', async () => {
    const { EmailSendError } = await import('@/lib/email');
    sendEmailMock.mockRejectedValueOnce(new (EmailSendError as any)({ status: 422, message: 'Suppressed address' }));
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe('email_send_failed');
    expect(json.tx_ref).toBe('ops-cal-order-1-1714742400');
    const statusUpdates = orderUpdates.map((u) => u.row.status).filter(Boolean);
    expect(statusUpdates).toContain('brief_email_failed');
    expect(statusUpdates).not.toContain('brief_sent');
  });

  it('retry on brief_email_failed: APPROVABLE_STATUSES allows it', async () => {
    orderRow.status = 'brief_email_failed';
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects on brief_sent: APPROVABLE_STATUSES does not include it', async () => {
    orderRow.status = 'brief_sent';
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('passes correct args to initializeTransaction (email, amount, callback_url, metadata)', async () => {
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    await POST(req);
    expect(paystackInitMock).toHaveBeenCalledWith(expect.objectContaining({
      email: 'tola@example.com',
      amountNgn: 350_000,
      reference: 'ops-cal-order-1-1714742400',
      callbackUrl: expect.stringContaining('/payment/return?order_id=order-1'),
      metadata: expect.objectContaining({ order_id: 'order-1', brief_id: 'brief-1' }),
    }));
  });

  it('passes paymentLink (authorization_url) into the rendered template', async () => {
    const renderModule = await import('@react-email/render');
    const renderSpy = renderModule.render as any;
    const req = new Request('http://x/v1/brief/approve', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${FOUNDER_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ order_id: 'order-1' }),
    });
    await POST(req);
    // The first arg to render() is the React element. Hard to introspect directly,
    // so instead verify sendEmail was called with html that the mock returned.
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'tola@example.com',
      templateKey: 'brief-email',
      html: '<html>brief</html>',
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/v1/brief/approve/route.test.ts
```

Expected: 7 new failures + possibly some existing tests now failing because the orderRow shape widened.

- [ ] **Step 3: Implement the route extension**

Modify `apps/agent/src/app/v1/brief/approve/route.ts`. Keep the existing Phase 4 logic (auth, body parse, order/run lookup, history INSERT, founder_approved UPDATE) unchanged through the activity_log write. Then BEFORE the existing `return NextResponse.json(...)`, insert the Phase 4.5 block:

```ts
// Imports to add at the top:
import { initializeTransaction, paystackReference, PaystackInitError } from '@/lib/paystack';
import { sendEmail, EmailSendError } from '@/lib/email';
import { snapshotToEmailProps } from '@/lib/snapshot-to-email-props';
import { BriefEmail } from '@operscale-calendar/web/emails/BriefEmail';
import { render } from '@react-email/render';
import * as React from 'react';
```

Widen the orders SELECT in the existing fetch:

```ts
const { data: order, error: orderErr } = await supabase
  .from('orders')
  .select('id, brief_id, customer_id, status, tier, amount_ngn')
  .eq('id', parsed.order_id)
  .maybeSingle();
```

After the existing first orders UPDATE (status='founder_approved'), insert this block:

```ts
  // ─── Phase 4.5: Paystack initialise ──────────────────────────────────
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('full_name, email')
    .eq('id', order.customer_id)
    .maybeSingle();
  if (custErr || !customer || !customer.email) {
    return NextResponse.json({ error: 'customer_not_found_or_no_email' }, { status: 400 });
  }

  const txRef = paystackReference(order.id);
  let paystackResult: Awaited<ReturnType<typeof initializeTransaction>>;
  try {
    paystackResult = await initializeTransaction({
      email: customer.email,
      amountNgn: order.amount_ngn,
      reference: txRef,
      callbackUrl: `https://${process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'operscale.cloud'}/payment/return?order_id=${order.id}`,
      metadata: { order_id: order.id, customer_id: order.customer_id, brief_id: order.brief_id, tier: order.tier },
    });
  } catch (e) {
    const detail = e instanceof PaystackInitError ? e.message : String(e);
    await writeActivityLog({ eventType: 'paystack_init_failed', actor: 'system', orderId: order.id, briefId: order.brief_id, payload: { error: detail } }, supabase);
    return NextResponse.json({ error: 'paystack_init_failed', detail }, { status: 502 });
  }

  await supabase.from('orders').update({
    paystack_tx_ref: paystackResult.reference,
    paystack_authorization: paystackResult,
    payment_initiated_at: new Date().toISOString(),
  }).eq('id', order.id);

  // ─── Phase 4.5: Render + Resend send ─────────────────────────────────
  const props = snapshotToEmailProps({ ai_output: run.framework_seed === undefined ? (run as any).ai_output : (run as any).ai_output }, // run already loaded above; widen its select to include ai_output
    { id: order.id, tier: order.tier as any, amount_ngn: order.amount_ngn, customer_id: order.customer_id, brief_id: order.brief_id },
    { full_name: customer.full_name, email: customer.email },
    paystackResult.authorizationUrl,
  );
  const subject = `Your ${props.brandName} calendar brief is ready — ${props.tierName}, ${props.videoCount} videos`;
  const element = React.createElement(BriefEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  let sent: Awaited<ReturnType<typeof sendEmail>>;
  try {
    sent = await sendEmail({
      to: customer.email,
      templateKey: 'brief-email',
      subject, html, text,
      customerId: order.customer_id, briefId: order.brief_id, orderId: order.id,
    });
  } catch (e) {
    const detail = e instanceof EmailSendError ? e.message : String(e);
    await supabase.from('orders').update({ status: 'brief_email_failed' }).eq('id', order.id);
    await writeActivityLog({ eventType: 'brief_email_send_failed', actor: 'system', orderId: order.id, briefId: order.brief_id, payload: { error: detail, tx_ref: paystackResult.reference } }, supabase);
    return NextResponse.json({ error: 'email_send_failed', tx_ref: paystackResult.reference, detail }, { status: 502 });
  }

  await supabase.from('orders').update({
    status: 'brief_sent',
    brief_email_sent_at: new Date().toISOString(),
  }).eq('id', order.id);

  return NextResponse.json({
    order_id: order.id,
    framework_history_rows_written: historyRows.length,
    paystack_tx_ref: paystackResult.reference,
    brief_email_sent: true,
    resend_message_id: sent.resendMessageId,
  }, { status: 200 });
```

Important: the existing analysis_runs SELECT must already include `ai_output` (currently it selects `id, framework_seed`). Widen it to `'id, framework_seed, ai_output'`.

Also widen `APPROVABLE_STATUSES` if needed — review the existing const and confirm `'pending_founder_review'` and `'brief_email_failed'` are both present (they should be per Phase 4 work).

REMOVE the existing terminal `return NextResponse.json({order_id, framework_history_rows_written}, ...)` from Phase 4 — it's superseded by the new return inside the Phase 4.5 block.

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
npx vitest run src/app/v1/brief/approve/route.test.ts
npm run typecheck
```

Expected: all 14 tests pass (7 existing + 7 new); typecheck clean.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: ~232 tests pass (212 from Phase 4 + ~20 new across snapshot-props/paystack/email/route/BriefEmail).

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/app/v1/brief/approve/route.ts apps/agent/src/app/v1/brief/approve/route.test.ts
git commit -m "feat(agent): /v1/brief/approve calls Paystack initialise + sends brief email

Phase 4.5 forward path. After Phase 4 history write + founder_approved
flip, the route now: (1) widens orders SELECT to include amount_ngn +
tier, (2) fetches customer email + full_name, (3) generates tx_ref,
(4) calls initializeTransaction, (5) UPDATEs orders with paystack_tx_ref
+ paystack_authorization + payment_initiated_at, (6) renders BriefEmail
to {html, text} via @react-email/render, (7) sendEmail, (8) flips
status to brief_sent (or brief_email_failed on Resend failure).

Failure paths: paystack 4xx/5xx → 502 + stays founder_approved; resend
4xx/5xx after paystack OK → 502 + flips to brief_email_failed.
brief_email_failed is in APPROVABLE_STATUSES so founder retries are
allowed (idempotency in sendEmail prevents double-send within 1h)."
```

---

## Task 6 — Live staging smoke

**Files:**
- Create: `C:\tmp\phase4-5-smoke.py` (NOT committed; mirrors `C:\tmp\phase4-smoke.py`)

- [ ] **Step 1: Push Tasks 1-5 to origin/main**

```bash
git push origin main
```

- [ ] **Step 2: Pull on VPS + rebuild agent + web images**

```bash
PYTHONIOENCODING=utf-8 python -c "
import paramiko
with open(r'c:\\Users\\DELL\\Documents\\Antigravity\\operscale-calender\\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=30, allow_agent=False, look_for_keys=False)
for cmd in [
    'cd /docker/operscale-calendar/repo && git pull --ff-only origin main',
    # Add NEXT_PUBLIC_FOUNDER_NAME to /etc/operscale-calendar/agent.env if not present.
    \"grep -q '^NEXT_PUBLIC_FOUNDER_NAME=' /etc/operscale-calendar/agent.env || echo 'NEXT_PUBLIC_FOUNDER_NAME=Akinwunmi' >> /etc/operscale-calendar/agent.env\",
    'cd /docker/operscale-calendar && docker compose build agent web 2>&1 | tail -10',
    'cd /docker/operscale-calendar && docker compose up -d --force-recreate agent web 2>&1',
    'sleep 10; docker logs --tail 20 operscale-calendar-agent',
]:
    print(f'>>> {cmd[:90]}')
    _, out, err = c.exec_command(cmd, timeout=600)
    print(out.read().decode())
    e = err.read().decode()
    if e: print('STDERR:', e[:400])
c.close()
"
```

- [ ] **Step 3: Write smoke script**

Create `C:\tmp\phase4-5-smoke.py`. Start by copying `C:\tmp\phase4-smoke.py` and modify the post-`/approve` assertions:

```python
# After the existing POST /v1/brief/approve block, REPLACE the response checks with:
assert status == 200, f"expected 200, got {status}: {body}"
assert "paystack_tx_ref" in body, f"missing paystack_tx_ref: {body}"
assert body["paystack_tx_ref"].startswith("ops-cal-"), f"unexpected tx_ref: {body['paystack_tx_ref']}"
assert body.get("brief_email_sent") is True, f"brief_email_sent missing/false: {body}"
assert "resend_message_id" in body, f"missing resend_message_id: {body}"
print(f"    paystack_tx_ref={body['paystack_tx_ref']}")
print(f"    resend_message_id={body['resend_message_id']}")

# Step 7 (verify) — replace history+status check:
order_row = psql_one(
    c,
    f"select status, paystack_tx_ref, paystack_authorization->>'authorizationUrl' as auth_url, "
    f"brief_email_sent_at is not null, payment_initiated_at is not null "
    f"from orders where id='{ORDER_ID}'",
)
print(f"    order:   {order_row}")
parts = order_row.split("|")
assert parts[0] == "brief_sent", f"expected status=brief_sent, got {parts[0]}"
assert parts[1].startswith("ops-cal-"), f"paystack_tx_ref not stored: {parts[1]}"
assert "paystack.com" in parts[2], f"authorization_url not paystack.com: {parts[2]}"
assert parts[3] == "t", "brief_email_sent_at not set"
assert parts[4] == "t", "payment_initiated_at not set"

# Use a real-ish customer email so the email lands somewhere observable:
# Replace 'tola+phase4-smoke@example.com' with the founder's own email if you
# want to manually confirm receipt. For automated smoke, example.com works
# (Resend will reject example.com; that's a 4xx and falls into the failure
# branch test). Use 'akinolaakinrimisi+smoke@gmail.com' for happy path.
```

Then write a separate failure-branch smoke or modify the script to do three runs:
- Run A: happy path (should succeed end-to-end with `status='brief_sent'`).
- Run B: bad email (`x@example.com`) — should flip to `brief_email_failed`.
- Run C: bad amount (`amount_ngn = -1`) — should fail at Paystack init, stay `founder_approved`.

For Run B and Run C, the cleanup pre-step removes the prior fixture, then the same flow runs with the bad input and asserts the failure branch.

- [ ] **Step 4: Run smoke (happy path first)**

```bash
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-5-smoke.py
```

Expected: `PHASE 4.5 SMOKE: PASS — happy path`. Founder inbox receives the rendered brief email.

- [ ] **Step 5: Run smoke (failure branches)**

Modify the script's email to `x@example.com` (Resend will 422). Re-run. Expected: `brief_email_failed` set; `paystack_authorization` populated (Paystack still ran).

Modify the script's `amount_ngn` to `-1`. Re-run. Expected: status stays `founder_approved`; `paystack_tx_ref` NOT set; route returned 502 with `error='paystack_init_failed'`.

Cleanup all fixtures after each run.

- [ ] **Step 6: Document the smoke in commit body**

Don't commit the smoke output. Capture key details (resend_message_id from happy path, the two failure branch confirmations) and reference them in the close-out commit.

---

## Task 7 — Close-out

**Files:**
- Modify: `docs/plans/2026-05-05-v2-phase-4-5-paystack-resend.md` (this file — flip checkboxes)
- Modify: `prompt.md` (rewrite as Phase 4.6 handoff)
- Modify: memory `project_state.md`

- [ ] **Step 1: Run full verification**

```bash
cd apps/agent
npm test
npm run typecheck
npm run build:worker
```

Expected: ~232 tests pass; typecheck + build:worker clean.

- [ ] **Step 2: Push everything**

```bash
git push origin main
```

(All Phase 4.5 implementation commits already pushed in Task 6 Step 1; this re-push is a no-op if nothing local-only remains.)

- [ ] **Step 3: Update memory project_state.md**

Append a new section "## V2 Phase 4.5 — ✅ COMPLETE 2026-05-XX" with:
- Commit range
- Summary of what shipped (5 components: snapshot-to-email-props, paystack init, email send, BriefEmail React component, /approve extension)
- Smoke results (happy path + 2 failure branches verified)
- Phase 4.6 carry-forwards: webhook handler, payment-confirmation email, charge.success → paid status flip

- [ ] **Step 4: Rewrite prompt.md as Phase 4.6 handoff**

Same pattern as the Phase 4 → Phase 4.5 handoff. Catch-up section reflects Phases 1, 2, 3, 4, 4.5 complete; first-message guides brainstorming for Phase 4.6 (which has fewer open decisions — webhook security is locked in `paystack-integration.md`).

- [ ] **Step 5: Commit close-out**

```bash
git add docs/plans/2026-05-05-v2-phase-4-5-paystack-resend.md prompt.md
git commit -m "docs(phase-4-5): close-out — Paystack init + Resend brief email LIVE

Smoke results:
  Happy path: POST /approve → 200 + paystack_tx_ref + brief_email_sent.
  orders.status flipped pending_founder_review → founder_approved →
  brief_sent. Founder inbox received rendered brief email with working
  Pay button.
  Failure branch A (bad email): orders.status flipped to
  brief_email_failed; paystack_authorization still populated (Paystack
  ran; Resend 422'd). Confirms partial-success recovery path.
  Failure branch B (amount_ngn=-1): orders.status stayed
  founder_approved; no paystack_tx_ref written. Confirms Paystack 4xx
  rolls back cleanly.

Verification at close-out:
  vitest ~232/232 pass
  tsc --noEmit clean (apps/agent + apps/web)
  build:worker clean

V2 Phase 4.5 is COMPLETE. Next: Phase 4.6 (Paystack webhook handler:
charge.success → paid + payment-confirmation email + raw-body HMAC
verification + idempotency on paystack_tx_ref)."
git push origin main
```

---

## Out of scope for Phase 4.5 (carry forward to Phase 4.6 plan)

- `apps/agent/src/app/v1/webhook/paystack/route.ts` — `charge.success` + `charge.failure` handler.
- `payment-confirmation` email template + send path.
- `recovery-form`, `recovery-brief`, `recovery-payment` templates (Phase 4.7+).
- "Resend brief email" CRM action for orders stuck in `brief_email_failed` (Phase 4.5.1).
- Resend bounce/complaint webhook.
- Paystack-reconciliation cron (`supabase/functions/paystack-reconciliation/`).
- Sender-address change from `akinwunmi.akinrimisi@operscale.cloud` to `noreply@operscale.cloud` (brand-comms cleanup).
- WhatsApp send paths (separate phase entirely).

## Self-review notes

- **Spec coverage:** Design doc §3 (architecture) → Tasks 1–5. §4 (components) → Tasks 1–5 one per component. §5 (state machine) → Task 5 implementation. §6 (idempotency) → Task 3 (cache hit) + Task 5 (APPROVABLE_STATUSES). §7 (test plan) → unit tests in each task + Task 6 live smoke. §9 (acceptance criteria) → Task 7 close-out checks.
- **Type consistency:** `BriefEmailProps` is the single source between `snapshot-to-email-props.ts` (Task 1) and `BriefEmail.tsx` (Task 4). `PaystackInitError` and `EmailSendError` are introduced in Tasks 2 + 3 and consumed in Task 5 with the same `detail` shape.
- **No placeholders.** Every step has executable code or commands.
- **AiOutput-to-email-template divergence** is resolved in Task 1 (Decision A) with a concrete mapping. The mapping comments in `snapshot-to-email-props.ts` cross-reference both specs at the source.
- **Phase 4.6 deferral** explicit. Webhook handler is a separate plan with a separate live-payment manual smoke step (the test card flow).
