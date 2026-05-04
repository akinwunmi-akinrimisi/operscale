# Niche brief: Food (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when a food customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`.

## 1. Who's in this niche

- Catering businesses (events, weddings, owambe, corporate).
- Bakeries — cake-led, bread-led, pastry-led, custom-cake.
- Restaurants and cloud kitchens.
- Specialty food brands (sauces, spices, preserved foods, beverages).
- Meal-prep and subscription kitchens.
- Cooking-class providers and culinary educators.
- Private chefs serving high-net-worth clients.
- Beverage brands (juices, teas, kombucha).

Edge cases:
- Restaurants with a single famous dish — fits, but content slants very heavily toward that dish; flag if product diversity is needed.
- Wholesale-only food brands — fits but slants away from Outcome Showcase, toward Process Tour and B2B archetypes.
- Functional / wellness foods making health claims — route through health restricted-claim flagging.

## 2. Tone and voice patterns

Food in Nigeria converts on appetite + craft. Visual must trigger hunger; copy must demonstrate care for the work. Content that pairs sensory imagery with concrete craft details (sourcing, prep time, technique) outperforms aesthetic-only content.

Common tonal markers:

- Specific ingredient vocabulary used naturally.
- Time language: "12-hour fermentation", "3-day cure", "overnight rest".
- Sensory descriptors: "the crackle of the crust", "spice that hits before sweet".
- Direct invitation: "your weekend just decided itself".
- Light Naija inflection — food is a register where Pidgin and local language land naturally.

Avoid:
- Generic restaurant copy ("delicious", "amazing", "must-try").
- "Foodie" Twitter aesthetic.
- Implied health claims ("clean eating", "guilt-free") unless the customer has substantiation.
- Overstated origin claims ("authentic Italian") if the customer's process doesn't substantiate.
- First-person biographical anecdotes that we haven't been given.

## 3. Topic library — by archetype

### Pricing Breakdown
- "Why this catering platter is ₦[X] — every ingredient and labour line."
- "What ₦[X] gets you in our [package]."
- "The cost of one wedding cake — broken down."

### Process Tour / Behind-the-Work
- "From flour to finished loaf — the [N]-stage process."
- "[N] hours of [process] in [N] seconds." (T2V time-lapse)
- "Inside our kitchen during [event type] prep."
- "The morning of an owambe order — what actually happens."

### Quality Moment / Outcome Showcase (T2V cinematic)
- Slow-motion bread crust crackle.
- Steam rising from a freshly opened pot.
- Spoon dragging through sauce.
- Cake-cut reveal.
- Plating shots — sauce drag, garnish placement, final swipe.

### Insider Checklist / Pre-Decision Audit
- "[N] questions to ask before ordering catering for any event."
- "What to check on a wedding-cake quote before paying."
- "[N] red flags in a Nigerian catering proposal."

### Common Mistake / Decision Framework
- "[N] mistakes Lagos brides make when ordering catering."
- "DIY-vs-cater for your next event — when each makes sense."
- "How to size a catering order without overshooting."

### Quality Tells
- "How to spot a properly-made [dish]."
- "[N] signs your caterer cares about the food."
- "What separates a real artisan baker from a high-volume bakery."

### Process Demystification
- "How a single wedding-day catering order actually unfolds."
- "What 'made-to-order' really means in our kitchen."
- "From booking to event day — every checkpoint."

### Decoded Jargon
- "Sous-vide, confit, fermented — what these actually mean."
- "Reading a menu without the food-snob translation."
- "What '[term]' actually means on a catering quote."

### Industry Pattern / Market Reality
- "Wedding catering pricing in Lagos right now."
- "Why event-catering costs have shifted in 2026."
- "The state of the Nigerian baking market."

### Use-Case Spotlight / Adjacent Possibility
- "Our [signature dish] for a 20-person dinner party."
- "Beyond owambe — surprising contexts for our catering."
- "[Product] for an everyday weeknight."

### Day-in-the-Output
- "What our subscription kitchen sends out on a typical week."
- "A typical event-day timeline from our side."
- "Weekday meal-prep with our service."

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - specific ingredient and technique vocabulary
  - precise time and labour references ("12 hours", "3-day cure")
  - sensory descriptors ("the crackle", "the steam", "the texture")
  - direct invitation to imagine the eating experience
  - light Naija inflection where reference posts support it

