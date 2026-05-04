# Niche brief: Fashion e-commerce (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when a fashion e-commerce customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`.

## 1. Who's in this niche

- Ankara, adire, and aso-oke designers selling ready-to-wear.
- Bespoke / made-to-measure tailors.
- Modest fashion brands.
- Streetwear and contemporary brands.
- Bag, shoe, and accessories makers.
- Stylist-led brands (founder is also the stylist).
- Hair and headwear brands (gele, headwraps, wigs as fashion).

Edge cases:
- Vintage / thrift sellers — fits but slants toward Quality Tells and Process Tour rather than ready-to-wear product launches.
- Costume / theatrical fashion — flag as restricted-adjacent if claims involve celebrity dressing.
- Wholesale-only operations — fits but slants toward Process Tour and B2B-leaning archetypes.

## 2. Tone and voice patterns

Fashion e-commerce in Nigeria converts on aesthetic + craft-substantiation. The buyer wants the look *and* wants to know it'll last. Content that pairs aspirational visuals with concrete craft details (stitch counts, fabric sourcing, finishing time) outperforms either lane alone.

Common tonal markers:

- Specific fabric vocabulary used naturally: ankara, adire, aso-oke, lace, organza, satin, chiffon, brocade.
- Construction language: lined, French-seamed, hand-finished, pleated, dart-fitted.
- Time references: "14 hours of hand-finishing", "3-day turnaround".
- Specific size/fit framing: "fits true to size", "runs a half-size large".
- Light Naija inflection if customer reference posts use it.

Avoid:
- Generic luxury copy ("timeless elegance", "sophistication").
- Aesthetic-only captions with no substance.
- Implied custom claims ("each piece is one of a kind") unless the customer's process actually delivers that.
- "Empowering women" generic framing.
- First-person biographical anecdotes that we haven't been given.

## 3. Topic library — by archetype

### Pricing Breakdown
- "Why a custom ankara dress costs ₦[X] — fabric, lining, hand-finishing."
- "What ₦[X] gets you in this collection."
- "The cost of one bespoke piece, broken down."

### Product Tour
- "Inside the [signature collection] — every piece, every detail."
- "The [bestseller] explained: fabric, fit, finishing."
- "What's actually in this [piece] — the construction tour."

### Process Tour / Behind-the-Work
- "From fabric to finished piece — a [N]-step tour."
- "[N] hours of hand-finishing in [N] seconds." (T2V time-lapse style)
- "The cutting room: how a single dress comes together."
- "What goes into one ankara piece."

### Quality Tells
- "How to spot a well-made ankara piece."
- "[N] signs your tailor took shortcuts."
- "Stitch quality tells: the finish that separates premium from rushed."

### Common Mistake / Decision Framework
- "Stop washing your ankara like that."
- "The [N] mistakes that ruin a custom piece."
- "Bespoke vs ready-to-wear: when each makes sense."
- "How to size yourself for a custom order without coming to the shop."

### Outcome Showcase / Quality Moment (T2V cinematic)
- Slow-motion fabric in motion (dancing, walking, twirling).
- Cutting-room close-ups: scissors through fabric, pins on a mannequin.
- Hand-stitching close-ups.
- Garment hanging on a wooden hanger, golden-hour window light.
- Texture macros: weave details, beadwork, embroidery.

### Use-Case Spotlight / Adjacent Possibility
- "[Piece] for a Lagos wedding."
- "How to style [piece] for owambe vs office."
- "Three ways to wear our [signature piece]."

### Industry Pattern / Market Reality
- "Ankara prices in Lagos right now — by the metre."
- "What a typical custom-tailoring timeline looks like."
- "Why turnaround times have shifted in 2026."

### Day-in-the-Output / Use-Case Spotlight
- "Owambe-ready outfits from our collection."
- "Office-to-evening pieces."
- "What our pieces look like during a typical day in Lagos."

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - fabric and construction vocabulary used naturally
  - specific time and labour references ("14 hours", "3-day finish")
  - sensory descriptors ("the drape", "the weight", "the hand-feel")
  - direct addressing of buyer concerns ("I know you've had pieces ruin in the wash")
  - light Naija inflection if reference posts support it

