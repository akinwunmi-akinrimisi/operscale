# Niche brief: Beauty (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when a beauty customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`.

## 1. Who's in this niche

- Skincare brand founders (cleansers, serums, moisturisers, body care).
- Cosmetics founders (lipsticks, eyeshadow, foundation, brow products).
- Haircare brand founders (oils, treatments, tools).
- Spa, salon, and treatment-clinic owners.
- Beauty consultants and educators selling courses or coaching.

Edge cases:
- Cosmetic surgery — restricted (medical claims, before/after regulation).
- Skin-bleaching products marketed as lightening — hard pass.
- Lash and brow extensions service-only — fits, but slants toward Behind-the-Work and Process Tour archetypes.

## 2. Tone and voice patterns

Beauty in Nigeria converts on warmth and trust over authority. The dominant register is warm, observational, expertise-signalled-through-specificity rather than expertise-signalled-through-credentials. Even technical founders (chemists, dermatologists) lean conversational on social.

Common tonal markers in successful Nigerian beauty content:

- Light Pidgin or Yoruba interjections used naturally: "abeg", "no wahala".
- Direct address to the viewer: "you've been doing this wrong" works.
- Specific local grounding: harmattan dryness, Lagos heat, NEPA-light makeup mirror struggles.
- Sensory descriptors: "absorbs cleanly", "leaves no residue", "settles into a soft finish".
- Specific product-result claims grounded in formulation.

Avoid:
- Clinical / corporate vocabulary ("efficacy", "consumers", "demographic").
- US-style "blessed and grateful" gratitude opens.
- Generic skincare-Twitter aesthetic.
- Whitening-as-improvement framing — even when the customer's product is brightening-focused, frame as "even tone" or "glow", never "lighter".
- First-person biographical anecdotes that we haven't been given (per `content-types-allowed.md`).

## 3. Topic library — by archetype

Topics organised by archetype from `docs/specs/angle-archetypes.md`. Every topic shape is no-fabrication-safe — grounded in customer-stated facts, customer expertise, or public industry knowledge.

### Pricing Breakdown
- "[Price]. Here's what's actually in this serum."
- "Why this moisturiser costs ₦[X] — every ingredient's role."
- "What ₦[X] gets you in a beauty kit."

### Product Tour / Service Anatomy
- "What's in our [signature product] — every active and why it's there."
- "Inside the [product line]: how each piece works with the others."

### Insider Checklist / Pre-Decision Audit
- "[N] questions to ask before buying any skincare product."
- "What to check on a beauty product label before you trust it."
- "[N] red flags in a Nigerian beauty product."

### Common Mistake / Category Myth
- "The [N] biggest mistakes Nigerian women make with their skincare routine."
- "Beauty myths Nigerian women are tired of hearing."
- "Why most moisturisers fail in Lagos heat."

### Process Tour / Behind-the-Work
- "How a single batch of [signature product] is actually made."
- "From raw [ingredient] to finished bottle — the process."

### Quality Tells
- "How to spot a real, well-formulated [product type]."
- "[N] signs your skincare is actually working."
- "Texture tells: what a quality [product] feels like."

### Decoded Jargon
- "What 'fragrance' on an ingredient list actually means."
- "Decoding skincare terms: actives, vehicles, surfactants."

### Industry Pattern / Market Reality
- "What's actually in most Nigerian moisturisers right now."
- "The state of the Nigerian beauty market in 2026."

### Symptom Diagnosis
- "Signs your skin barrier is broken."
- "How to know if your moisturiser is the wrong one."

### Outcome Showcase / Quality Moment (T2V cinematic)
- Slow-motion serum drop on skin.
- Sunlit shelf with the full product line arranged.
- Hands smoothing cream into skin during golden hour.
- Texture macros — cream pulls, foam bursts, oil sheets.

