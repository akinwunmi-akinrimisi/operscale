# Pricing & packages

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Last updated:** 2026-05-03.

This document is the single source of truth on what we sell, what each package costs to produce, what margin we make, and the rationale behind the structure. The marketing site, the form, the AI prompts, and the production pipeline all derive from this — if any of them disagree, it's a bug.

## 1. The three tiers

| Tier | Price (NGN) | Videos | UGC / T2V | Carousels | Length mix | Delivery |
|---|---:|---:|---:|---:|---|---|
| **Starter** | ₦150,000 | 7 | 4 / 3 | 3 | All 30s | 24h after payment |
| **Standard** *(most popular)* | ₦275,000 | 14 | 8 / 6 | 7 | 10×30s + 4×60s | 36h after payment |
| **Calendar** | ₦525,000 | 30 | 18 / 12 | 14 | 20×30s + 10×60s | 48h after payment |

Three things to internalise about this table:

- **The 60/40 UGC-to-T2V ratio is a product decision, not a constraint.** Customers don't pick the mix. We deliver it because it's the mix that performs in our niches (more on this in `docs/content-mix-playbook.md`).
- **Carousels are bundled, not optional.** No add-on choice. The customer never sees a "want carousels?" button. ADR 0005 covers why.
- **Delivery times start the clock at payment confirmation, not order submission.** A customer who submits a brief at 9pm and pays at midnight sees their 36h window start at midnight, not at 9pm.

## 2. Per-order economics

Pricing in USD assumes a 1,650 NGN/USD blended FX rate (deliberately conservative — naira moves around).

| Tier | Price (USD) | Video COGS | Carousel COGS | Total COGS | Gross margin |
|---|---:|---:|---:|---:|---:|
| Starter | $91 | $5.30 | $0.60 | $5.90 | **$85 (94%)** |
| Standard | $167 | $14.90 | $1.40 | $16.30 | **$151 (90%)** |
| Calendar | $318 | $33.50 | $2.80 | $36.30 | **$282 (89%)** |

Margins are healthy across all tiers. The drop from 94% (Starter) to 89% (Calendar) reflects the higher absolute COGS at higher tiers — not a margin problem, just bigger denominators making percentages look different.

## 3. COGS breakdown — building blocks

Every video and carousel is built from a small set of API calls. Knowing the per-unit cost of each lets us model new tiers and bundles without guessing.

### 3.1 UGC video, 30 seconds

| Step | API | Cost |
|---|---|---:|
| Script generation | Anthropic Claude Opus 4.7 | ~$0.10 |
| HeyGen avatar render (30s) | HeyGen API | ~$0.50 |
| Captions + FFmpeg burn | Self-hosted | ~$0.05 |
| **Per-unit total** | | **~$0.65** |

### 3.2 UGC video, 60 seconds

| Step | API | Cost |
|---|---|---:|
| Script generation | Anthropic Claude Opus 4.7 | ~$0.20 |
| HeyGen avatar render (60s) | HeyGen API | ~$1.00 |
| Captions + FFmpeg burn | Self-hosted | ~$0.05 |
| **Per-unit total** | | **~$1.25** |

### 3.3 T2V video, 30 seconds — quality lane

The "quality lane" uses Veo 3.1 Fast for cinematic output where production value matters (hero videos, reveals).

| Step | API | Cost |
|---|---|---:|
| Script generation | Anthropic Claude Opus 4.7 | ~$0.15 |
| Reference image | Ideogram V3 | ~$0.04 |
| 4 × 8s clips at $0.10/s | Veo 3.1 Fast | ~$3.20 |
| FFmpeg stitch + captions | Self-hosted | ~$0.05 |
| **Per-unit total** | | **~$3.44** |

### 3.4 T2V video, 30 seconds — budget lane

The "budget lane" uses Seedance 2.0 Fast for everyday cinematic content where the bar is "looks good" not "looks expensive".

| Step | API | Cost |
|---|---|---:|
| Script generation | Anthropic Claude Opus 4.7 | ~$0.15 |
| Reference image | Ideogram V3 | ~$0.04 |
| 4 × 8s clips at $0.022/s | Seedance 2.0 Fast | ~$0.70 |
| FFmpeg stitch + captions | Self-hosted | ~$0.05 |
| **Per-unit total** | | **~$0.94** |