common_do_not_say:
  - "timeless", "iconic", "elegance" without substance
  - "every piece tells a story" (cliché)
  - "empowering women" generic
  - claims about being "the only" or "the best"
  - first-person biographical claims not in customer material
```

## 5. Restricted claims to flag

- "100% original" / "one-of-a-kind" framing if the customer's process can't substantiate.
- Specific celebrity dressing claims if not provided with consent.
- Sustainability claims ("eco-friendly fabric", "ethical sourcing") without substantiation.
- "Made in Nigeria" framing when fabric is imported and only assembly is local — flag for honest disclosure.
- Specific durability claims ("lasts 10 years") without reasoning.

## 6. Niche-specific framework × archetype affinity adjustments

- **Process Tour and Behind-the-Work archetypes run very strong.** Fashion is the most visually-rewarded niche for craft visuals.
- **T2V allocation skews heavier than 40%.** Fabric in motion, cutting-room scenes, finishing close-ups all reward T2V.
- **Pricing Breakdown is high-trust here.** Fashion buyers regularly ask "why is this so expensive" — answering proactively converts.
- **Educational Breakdown around fabric and construction performs well.**
- **Avoid Symptom Diagnosis archetype** — fashion buyers aren't looking for problem-aware content.

## 7. Sample reference material fallback — observational, not first-person

> Example A (craft-substantiated):
> "Each piece in this collection takes 14 hours to hand-finish. That's six hours on the cut, four on the construction, three on the finishing details, and one on the final pressing. The price reflects what's in the work."

> Example B (sensory, observational):
> "There's a moment when a fabric stops being a length on a roll and becomes a piece. Usually it's the second fitting — the line of the shoulder, the way the hem falls. That's the moment we know it's right."

> Example C (educational, observational):
> "If you've had ankara pieces shrink or fade, the fabric isn't the issue — the wash is. Most ankara is dyed using methods that need cold water, gentle handling, and shade-drying. Here's the routine."

None claim "I designed this in honour of my mother" or "Aisha wore our piece to her engagement". Observational craft framing only.

## 8. Photo aesthetic notes

- Customer-modelled photos (founder wearing their own pieces) work very well for avatar generation.
- Studio-flat photos of garments don't help avatar generation but do help T2V product cinematic.
- Look-book style (model + setting) is high-quality input for both avatar and T2V.
- Note dominant fabric palette — informs the visual_style block.
- Watch for inconsistent lighting across photos — flag if avatar reference data would be ambiguous.

## 9. Common upsell signals

- Multiple collections per year.
- Frequent custom-order volume.
- Customer mentioned "launch" of a new line.
- Customer operates across markets (Lagos + Abuja, or Nigeria + UK diaspora).

Upsell framing: "with 30 videos you can cover the full collection (each piece showcased), the construction story for each fabric type, pricing transparency, and styling content — all in one calendar."

## 10. No-fabrication notes specific to fashion

Fashion has high fabrication temptation around designer-origin storytelling and customer testimonials. The AI must resist:

- **"This collection was inspired by..."** unless the customer specifically typed the inspiration into step 6.
- **Specific customer wear stories.** "Aisha wore our piece to her engagement" — off the table without consent.
- **Family heritage claims.** "My grandmother taught me how to read fabric" — off the table.
- **Designer journey narratives.** "When I started this brand..." — off the table unless customer typed it.

What we do instead:

- **Construction substantiation** — hours, stitches, finishing detail.
- **Fabric education** — sourcing, weight, weave, care.
- **Process visuals** showing the work without narrating biography.
- **Pricing transparency** — labour and materials breakdown.
- **Styling guidance** for the kinds of occasions the customer's audience attends.
- **Defensible opinion** — "ankara wash routines are mostly wrong" needs no biography.

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
