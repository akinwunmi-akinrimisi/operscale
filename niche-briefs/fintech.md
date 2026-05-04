# Niche brief: Fintech (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when a fintech customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`. Fintech is the most regulatory-sensitive niche on Operscale; this brief reflects that.

## 1. Who's in this niche

- B2C fintech app founders (savings, lending, investments — within their licensing scope).
- Personal finance educators and money coaches.
- Tax compliance services (FIRS, NRS — for individuals or SMEs).
- Bookkeeping and accounting service providers.
- Insurance broker apps and platforms.
- Crypto education providers (within regulatory scope).
- Payroll and HR-finance platforms for SMEs.
- B2B fintech serving SMEs (invoicing, expense management).

Edge cases — these are restricted by default and require founder pre-approval:
- Crypto trading services / signal services — restricted.
- Forex education with implied trading promises — restricted.
- High-yield investment platforms — restricted.
- Loan apps — fits the niche, but content with implied approval guarantees is restricted.

When the customer's business sits on or near a restricted line, the AI flags the brief for founder review *before* analysis runs. The CRM has a "fintech compliance pre-check" workflow.

## 2. Tone and voice patterns

Fintech in Nigeria converts on plain-language clarity + specific numbers. The audience is financially anxious (with reason — failed banks, currency depreciation, fraud) and rewards content that *explains things they were embarrassed to ask*.

Common tonal markers:

- Clear-language explanations of jargon (BVN, NIN, NRS, PFA, FRC, CBN).
- Specific numbers cited explicitly (% rates, ₦ amounts, days).
- Direct address: "you're losing money this way".
- Recognition of audience experience: "you've probably had a bank charge you can't explain".
- Light Naija inflection when reference posts use it; otherwise neutral professional.

