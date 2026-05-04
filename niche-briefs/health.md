# Niche brief: Health & wellness (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when a health & wellness customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`. Health, like fintech, is regulatory-sensitive — claims that could be construed as medical advice are tightly controlled.

## 1. Who's in this niche

- Fitness coaches and personal trainers selling programmes.
- Nutritionists and registered dieticians.
- Mental health practitioners (within their licensure scope).
- Wellness brands (supplements, herbal products — within NAFDAC and advertising scope).
- Yoga, pilates, and movement instructors.
- Fertility-and-wellness educators (within scope; medical claims tightly restricted).
- Sleep and habit coaches.
- Physiotherapists in private practice.

Edge cases — restricted by default, requires founder pre-approval:
- Any business making weight-loss claims with specific numbers / timelines — restricted.
- Supplements claiming disease treatment — restricted.
- Detox and "cleanse" products with medical framing — restricted.
- Fertility / reproductive health products with implied medical efficacy — restricted.
- Any product implying it cures, treats, or prevents disease — hard-block.

When the customer's business sits on or near a restricted line, the AI flags the brief for founder review *before* analysis runs.

## 2. Tone and voice patterns

Health & wellness in Nigeria converts on credentials + practical specifics. The audience is sceptical (with reason — wellness scam volume is high) and rewards content that *demonstrates the practitioner's competence* via specifics rather than testimonials.

Common tonal markers:

- Specific physiological vocabulary used appropriately ("vagal tone", "heart rate variability", "macronutrient ratio") — only when the customer's credentials support it.
- Practical instruction: "do this for 90 seconds before X", "track this for a week".
- Direct address of audience confusion: "everyone tells you to do X — here's why it doesn't always work".
- Light Naija inflection if reference posts use it; otherwise neutral.

Avoid:
- "Holistic" / "balance" / "alignment" without substance.
- Specific weight-loss numbers or timelines.
- Implied disease-treatment claims.
- Customer-transformation narratives ("Sarah lost 10kg in 6 weeks").
- Hyperbole about ancient wisdom or natural superiority.
- First-person biographical anecdotes that we haven't been given.

## 3. Topic library — by archetype

### Educational Breakdown / Decoded Jargon
- "What HRV (heart rate variability) actually measures."
- "Macronutrients explained — without the bro-science."
- "Decoding food labels: the parts that actually matter."

### Insider Checklist / Pre-Decision Audit
- "[N] questions to ask any new fitness coach before signing up."
- "What to check before any new supplement enters your routine."
- "The pre-session audit for any first session with a [practitioner type]."

### Common Mistake / Symptom Diagnosis
- "[N] common workout mistakes that aren't doing you favours."
- "Signs your sleep routine isn't working — even when you think it is."
- "If you have [pattern], here's what's likely happening."

### Process Tour / Service Anatomy
- "What a typical session with [practitioner type] actually involves."
- "Inside a [programme] week: training, nutrition, recovery."
- "From intake to first session: how the process works."

### Quality Tells
- "How to tell if a fitness coach actually knows what they're doing."
- "[N] signs a wellness practice is grounded in science."
- "What separates real expertise from wellness influencers."

### Category Myth / Frame Re-Set
- "The [common health myth] Nigerians keep believing."
- "Stop thinking about [topic] as [old frame] — it's actually [new frame]."
- "Why [popular wellness advice] doesn't work for everyone."

### Industry Pattern / Market Reality
- "What Nigerian gyms actually deliver vs what they advertise."
- "The state of mental health support in Lagos right now."
- "Where [niche] is heading in 2026."

### Cost of Inaction / Hidden Trap
- "What chronic [pattern] actually costs over a year."
- "The wellness trap most Nigerian women fall into."
- "Why most [behaviour] backfires."

### Educational Breakdown / Quick-Win
- "A 90-second [practice] you can do at your desk."
- "One thing to add to your morning that improves [outcome]."
- "The shortest workout that still works."

### Outcome Showcase / Quality Moment (T2V — careful)
- Movement footage (proper form being demonstrated, no specific result claims).
- Kitchen counter scenes (food prep, no implied transformation).
- Calm morning routines (T2V).
- Equipment close-ups during use.

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - physiological / methodological vocabulary appropriate to credentials
  - specific durations, frequencies, intensities
  - "what we see in practice" — observational expertise
  - direct addressing of audience confusion
  - "research shows" with cited source, or "in clinical experience" when clinical experience exists

