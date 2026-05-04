# Niche brief: Real estate (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when a real-estate customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`.

## 1. Who's in this niche

- Solo real-estate agents and brokers.
- Property-marketing freelancers and content-led agents.
- Boutique agencies (under 10 staff) marketing across Lekki, Ikoyi, Victoria Island, Ajah, Ibeju-Lekki, Magodo, Surulere, Yaba, Abuja's Maitama/Asokoro/Wuse, Port Harcourt's GRA.
- Property-investment educators selling courses, consulting, or due-diligence services.
- Off-plan and primary-market sales reps.
- Short-let operators (Airbnb, Booking.com, Hotels.ng listings).

Edge cases:
- Architecture firms — fits but slants toward Behind-the-Work and Process Tour rather than transaction archetypes.
- Property valuers / surveyors — fits as service business, not as transaction marketers.
- Mortgage brokers — sits at the fintech/real-estate boundary; route by primary revenue source.

## 2. Tone and voice patterns

Real estate in Nigeria converts on authority + transparency. The buyers are sceptical (with reason — the market has documented fraud and pricing opacity), so content that *demonstrates expertise* and *names the things people don't talk about* outperforms aspirational drone shots.

Common tonal markers:

- Specific neighbourhood references (Ikoyi vs Lekki Phase 1 vs Lekki Phase 2 vs Ajah is a *real* distinction, not aesthetic).
- Document literacy: C of O, Governor's consent, deed of assignment, survey plan, building approval.
- Pricing transparency: agency fees (5-10%), legal fees (5%), service charge ranges, parking levies.
- Scepticism toward "good deals" — the genre rewards founders who help buyers spot scams.
- Light professional swagger: "this is what you should be asking" beats "we're the best agency".

Avoid:
- Aspirational drone-shot openers without substance.
- "Luxury living" generic copy.
- Implied promises of returns ("this property will appreciate by X%").
- Specific competitor naming as targets.
- First-person biographical anecdotes that we haven't been given.

## 3. Topic library — by archetype

### Pricing Breakdown
- "₦[X] for a 3-bedroom in [neighbourhood]. Here's the breakdown — agency fee, legal, service charge, parking."
- "Why a Lekki Phase 1 flat costs more than a Lekki Phase 2 flat — line by line."
- "Service charge ranges across Lagos in 2026."

### Service Anatomy
- "What an agent actually does between offer and handover."
- "The 7 stages of a typical property purchase in Lagos."
- "Behind a property listing: what we do before it goes live."

### Insider Checklist
- "[N]-point checklist for any pre-purchase property visit."
- "What to check on a Governor's consent before you sign anything."
- "The [N] documents you should see before paying any money."

### Common Mistake / Pre-Decision Audit
- "[N] mistakes first-time Lagos buyers make."
- "Don't pay any deposit until you've checked these [N] things."
- "Why most off-plan buyers regret their first purchase."

### Process Tour / Process Demystification
- "How a Governor's consent application actually works."
- "From offer to handover: a typical Lagos property timeline."
- "What 'family land' actually involves — the full process."

### Quality Tells
- "How to spot a well-built Nigerian apartment vs a rushed one."
- "[N] tells of a quality property finish."
- "What separates a real Lagos developer from a fly-by-night."

### Decoded Jargon
- "What 'C of O' actually means and why it matters."
- "Deed of assignment vs Governor's consent — the plain version."
- "Decoding 'family land' — the part agents won't explain."

### Industry Pattern / Market Reality
- "Lagos rental market right now — by the numbers."
- "Why service charges in Lekki keep rising."
- "What changed in the Lagos State land use charge — the practical version."

### Regulatory Snapshot
- "What the new Lagos building regulation requires."
- "Land use charge: the version that affects you."
- "Recent Lagos State Land Bureau updates."

### Cost of Inaction / Hidden Trap
- "The Lagos property trap nobody warns you about."
- "Why some 'good deals' are documents waiting to be challenged."
- "The cost of buying without proper due diligence — every fee."

### Decision Framework
- "Buy vs rent in Lagos: the math, with current rates."
- "Lekki vs Ikoyi for a first apartment — the trade-offs."
- "Off-plan vs ready-built: when each makes sense."