### Use-Case Spotlight / Adjacent Possibility
- "[Product] for harmattan-specific care."
- "Beyond the obvious: surprising uses for [product]."

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - product/result-specific language ("this serum", "your skin barrier", "active ingredient")
  - personal stakes via observation, not biography
  - outcome-focused verbs ("evens", "calms", "softens", "absorbs")
  - sensory descriptors ("clean finish", "non-greasy", "light")
  - light Naija inflection if customer reference posts use it

common_do_not_say:
  - "consumer", "demographic", "market"
  - "efficacious", "synergistic", "innovative"
  - whitening / lightening framing
  - medical claims ("treats", "cures", "heals")
  - first-person biographical claims not in customer-provided material
```

## 5. Restricted claims to flag

- Medical claims — soften to "supports clearer skin", "comforts irritated skin" or escalate.
- Whitening / lightening — hard-block bleaching framing; founder may approve "even-tone" / "glow" pivots.
- Before/after weight or body imagery — flag.
- Implied dermatologist endorsement when no dermatologist is involved.
- NAFDAC claims when registration unconfirmed.
- Specific timeline outcome claims ("clear in 7 days") without substantiation.

## 6. Niche-specific framework × archetype affinity adjustments

- **UGC-heavier overall.** 60/40 baseline holds, but framework selection biases toward UGC-friendly frameworks (Quick-Win, Educational Breakdown, Common Mistake patterns).
- **Pricing Breakdown archetype runs strong.** Beauty buyers reward transparency.
- **Outcome Showcase via T2V** is the cinematic anchor — sensory close-ups perform better than narrative cinematic.
- **Avoid Cost of Inaction archetype.** Beauty rarely lands fear-of-loss framing well.

## 7. Sample reference material fallback — observational, not first-person

When the customer provided no reference posts, the AI uses these tone anchors. **All examples are observational or category-level — no first-person founder narrative.**

> Example A (warm, observational):
> "Lagos heat changes everything about how skincare works. A formula that's perfect in Abuja might feel heavy in Lekki by 2pm. The trick is knowing what to look for in the ingredient list before you ever try the product."

> Example B (educational, expert):
> "If your moisturiser feels heavy in Lagos heat, that's not the moisturiser — that's the formulation. Water-based products evaporate fast in our humidity. Here's what to look for instead."

> Example C (specificity, observational):
> "Three drops at night. That's the entire routine. The rest is consistency. Most simple routines outperform complex ones for Nigerian skin."

None of these say "I started this because..." or "my own skin..." or "my mother taught me..." — biographical claims require explicit customer permission.

## 8. Photo aesthetic notes

- Skin clarity — flag for production agent only; never reference in brief email.
- Lighting register — beauty performs best in warm natural daylight; flag harsh fluorescent or direct flash.
- Wardrobe — beauty founders often wear neutral / earth tones; note palette.
- Setting — affects camera treatment recommendation.

## 9. Common upsell signals

- 2+ products in range.
- Customer mentioned "launch" or "relaunch".
- Account < 6 months old.

Upsell framing: "with 14 videos you can dedicate 3-4 to each product line and still have room for ingredient education and pricing transparency content."

## 10. No-fabrication notes specific to beauty

Beauty has high fabrication temptation because the category rewards founder-led emotional storytelling. The AI must resist:

- **Origin stories.** "I started this brand because my own skin..." — off the table unless the customer explicitly typed that story into step 6 with consent.
- **Customer transformations.** "Tomi's 8-week journey" — off the table without explicit testimonial consent.
- **Family/cultural personal background.** "My mother taught me...", "My grandmother's recipe..." — off the table.
- **Specific event narratives.** "Three months ago I was about to give up..." — off the table.

What we do instead:

- **Educational content** about ingredient science, formulation logic, product selection.
- **Pricing transparency** about what makes products cost what they cost.
- **Quality tells** about spotting well-formulated products.
- **Process visuals** showing formulation work without narrating biography.
- **Defensible opinion** — "most Nigerian women over-cleanse" is fine; "I learned this when..." needs source.

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
