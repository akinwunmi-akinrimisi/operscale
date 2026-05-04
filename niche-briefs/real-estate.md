# Niche brief: Real estate

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.

This document is the operational knowledge the AI consults when a real-estate customer submits a brief.

## 1. Who's in this niche

- Real-estate agents and brokers selling residential properties.
- Real-estate developers marketing their own projects.
- Property managers running short-let / serviced apartment portfolios.
- Real-estate investment advisors and educators.
- Mortgage brokers (with care — they overlap with fintech).

Edge cases:
- Pure construction firms — fits, but tone bias shifts toward execution and craft, less toward the buying decision.
- Land bankers selling raw plots — fits, but compliance risk is higher (Lagos has frequent land-title disputes; we tread carefully).
- Buy-to-let coaching businesses — fits more like education than real estate.

## 2. Tone and voice patterns

Real-estate buyers in Nigeria are looking for **trust signals** above all else. The category is full of cowboy operators; the customers know it. Successful real-estate content is the opposite of hype — measured, specific, willing to disclose downsides.

Common tonal markers in successful Nigerian real-estate content:

- Direct expertise framing: "after 4 years of doing this", "I've inspected over 200 properties", "I've seen this go wrong twice".
- Specific numbers: "₦65m for the duplex, ₦1.2m for service charge per year, ₦300k for legal".
- Willingness to disclose: "the catch is...", "this isn't for everyone", "I wouldn't recommend this if you're a first-time buyer".
- Lagos-area specificity: not "Lagos" but "Ikate, Lekki Phase 1", "Banana Island", "Magodo Phase 2".
- Cautionary tone: "before you sign anything...", "the document to ask for is...".

Avoid:
- "Luxury" overuse. Every Nigerian real-estate ad says luxury; saying it makes you sound like every other ad.
- "Investment opportunity" framing without specifics. Vague signals scam.
- Generic aerial drone shots without context — flag if customer requests this exclusively.
- Aggressive scarcity claims ("only 3 left!") unless verifiable.

## 3. Topic library

### 3.1 UGC topics that perform

- "House hunting in Lekki under ₦Xm — here's what I found"
- "Things agents won't tell first-time buyers"
- "How to inspect a property like a pro in 10 minutes"
- "My honest review: Lagos vs Abuja for landlords"
- "Inside a ₦Xm duplex you wouldn't expect"
- "Why 'newly built' doesn't mean what you think"
- "Real client journey: rented to owned in 18 months"
- "The 7 documents that protect you"
- "Service charge — how it's actually calculated"
- "C of O vs Governor's Consent vs Survey — explained"
- "Why I turned down a ₦150m listing last month"
- "What I check on every property before showing it to a client"
- "Common mistakes I see Lagos buyers making"
- "How to read a sales agreement (the 5 lines that matter)"

### 3.2 T2V cinematic topics

Visual register: aspirational but grounded. Real-estate cinematic that performs is cinematic-as-evidence, not cinematic-as-fantasy.

- Drone glide over a coastal Lagos estate.
- Sunset on a luxury terrace in Banana Island or Eko Atlantic.
- Empty sitting room transforming with morning light.
- Architectural reveal — walk through the front door, into the living space.
- Time-lapse of a development from foundation to completion.
- Tracking shot through a hallway into a master bedroom.
- Wide establishing shot of a neighbourhood — main road, then the property.

### 3.3 Carousel templates

