# Niche brief: Fintech

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.

This document is the operational knowledge the AI consults when a fintech customer submits a brief. **Restricted-niche care applies throughout.**

## 1. Who's in this niche

- Personal finance educators and content creators.
- Savings/budgeting app founders.
- SME financial-services providers (invoicing, bookkeeping, payroll).
- Investment advisors (registered).
- Tax professionals and accounting firms.
- Wealth management coaches.

Edge cases that **do not fit** Phase 1:
- **Unregistered consumer credit / lending** — hard pass. We don't make ads for unregistered lending operations.
- **Crypto trading "signals" or "groups"** — hard pass.
- **Forex trading rooms** — hard pass.
- **Multi-level structures dressed as financial education** — hard pass.

The founder review screen flags these and the founder discards the brief.

## 2. Tone and voice patterns

Fintech in Nigeria converts on **calm authority**. The category is loud and full of overpromising; trustworthy fintech voices stand out by being measured. Successful Nigerian fintech content sounds like a competent friend who knows the system, not like a hype merchant.

Common tonal markers:

- Specific numbers, conservative claims: "saved ₦42,000 in 90 days", not "save millions".
- System knowledge: tax dates, CBN circulars, BVN requirements, Pension Reform Act mentions.
- Process-oriented: "step 1, step 2, step 3".
- Lagos and Nigeria-specific cost references: NEPA bills, transport, food inflation, school fees.
- Grounded in real Nigerian financial reality (multiple income streams, diaspora support, family obligations).

Avoid:
- Absolute wealth claims: "build wealth", "financial freedom" without specifics.
- Aggressive scarcity ("only 50 spots left in this masterclass!").
- US-style "passive income" framing — Nigerian audiences see through this.
- Crypto / investment hype.
- Anything that sounds like a get-rich-quick scheme.

## 3. Topic library

### 3.1 UGC topics that perform

- "I tracked my bank charges for 90 days — here's what I found"
- "Why most Nigerian SMEs fail at bookkeeping"
- "The 3 buckets that actually work for Nigerian salaries"
- "My honest review of [savings app / bank product]"
- "What I'd tell my younger self about money in Lagos"
- "Tax-season checklist for SME owners"
- "How to actually negotiate your salary in 2026"
- "Why your emergency fund needs to be in [specific instrument]"
- "Behind the math: how I personally invest"
- "Things accountants hate hearing"
- "5 fees in your bank statements you didn't know existed"
- "How to set up your first PFA pension contribution"
- "What changed in CBN's [recent circular] — and what you need to do"
- "Customer journey: how [name] cleared ₦Xm in 18 months"

### 3.2 T2V cinematic topics

Visual register: clean, considered, professional but warm. Fintech T2V succeeds when it earns trust through visual restraint, not visual ambition.

- Time-lapse of a desk with documents, calculator, laptop in golden hour.
- Hands counting cash, then cash being banked.
- Wide shot of a Lagos office through a glass door.
- Slow zoom on a savings number going up on a dashboard.
- Aerial of Lagos at dawn — the city waking up to work.
- Founder walking to work / boardroom-side.
- Document close-ups: tax filing, invoice, payment confirmation.

### 3.3 Carousel templates

- "5 fees you didn't know about"
- "Tax-season SME checklist"
- "How to set up your emergency fund (Naira version)"
- "BVN vs NIN — what each does and when you need them"
- "[App or product] features — what's actually useful"
- "End-of-year financial review template"

## 4. Brand voice variables

```
common_do_say:
  - specific Naira figures
  - specific institutions (CBN, FIRS, NDIC, PFAs by name)
  - process steps ("first, second, third")
  - "I", "in my experience", "my clients"
  - cautionary framing ("before you do this", "the part to double-check")

common_do_not_say:
  - "build wealth" without specifics
  - "passive income" / "financial freedom"
  - absolute claims about returns
  - generic "the system is broken" framing
  - any crypto hype language
```

## 5. Restricted claims to flag

This is the most flag-heavy niche. The AI brief analysis must catch:

- **Return / yield claims** — "make 20% on your money", "guaranteed returns" — flag and propose softer "what to expect from [instrument]" framings.
- **Unregistered credit offers** — if customer mentions "give loans", "consumer credit", check for CBN registration. If unregistered, flag for founder review (likely discard).
- **Crypto trading claims** — flag any mention of trading signals, group memberships, or guaranteed crypto returns.
- **Tax / legal advice without licensing** — if customer is positioning as a tax authority without ICAN / ANAN registration, soften from "tax advice" to "tax-season tips" framing.
- **Pension claims** — pension industry is regulated; flag any "guaranteed" pension claims.
- **Foreign-exchange products** — heavily regulated; flag any FX-related angle for compliance review.

The flag should always specify what to soften and what's hard-blocked. Example: "Customer mentioned 'helps clients save 30% on tax' — soften to 'helps clients identify deductions they may have missed' OR escalate for ICAN-registration confirmation."

## 6. Niche-specific calendar rhythm bias

Fintech calendars deviate from baseline 60/40:

- **More T2V than baseline.** Calm, considered visual register from T2V is what fintech needs. T2V uses 70%+ quality lane allocation.
- **UGC skews to expertise and education.** "Why most SMEs fail at..." beats "look at our app".
- **Carousels are guides and explainers.** The 14-page Calendar carousel allotment is dense with practical content.
- **Less aspirational / mood-piece content.** Fintech doesn't need cinematic-as-fantasy; it needs cinematic-as-credibility.

## 7. Sample reference material fallback

> Example A (calm / authoritative):
> "I've been doing tax planning for SMEs for 7 years. The single most common mistake I see is not separating personal and business expenses. Here's how to fix it in one weekend."

> Example B (educational / specific):
> "If you're earning ₦600k a month in Lagos and saving nothing, you're not bad with money — you're paying inflation tax. Here's the bucket system that actually works at this income level."

> Example C (founder / vulnerable):
> "I built this app because I almost lost ₦4m in 2022 to a fraud I didn't understand. Now we're protecting 12,000 Nigerian SMEs from the same thing. Here's what I learned the hard way."

## 8. Photo aesthetic notes

Fintech founders are often less camera-comfortable than beauty or fashion founders. The photo upload, when it happens, often shows:
- Office settings.
- Business-casual to formal wardrobe.
- Indoor lighting (often suboptimal — fluorescent).

Note the lighting register and recommend the avatar treatment compensate. The visual style block should bias toward professional warmth — desk lamps, natural window light, neutral backgrounds — rather than fluorescent overhead realism.

## 9. Common upsell signals

- Customer mentioned both consumer-facing and SME-facing service lines.
- Customer mentioned upcoming product launch or feature rollout.
- Customer mentioned tax season urgency (Q1, Q4 windows).
- Customer is targeting more than one customer segment (e.g. SMEs AND salaried professionals).

Upsell framing: "with 14 videos we can have 6-7 dedicated to SME content and 6-7 to salaried-professional content — they're different audiences and need different angles. Hard to serve both in 7 videos."

## 10. Restricted-niche fallback

If a fintech customer is borderline (unregistered lending, crypto signals, FX trading), the founder review path is:

- **Founder discards** in CRM with reason recorded.
- **No further automated emails.**
- **Founder may follow up manually** if there's a compliant version of the customer's offering we'd be willing to make content for.

We don't have a fintech-restricted sub-flow. The decision is binary: in-scope or out-of-scope.