common_do_not_say:
  - "delicious", "amazing", "must-try" without specifics
  - "clean eating", "guilt-free" without substantiation
  - "the best in Lagos" overclaim
  - "authentic [cuisine]" if process doesn't substantiate
  - first-person biographical claims not in customer material
```

## 5. Restricted claims to flag

- "Authentic [foreign cuisine]" if the customer hasn't substantiated training or sourcing.
- Health claims ("immunity-boosting", "fat-burning", "detox") — flag for substantiation, often hard-block.
- "All-natural" / "organic" / "no preservatives" — flag unless customer's process substantiates.
- Specific allergen claims ("nut-free kitchen") without confirmed kitchen hygiene protocols.
- Comparisons to specific named restaurants as targets.
- Claims about exclusive sourcing without confirmation.

## 6. Niche-specific framework × archetype affinity adjustments

- **T2V allocation skews toward sensory cinematic.** Food rewards close-up, slow-motion, texture-led visuals more than any other niche.
- **Quality Moment archetype runs strongest here.** A 5-second sauce-drag clip can outperform a full educational video.
- **Process Tour and Behind-the-Work run strong** because food work is visually compelling.
- **Pricing Breakdown converts well** because catering buyers regularly seek transparency.
- **Decoded Jargon runs lower** than other niches — food jargon is less of a barrier.
- **Symptom Diagnosis runs lowest** — food buyers aren't problem-aware in the diagnostic sense.

## 7. Sample reference material fallback — observational, not first-person

> Example A (sensory, observational):
> "Bread that's been properly fermented sounds different when it cuts. Listen for the crackle in the crust — that's the dough telling you it had time. A 12-hour fermentation gives you that. A 2-hour fermentation gives you something else entirely."

> Example B (craft-substantiated):
> "A custom 4-tier wedding cake takes us 3 days. Day one: structure baking and crumb-coating. Day two: ganache, fondant, and detail work. Day three: assembly, on-site adjustments, presentation. The price reflects what's in the work."

> Example C (educational, observational):
> "Most catering orders in Lagos overshoot by 30%. The reason isn't generosity — it's a sizing formula nobody questions. Here's the actual math for a 100-guest event."

None of these claim "I learned this from my grandmother" or "Sade's wedding was the most beautiful event we catered". Observational craft framing only.

## 8. Photo aesthetic notes

- Food close-ups (plated dishes) are gold for T2V references.
- Founder-in-kitchen photos work well for avatar.
- Avoid harsh fluorescent kitchen photos — flag for production.
- Note dominant colour palette of food — informs visual_style.
- Event photos showing tables of catering work well for outcome showcase context.

## 9. Common upsell signals

- Customer caters for events 4+ times per month.
- Customer mentioned weddings or owambe season.
- Customer recently launched a new menu or seasonal range.
- Customer operates across formats (catering + retail + subscription).

Upsell framing: "30 videos lets you cover the full menu (each signature dish), the catering process, pricing transparency, sensory-cinematic hero shots, and behind-the-kitchen content — perfect for a season's worth of bookings."

## 10. No-fabrication notes specific to food

Food has high fabrication temptation around family-recipe origin stories and wedding-customer testimonials. The AI must resist:

- **"This recipe was passed down from my grandmother..."** — off the table unless customer typed it into step 6.
- **Specific event/customer wedding stories.** "Sade's owambe was 600 guests" — off the table without consent.
- **"I learned this technique in [foreign country]..."** — off the table unless customer typed it.
- **Family / village origin narratives.** "In my mother's kitchen growing up..." — off the table.

What we do instead:

- **Process visuals** showing the craft without narrating biography.
- **Pricing transparency** with labour and ingredient breakdowns.
- **Sensory cinematic** — appetite triggers via T2V quality moments.
- **Educational content** about technique, ingredient, timing.
- **Catering / event guidance** at the category level (sizing, sequencing, season-pricing).
- **Defensible opinion** on technique, ingredients, sourcing approach.

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