### Outcome Showcase / Use-Case Spotlight (T2V cinematic)
- Slow-pan property reveals — interior shots, never claiming "Sarah's new apartment".
- Hands flipping through clean property documents.
- Wide shot of a Lagos street, narrowing to a specific building.
- Property handover montage (keys, signed documents, neutral framing).

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - specific neighbourhood names ("Lekki Phase 2", "Ajah")
  - document terminology used naturally ("C of O", "Governor's consent", "deed")
  - exact prices, percentages, durations
  - "in my experience" / "what we keep seeing" — observational expertise
  - direct addressing of buyer fears ("I know you've heard horror stories")

common_do_not_say:
  - "luxury living", "your dream home", aspirational generic
  - "guaranteed appreciation", any return promise
  - specific competitor names as targets
  - "the only agency you'll ever need" (overclaim)
  - first-person biographical claims not in customer material
```

## 5. Restricted claims to flag

- Specific return-on-investment promises ("this will appreciate by 20%").
- Any "guaranteed" framing on appreciation, rental yield, or sale.
- Implied legal advice ("you don't need a lawyer for this").
- Implied EFCC / regulatory clearance the customer didn't claim.
- Anti-competitor framing (specific named developers/agents).
- Claims about ongoing court cases / disputed land titles.

## 6. Niche-specific framework × archetype affinity adjustments

- **Educational frameworks dominate.** Educational Breakdown, Process Demystification, Numbered List, Checklist Reveal — the genre is fundamentally educational.
- **Cost Reveal runs strong.** Pricing transparency is the differentiator.
- **Behind-the-Work runs lower than other niches.** Real estate work is often less visually compelling than craft work.
- **Specificity Stack is critical.** Numbers (prices, fees, square footage) are the genre's currency.
- **Comparison framework is high-affinity** for neighbourhood and tier comparisons.

## 7. Sample reference material fallback — observational, not first-person

> Example A (authoritative observational):
> "Most first-time Lagos buyers focus on price. They miss the four other costs that come with a purchase: agency fee (10%), legal fee (5%), survey plan, and Governor's consent. Together those add 18-22% to the sticker price."

> Example B (specificity-led):
> "₦65 million for a 3-bedroom in Lekki Phase 1. The unit is 156 sqm, 5th floor, with parking for two. Service charge is ₦1.4m a year. Here's the breakdown."

> Example C (educational, expert):
> "Governor's consent is what makes a property transfer legal in Lagos. Without it, what you have is a payment receipt — not ownership. Here's how the process actually works."

None of these claim a specific personal history. The expertise comes through naturally via specificity.

## 8. Photo aesthetic notes

- Wide shots of properties usually need re-lighting before avatar generation; flag for production.
- Outdoor portraits in front of properties read as "agent" — strong for trust signals.
- Studio shots feel corporate and less native — flag if customer's only photos are studio.
- Clean indoor shots in finished properties pair well with T2V property reveals.
- Avoid drone-only photos for avatar generation — vision pass can't extract good wardrobe/face data.

## 9. Common upsell signals

- Customer manages 5+ active listings.
- Customer mentioned "agency growth" or "team expansion".
- Customer operates in multiple neighbourhoods (more content needed for each).
- Customer mentioned ongoing court cases or document issues — flag for restricted-content discussion before proceeding.

Upsell framing: "30 videos lets you cover one specific niche concern per day for a month — different documents, different neighbourhoods, different price tiers — without repeating angles."

## 10. No-fabrication notes specific to real estate

Real estate is high-stakes and fabrication risk has both reputational and regulatory exposure. The AI must resist:

- **Outcome stories.** "How my client made ₦50m on this property" — off the table without documented testimonial consent.
- **Specific case studies.** "When I helped a buyer through a tricky C of O case" — off the table unless customer typed it into step 6.
- **Implied rare-event experience.** "I once stopped a fraudulent deed transfer at the last minute" — off the table.
- **Specific market predictions** dressed as personal forecasting.

What we do instead:

- **Document explanations** grounded in public regulatory knowledge.
- **Pricing transparency** with current market data.
- **Process tours** of how transactions work.
- **Pre-decision checklists** customers can use themselves.
- **Hidden traps** framed as category-level patterns, not personal saves.
- **Regulatory snapshots** based on current public information.
- **Defensible opinion** on neighbourhoods, building quality, contract terms.

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