- "7 questions to ask before any inspection"
- "How service charge is actually calculated"
- "Lekki vs Ikoyi vs Yaba — a buyer's breakdown"
- "Documents that protect you" (C of O, Governor's consent, etc.)
- "[Listing name] — virtual brochure" — 5-page property showcase
- "First-time buyer's checklist"

## 4. Brand voice variables

```
common_do_say:
  - specific neighbourhoods, not "Lagos"
  - specific numbers (price, ROI, service charge)
  - "I", "my client", "the property"
  - cautionary language ("before you sign", "the document to ask for")
  - measured outcomes ("appreciated 22% in 3 years")

common_do_not_say:
  - "luxury" used twice in the same script
  - "exclusive", "premium", "world-class" without specifics
  - "investment opportunity" without detail
  - hype-style scarcity ("only X left!")
  - "best deal in Lagos" (no, it isn't, and the viewer knows)
```

## 5. Restricted claims to flag

- **Title claims** — if the customer says "C of O is in process", "title is clean", "Governor's consent secured" — flag. We don't restate these in the brief without verification.
- **Yield projections** — "this property will yield 25% per year" must be flagged. Real-estate yield depends on market, location, and execution; we won't put numbers in the customer's mouth that they can't substantiate.
- **Government project endorsements** — if customer claims a project is "approved by the State Government" or "Federal Government partnership", flag.
- **Off-plan urgency** — flag if the customer wants high-pressure scarcity around an off-plan project.

The brief flag should be specific: "Customer mentioned 'guaranteed 25% yield' — soften to 'historically appreciated' with specific year-over-year numbers, or escalate for substantiation review."

## 6. Niche-specific calendar rhythm bias

Real-estate calendars deviate from the baseline 60/40 mix:

- **More T2V than baseline.** Real-estate buyers want to see the property. T2V here uses 60%+ quality lane allocation (vs 45% baseline).
- **UGC skews to expertise and trust, not product reveals.** "What I'd check before any inspection" beats "look at this property".
- **Carousels are the most-saved content.** Real-estate buyers print and bring carousels to inspections. The 14-page Calendar carousel allotment is a real differentiator here.

## 7. Sample reference material fallback

> Example A (expert / measured):
> "I've inspected 220 properties in Lekki over the past 4 years. Out of those, I've recommended 31. The other 189 had issues that the listing agents didn't flag. Here's the checklist I use."

> Example B (cautionary / educational):
> "If your sales agreement doesn't include a clause about the C of O, pause. I've seen Nigerian buyers lose ₦40m+ on this exact issue. The document language to look for is..."

> Example C (warm / first-person):
> "When I was buying my first place in Magodo, I missed three things that cost me an extra ₦3m in year one. I won't let my clients miss them. Here's what they are."

## 8. Photo aesthetic notes

Real-estate customers occasionally upload photos of themselves (for UGC). They less often upload photos of properties (those come from the customer's own listing photography or the AI generates establishing shots).

For founder photos:
- **Wardrobe** is usually business-casual to formal. Note the register.
- **Setting** is usually office or property-side. The visual style block should bias toward "professional but approachable" — not corporate.
- **Lighting** — many founder photos are office lighting. Flag if the photos look harsh; recommend the avatar treatment soften it.

## 9. Common upsell signals

Real-estate customers who pick Starter often have multiple listings or services and 7 videos can't cover them. Upsell triggers:

- Customer mentioned 3+ active listings.
- Customer mentioned both rental management AND sales (two distinct service lines).
- Customer mentioned an off-plan project (which needs a longer story arc).
- Customer mentioned operating in 2+ neighbourhoods (each needs its own cluster of content).

Upsell framing: "with 14 videos we can dedicate 3-4 videos per neighbourhood / listing, plus carve out the educational content (inspection checklists, document guides) that actually converts buyers."

## 10. Compliance-adjacent guidance

Real-estate is the niche most likely to drift into territory that creates legal exposure for the customer. The AI brief analysis should:

- Avoid putting specific yield numbers in any sample script.
- Avoid restating ownership or title status as fact.
- Default to "I" and "in my experience" framings rather than absolute claims.
- Include "for educational purposes — please consult your lawyer" disclaimers in any script that involves contract or document discussion.

If a customer specifically asks for content that's a hard pass (claims they can't substantiate, predatory urgency, anti-competitor framing), the founder discards the brief and follows up manually with what we can do instead.