Avoid:
- Hype language ("financial freedom", "passive income", "wealth building").
- Specific return promises in any form.
- "Get rich quick" framing entirely.
- Casual claims that imply licensed advice (you're not their lawyer or financial advisor unless the customer is one).
- First-person biographical anecdotes that we haven't been given.

## 3. Topic library — by archetype

### Decoded Jargon
- "What 'BVN' actually does — and what it doesn't."
- "Decoding your bank statement — every line item."
- "NIN, BVN, NRS — what each one is for."
- "PFA vs PFC — the plain-language version."

### Educational Breakdown / Process Demystification
- "How a Nigerian tax filing actually works — step by step."
- "What happens to your money when you 'save' in a microfinance app."
- "From signup to first transaction: how [type of platform] works."

### Insider Checklist / Pre-Decision Audit
- "[N] questions to ask before opening any new financial account."
- "Before you sign up for any savings app, check these [N] things."
- "The [N]-point audit for any small-business expense process."

### Common Mistake / Cost of Inaction
- "[N] money mistakes Nigerian SMEs keep making."
- "Why most Nigerian freelancers under-pay tax — and what it actually costs them."
- "What missing your monthly remittance actually costs you over a year."

### Symptom Diagnosis
- "Signs you're paying more in bank charges than you should."
- "How to know if your business needs a separate tax ID."
- "If your bookkeeping looks like this, you have a problem."

### Hidden Trap / Category Myth
- "The [type of product] trap nobody warns you about."
- "Stop believing [common money myth]."
- "Why [popular financial advice] doesn't work for Nigerian incomes."

### Regulatory Snapshot
- "What changed in [recent CBN circular] — and what you need to do."
- "FIRS [recent rule]: the version that affects you."
- "NRS in 2026 — the practical guide."

### Comparison / Decision Framework
- "[Platform A] vs [Platform B]: when each makes sense."
- "Should you save in naira or hold in dollars? — the trade-offs."
- "Mutual funds vs treasury bills: the real differences."

### Service Anatomy / What You Get
- "What our [platform] actually includes."
- "The [N] features in [signature plan]."
- "Inside the [paid tier] — every line of value."

### Industry Pattern / Market Reality
- "Average savings rates across major Nigerian apps right now."
- "What Nigerian SMEs are actually spending on bookkeeping in 2026."
- "Where the [niche] is heading in the next 6 months."

### Cost Reveal
- "What it actually costs to run a fintech app — the parts users don't see."
- "Why our [tier] costs ₦[X] — broken down."
- "The hidden costs in 'free' financial products."

### Outcome Showcase / Use-Case Spotlight (T2V cinematic — careful)
- App UI close-ups (with consent — never show real customer balances).
- Dashboard reveals showing typical (anonymised) data.
- Numbers animating into clarity (analytics-style).
- A laptop on a desk in a Lagos apartment — daytime work scene.

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - specific terms used naturally (BVN, NIN, NRS, CBN, FIRS, PFA)
  - exact percentages, naira amounts, durations
  - "in my experience" / "what we keep seeing" — observational expertise
  - direct addressing of audience financial anxiety
  - plain-language explanations of jargon

common_do_not_say:
  - "financial freedom", "passive income", "build wealth"
  - any specific return promise ("earn X% guaranteed")
  - "the only [solution] you'll ever need"
  - implied licensed advice unless customer is licensed
  - first-person biographical claims not in customer material
```

## 5. Restricted claims to flag

- Specific return promises — hard-block.
- "Guaranteed" anything financial — hard-block.
- Specific stock/crypto picks — hard-block.
- Implied tax advice when customer isn't a registered tax practitioner — flag.
- Specific debt-clearing timelines without methodology — flag.
- Claims about CBN / FIRS / SEC / EFCC affiliation that aren't substantiated — hard-block.
- Specific success-rate percentages without methodology — flag.

## 6. Niche-specific framework × archetype affinity adjustments

- **Educational frameworks dominate.** This is the most education-heavy niche on Operscale.
- **Decoded Jargon archetype runs strongest here.** Nigerian fintech jargon density is high.
- **Regulatory Snapshot is high-affinity** because regulation changes often.
- **Comparison framework is critical** — fintech buyers compare options.
- **PAS and DR Formula run cooler** than other niches because aggressive selling reads as scammy in this category.
- **Behind-the-Work runs lowest** of all niches — fintech work is screen-bound and not visually compelling.

## 7. Sample reference material fallback — observational, not first-person

> Example A (educational, plain language):
> "Most people don't realise their NIN and BVN do different things. Your NIN is your identity. Your BVN is your banking footprint. They're issued by different bodies, used for different things, and recovering one is a completely different process from recovering the other."

> Example B (specific, expert):
> "₦47,300. That's the average monthly bank charge a Nigerian SME with three accounts pays — most of it avoidable. The breakdown: ₦18,000 in transaction levies, ₦12,000 in card maintenance, ₦9,000 in stamp duty, and ₦8,300 in service fees. Here's how to cut three of those four lines."

> Example C (regulatory, observational):
> "The CBN updated the cashless policy thresholds again last quarter. If you're an SME running daily collections, three things changed for you — and one of them affects how much your processor is allowed to charge you per transaction."

None of these claim "I once lost ₦Xm in a failed bank" or "my client cleared their debt in 18 months". Observational educational framing only.

## 8. Photo aesthetic notes

- Founder photos in casual professional settings work well — avatar reads "competent peer".
- Avoid suit-and-tie corporate photos — that register has lost trust in Nigerian fintech.
- Office or laptop-on-desk settings work for visual_style fallback.
- Note any photos that show actual customer/user data — flag for blur/redaction in T2V references.

## 9. Common upsell signals

- Customer is in active growth phase (mentioned MAU growth, new feature launches).
- Customer has multiple products / tiers / segments.
- Customer mentioned regulatory deadline or compliance push.
- Customer mentioned "fundraise" or "launch" — both increase content urgency.

Upsell framing: "30 videos lets you cover regulatory updates, product education, jargon decoding, and pricing transparency — all without repeating angles. Fintech needs volume for trust-building."

## 10. No-fabrication notes specific to fintech

Fintech is the highest-stakes niche for fabrication risk because false financial claims can cause real harm. The AI must resist:

- **Outcome stories about specific people.** "Tomi cleared ₦8m in 18 months" — off the table without documented consent and substantiation.
- **Implied personal financial track record.** "I made my first million doing this" — off the table.
- **Specific case studies dressed as personal experience.** "When I helped a client through their tax investigation" — off the table unless customer typed it.
- **Implied insider regulatory knowledge** — "what the CBN is about to announce" — off the table without source.

What we do instead:

- **Public regulatory explanation** with cited authority.
- **Pricing and fee transparency** with current public data.
- **Process tours** of how financial products actually work.
- **Decision frameworks** customers can apply themselves.
- **Jargon decoding** with accurate definitions.
- **Defensible opinion** on category-level patterns (e.g. "most savings apps have similar problems" is defensible; "I've used 12 of them" needs source).

The fintech compliance pre-check in the CRM exists to catch any restricted-line risk before analysis runs.

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
- `docs/specs/ndpc-compliance.md` — for content that touches user data examples.