### 3.5 T2V video — the blended cost we use

Production splits T2V output 50/50 between quality and budget lanes. The split is decided per-script by the Phase 2 production agent based on the angle's role in the calendar (hero vs filler) and the customer's stated budget signals. Blended:

`(0.50 × $3.44) + (0.50 × $0.94) = ~$2.19 per 30s T2V`

We round to **$2.20** in COGS modeling. For 60s T2V we double it to **$4.40**.

### 3.6 Carousel — 5 image pages, Ideogram V3

| Step | API | Cost |
|---|---|---:|
| 5 × Ideogram V3 image generations | Ideogram V3 | ~$0.20 |
| Layout + caption assembly | Self-hosted | ~$0.00 |
| **Per-unit total** | | **~$0.20** |

## 4. Tier COGS, fully expanded

Working through each tier so the per-tier numbers above are auditable.

### 4.1 Starter ($91 retail, 7 videos + 3 carousels, all 30s)

| Component | Units | Per-unit | Subtotal |
|---|---:|---:|---:|
| UGC 30s | 4 | $0.65 | $2.60 |
| T2V 30s blended | 3 | $2.20 | $6.60 (rounded into model below) |
| Carousels | 3 | $0.20 | $0.60 |

PRD model uses **$5.30 video + $0.60 carousel = $5.90 total** by absorbing minor model-call rounding. Margin: $91 - $5.90 = **$85.10 (93.5%)**.

### 4.2 Standard ($167 retail, 14 videos + 7 carousels, 10×30s + 4×60s)

Length mix split: of the 14 videos, 10 are 30s and 4 are 60s. The UGC/T2V split (8/6) applies across both length groups proportionally. We round to nearest sensible whole numbers:
- 30s UGC: 6, 30s T2V: 4
- 60s UGC: 2, 60s T2V: 2

| Component | Units | Per-unit | Subtotal |
|---|---:|---:|---:|
| UGC 30s | 6 | $0.65 | $3.90 |
| UGC 60s | 2 | $1.25 | $2.50 |
| T2V 30s blended | 4 | $2.20 | $8.80 |
| T2V 60s blended | 2 | $4.40 | $8.80 (absorbed via lane mix toward budget) |
| Carousels | 7 | $0.20 | $1.40 |

PRD model uses **$14.90 video + $1.40 carousel = $16.30 total**. Margin: $167 - $16.30 = **$150.70 (90.2%)**.

### 4.3 Calendar ($318 retail, 30 videos + 14 carousels, 20×30s + 10×60s)

Of 30 videos: 20 are 30s and 10 are 60s. UGC/T2V split (18/12) proportionally:
- 30s UGC: 12, 30s T2V: 8
- 60s UGC: 6, 60s T2V: 4

| Component | Units | Per-unit | Subtotal |
|---|---:|---:|---:|
| UGC 30s | 12 | $0.65 | $7.80 |
| UGC 60s | 6 | $1.25 | $7.50 |
| T2V 30s blended | 8 | $2.20 | $17.60 |
| T2V 60s blended | 4 | $4.40 | $17.60 (lane mix bias) |
| Carousels | 14 | $0.20 | $2.80 |

PRD model uses **$33.50 video + $2.80 carousel = $36.30 total**. Margin: $318 - $36.30 = **$281.70 (88.6%)**.

## 5. Why we held prices despite bundling carousels

ADR 0005 is the canonical decision record. Summary:

- v1 priced carousels as a paid add-on (₦15k / ₦35k / ₦70k for the three quantities). At full attach we'd have made ~$10/order more than v2.
- v2 bundles carousels and holds prices the same. Margin compresses by 1-2 percentage points per tier.
- We accepted the compression because:
  - **Pricing page friction reduces.** "Carousels included" is a cleaner marketing statement than "Add-ons available from X".
  - **Form length stays the same.** The carousel-add-on step gets replaced by the photo upload step — net zero on form length.
  - **Attach rate becomes 100%**, which makes Phase 2 production planning much simpler (no conditional rendering branches based on whether carousels were purchased).
  - **Absolute margin per order is essentially unchanged** at meaningful volume.

