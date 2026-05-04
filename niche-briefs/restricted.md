# Niche brief: Restricted (meta)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Founder review CRM.

This document is **not** for any specific niche. It's the framework for handling customers whose business falls into restricted territory — either because of regulatory exposure, ethical concerns, or because the niche is off-list entirely.

The other seven niche briefs (beauty, real-estate, fashion-ecom, fintech, health, food, education) each have their own restricted-claim sections. This document covers cases that don't fit cleanly into any of those.

## 1. Why we have restrictions at all

Three reasons:

- **Customer protection.** A customer who runs an unregistered lending operation needs help, but it isn't help with content marketing. Visibility for an unregistered operation accelerates regulatory exposure rather than business growth. Saying yes to that customer hurts them.
- **Operscale protection.** We don't want to build a brand around content for borderline-legal operations. Our reputation is the foundation of our business and we guard it.
- **Audience protection.** People watch and act on the content we create. If a script claims a product cures cancer, the harm doesn't stop with the customer — it lands in the lives of viewers who acted on the claim.

The restrictions aren't moral grandstanding. They're practical risk management.

## 2. Hard-block list

These customers we don't accept under any circumstance, regardless of how the brief is framed:

- **Gambling, betting, casino operators**, including "skill games" structured as betting.
- **Adult content / sex work / escort services.**
- **Multi-level marketing structures** dressed as opportunities.
- **"Get rich quick" educators** without verifiable credentials.
- **Scam-adjacent products** — anything where the offering's claims are physically impossible.
- **Unregistered lending and consumer credit** (CBN registration required).
- **Crypto trading "signals" rooms / forex trading rooms** — Phase 1 hard-block.
- **Politically aligned content from active candidates / parties** during election cycles. (Phase 2+ may reconsider with disclosure framework.)
- **Tobacco, vapes, nicotine products.**
- **Firearms, weapons, ammunition.**
- **Pharmaceuticals without explicit licensing.**
- **Skin-bleaching products marketed as lightening.**

If the brief shows any of these, the founder discards in CRM with reason recorded. No automated email is sent. The customer keeps their auto-ack and never hears from us again.

## 3. Soft-flag list (escalate to founder)

These are categories we may serve, but only after founder review and possibly substantiation:

- **Health products with outcome claims.** See `niche-briefs/health.md`.
- **Financial products with yield / return claims.** See `niche-briefs/fintech.md`.
- **Real-estate with title or yield claims.** See `niche-briefs/real-estate.md`.
- **Children's education or wellness products** — verify credentials.
- **Beauty products with medical-leaning claims.** See `niche-briefs/beauty.md`.
- **Supplements or food products with health benefits.** Verify NAFDAC registration.
- **Religious / spiritual coaching offerings.** Acceptable, but flag claims of spiritual guarantees.
- **Cosmetic procedures and clinics.** Acceptable with medical-licensing verification.
- **Legal services from unverified practitioners.** Flag for SAN / NBA verification if the brief implies authority.

## 4. The flag pattern

Every restricted-niche flag in the AI brief analysis output follows this structure:

```
{
  "flag_type": "claim_substantiation_needed",  // or "soften_recommended", "hard_block"
  "specific_quote": "the exact phrase from the brief that triggered the flag",
  "concern": "why this is restricted",
  "soften_suggestion": "specific alternative phrasing the customer can use",
  "escalation_recommendation": "what the founder reviewer should do"
}
```

Example:

```
{
  "flag_type": "claim_substantiation_needed",
  "specific_quote": "guaranteed 25% annual return",
  "concern": "Yield claims need substantiation. Phase 1 doesn't make absolute return promises in any script.",
  "soften_suggestion": "Replace with 'historically averaged X% appreciation over Y years' — requires customer to provide verifiable historical data.",
  "escalation_recommendation": "Re-analyze with note: ask customer for verifiable past returns, or remove yield-specific framing entirely and shift to 'long-term capital growth' positioning."
}
```

Specificity is the rule. Vague flags like "this needs review" are useless to the founder.

## 5. The off-list customer

What happens when a customer's niche isn't on our 7-niche list (beauty, real-estate, fashion-ecom, fintech, health, food, education)?

Phase 1 form requires the customer to pick from these 7. If their business doesn't fit, they pick "Other" and a free-text describes-business field. Examples that have come through "Other":