common_do_not_say:
  - "holistic", "balance", "alignment" without substance
  - specific weight-loss numbers
  - cure / treat / heal / prevent claims
  - "ancient wisdom" / "natural is always better" framing
  - first-person biographical claims not in customer material
```

## 5. Restricted claims to flag

- Cure / treat / heal / prevent specific disease — hard-block.
- Specific weight-loss timeline ("lose 10kg in 6 weeks") — hard-block.
- Implied medical advice from non-licensed practitioners — flag.
- Implied medical advice from licensed practitioners that exceeds their licensure — flag.
- "All-natural" framing implying safety — flag for substantiation.
- Specific outcome guarantees of any kind — flag.
- Comparisons to specific medications without medical credentials — flag.

## 6. Niche-specific framework × archetype affinity adjustments

- **Educational frameworks dominate.** Genuine expertise needs to be visible.
- **Quick-Win archetype runs very strong.** Audience reward for "what can I do today" content is high.
- **Outcome Showcase runs lower than other niches.** Visual outcome claims are high-restriction.
- **Symptom Diagnosis runs strong, with care.** Helping audience self-identify problems is valuable; making medical claims is not.
- **Behind-the-Work runs medium.** Some practitioner work is visually compelling (movement, food prep), some isn't.

## 7. Sample reference material fallback — observational, not first-person

> Example A (specific, methodological):
> "Heart rate variability is the spacing between heartbeats. Higher variability usually means your nervous system is recovering well. There are three things that consistently move it — sleep, slow breathing in the evening, and not training intensely in the 3 hours before bed."

> Example B (educational, observational):
> "Most people overthink their first workout. The single biggest predictor of whether you'll still be training in 3 months isn't how hard your first week is — it's whether you scheduled the second week before finishing the first."

> Example C (myth-busting, observational):
> "The 8-glasses-a-day water rule isn't from research — it's from a single 1945 recommendation people misread. Hydration depends on body size, climate, and activity. In Lagos heat with active days, most people need more. In sedentary office days, less."

None of these claim "I lost X kg" or "my client transformed in Y weeks". Observational, methodological framing only.

## 8. Photo aesthetic notes

- Practitioner photos in setting (gym, kitchen, clinic, studio) work well for avatar.
- Note credentials visible in photos (certifications on walls, equipment) — feeds visual_style.
- Demonstration photos (form, technique) are valuable for T2V references.
- Avoid before/after photos — flag if customer's reference material includes them.

## 9. Common upsell signals

- Customer mentioned launching new programme.
- Customer is recently certified / accredited (often coincides with content push).
- Customer operates across formats (in-person + online + cohort).
- Customer mentioned competing in a saturated sub-niche (e.g. fitness in Lagos) — volume helps.

Upsell framing: "30 videos lets you cover practitioner education, process explanation, common myths, and quick-win tactics across the month — without making the kinds of outcome claims that get content flagged."

## 10. No-fabrication notes specific to health

Health is a high-stakes niche where false claims can cause direct physical harm. The AI must resist:

- **Outcome transformation stories.** "Tola lost 12kg in 8 weeks" — off the table without documented consent and substantiation, plus this approaches restricted-claim territory regardless.
- **"I used to weigh / suffer / struggle with..."** — off the table unless customer typed it into step 6.
- **Specific patient / client narratives.** "When I worked with a client who had X..." — off the table.
- **Implied insider medical knowledge** — "what your doctor isn't telling you" — off the table.
- **Anecdotal evidence dressed as data** — "in my practice, 80% of cases..." — flag for substantiation.

What we do instead:

- **Methodological education** about how the body / mind / process actually works.
- **Practical instruction** with general applicability.
- **Industry-pattern observations** about what works and what doesn't.
- **Decision frameworks** for self-evaluation.
- **Research summaries** with cited sources.
- **Defensible opinion** on common practice ("most Nigerian gyms over-prescribe cardio" is defensible; "I learned this when..." needs source).

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