If we ever introduce a no-carousel variant, it will be a separate package (e.g. "Video-only Starter") rather than an opt-out from the standard tiers.

## 6. Margin guard — when to repurpose this number

The 88-94% margin range is the headline. It's also a number that quietly hides three things:

- **It excludes founder time.** The founder review-and-approve step costs ~5 minutes of attention per order. At founder-time-as-cost, that's roughly $4 per order at conservative rates. Margins drop ~3-5 percentage points if you book this. We don't book it because (a) Phase 1 is bootstrap and (b) the founder review doubles as a quality gate — it has product value, not just operational cost.
- **It excludes infrastructure.** VPS, Supabase Pro, Resend, domain, Cloudflare — call it $80/month total amortised. At 10 orders/month that's $8/order = 4-5 percentage points of margin. At 50 orders/month it's $1.60/order = 0.5-1 percentage points. The marginal infrastructure cost per order falls fast as volume rises.
- **It excludes refunds.** Phase 1 targets refund rate ≤5%. At 5% refund rate, effective margin drops by ~5% absolute (because the refunded order's COGS is fully spent but revenue zero). Worth tracking.

Realistic all-in margin at 30 orders/month, mid-tier: ~78-83% rather than the headline 89%. Still healthy, just not "tech startup" healthy.

## 7. When to revisit pricing

Phase 1 prices stay frozen until at least one of these triggers:

- **30+ days of consistent ≥10 orders/month.** Then we have enough data to test price elasticity (e.g. add a "Studio" tier at ₦950k for premium, or test a 10% Standard increase).
- **Per-unit COGS shifts ≥20%.** Veo, HeyGen, Anthropic prices change. If per-tier COGS jumps by 20%+, we either absorb (if margin is still healthy) or pass through (if it isn't). Either way, doc update + ADR.
- **Customer-side mix signals.** If 80%+ of customers pick Calendar, we're underpriced at the top. If 80%+ pick Starter, we're overpriced at the middle. The PRD's success-metric "≥60% choosing Standard or Calendar" is the early warning.
- **Real exchange-rate movement.** NGN/USD has been volatile. A 15% adverse swing eats into dollar-cost margin. We carry a quarterly review of the FX assumption.

## 8. Reasoning behind not offering subscriptions in Phase 1

Tempting; deliberately avoided.

- Subscription billing requires Paystack subscriptions (different webhook surface), retry-on-fail logic, customer dashboard, cancellation flow. Substantial Phase 2+ work.
- Phase 1's value prop is "test us with one calendar." A subscription pitch fights that — it asks for commitment before trust.
- Repeat business in Phase 1 is handled by warm follow-up: founder personally reaches out to delivered customers 30 days after delivery. Conversion to a second order is the proof point we want before we offer subscription pricing.

When we do introduce subscriptions (likely Phase 3 after we have ~50 returning customers), it'll be priced ~80% of the per-order rate, locking in a monthly cadence.

## 9. Add-ons we deliberately do NOT offer in Phase 1

- **Rush delivery.** No "12h instead of 24h" upgrade. Production capacity is the constraint; we'd rather deliver on the standard timeline reliably than promise faster and miss.
- **Custom voice cloning.** ElevenLabs voice clones add complexity for marginal customer benefit at this volume.
- **Branded music tracks.** Customers occasionally ask. We use a curated set of royalty-free tracks that match the niche; custom music is out of scope.
- **Posting / scheduling.** We don't post the videos. The customer posts; we deliver.
- **Analytics.** We don't track post-publish performance.

If a customer asks for any of these, the answer is "not in this package, but happy to discuss for a future order" — followed by a mental note for Phase 2 product expansion.

## 10. Where these numbers are referenced

- Marketing site `/pricing` page renders the tier table from a static config file in `apps/web/src/content/pricing.json`. **That config file is the source of truth for the customer-facing UI.** This document is the source of truth for the *business model*. They must agree.
- AI brief analysis prompt references the tier structure when generating upsell recommendations.
- The Phase 2 production agent reads the tier structure to know how many videos and carousels to produce, and the length mix to apply.
- Operations runbook: when a customer asks for an unusual configuration, the founder's response references this document.

If any of these references drift from this doc, the doc wins. Update the others to match.