- **Photography / videography businesses** — fits, but adapts UGC to "behind the lens" content; mostly behaves like fashion-ecom.
- **Event planning** — fits, but adapts to event-specific content arcs (weddings, corporate); behaves like fashion-ecom + real-estate hybrid.
- **Construction and renovation services** — fits, but adapts visuals to project-led content; behaves like real-estate.
- **B2B SaaS products** — fits, but adapts content register to expertise / case-study; behaves like education + fintech hybrid.
- **Logistics and delivery services** — fits, but adapts to operational excellence and reliability framing; behaves like fintech + food.
- **Pet services and products** — fits as fashion-ecom adjacent (style + lifestyle).
- **Auto detailing and automotive services** — fits as real-estate adjacent (high-trust, expertise-led).

For "Other" customers, the AI brief analysis falls back to:

1. **Pick the closest niche from the 7** based on customer description.
2. **Use that niche's brief as the primary reference**.
3. **Flag in the analysis output** that this is an off-list assignment, so the founder reviewer can verify the niche fit.
4. **Adjust tone and topic library** based on customer reference posts and brief content.

If no niche fits even loosely, the AI flags for founder review with a recommendation to discard or to manually craft a brief.

## 6. The "I want to be different" customer

Some customers ask us to make content that violates niche conventions deliberately. "I'm a fintech but I want my content to feel like beauty content." "I'm a real-estate broker but I want street-style fashion energy."

This is fine, but flag it. The founder reviewer should read the brief carefully to make sure:

- The customer's business actually benefits from the unconventional choice.
- The customer's reference posts validate the choice (we're not making something up).
- The unconventional choice doesn't violate restricted-niche rules (e.g. "I want my fintech to feel like crypto-hype" — no).

Default position: serve the customer's vision when it's coherent. Flag when it isn't.

## 7. Compliance retention specific to restricted-niche flags

When a brief is flagged or discarded for restricted-niche reasons, the audit trail matters more than usual. Specifically:

- **Activity log**: every flag is logged with `event_type = 'restricted_niche_flag_raised'` and `payload` containing the flag JSON.
- **CRM display**: flagged briefs show an orange warning triangle in the Pending Review queue.
- **Founder reasoning**: when a founder discards a brief for restricted-niche reasons, the reason field captures the specific concern.
- **Customer follow-up**: if the customer follows up by email asking what happened, the founder has the audit trail to refer back to and can respond accurately.

This matters because restricted-niche decisions sometimes get questioned later. "Why didn't you make this content for them?" is a question we want to answer with specifics, not vibes.

## 8. The founder's discretion zone

There will always be cases the framework doesn't catch. Some examples:

- **A customer who operates in a niche we don't restrict but whose specific personality / reference posts feel off.** The founder may discard for vibe reasons. Acceptable; record specific concern in the discard reason.
- **A customer whose niche is fine but whose offering is borderline.** Founder reviews carefully and can ask for substantiation before approving.
- **A customer whose business is fine but whose stated goals are unrealistic.** "I want to 10x my revenue in 30 days." Founder approves with a soft note in the brief email setting realistic expectations.

The framework codifies what we know. Discretion handles what it doesn't. When discretion is exercised, document it — that's how the framework eventually catches up.

## 9. Updating this document

When new restricted-niche cases arise that don't fit existing categories, this document gets updated:

1. New hard-block category added with rationale.
2. New soft-flag pattern documented with example.
3. Flag JSON structure adjusted if needed.
4. CRM and AI prompt updated together.

The framework is living. New cases teach us what we missed.

## 10. Cross-references

- `niche-briefs/beauty.md` — beauty-specific restricted claims.
- `niche-briefs/real-estate.md` — real-estate-specific restricted claims.
- `niche-briefs/fashion-ecom.md` — fashion-specific care.
- `niche-briefs/fintech.md` — fintech-specific restricted claims (highest flag density).
- `niche-briefs/health.md` — health-specific restricted claims (closest to hard-block).
- `niche-briefs/food.md` — food-specific care.
- `niche-briefs/education.md` — education-specific restricted claims.
- `docs/specs/ai-brief-analysis.md` — how flags are generated by the AI analysis prompt.
- `docs/runbooks/crm-runbook.md` — how the founder handles flags during review.
- `docs/specs/ndpc-compliance.md` — NDPC alignment for restricted-niche audit retention.
