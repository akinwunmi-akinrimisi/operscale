# Niche brief: Education (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.
**Last updated:** 2026-05-04.

This document is the operational knowledge the AI consults when an education customer submits a brief. It pairs with the framework × archetype selection from `docs/specs/non-duplication-system.md` and the no-fabrication rule from `docs/specs/content-types-allowed.md`. Education is the closest niche to Cloudboosta in spirit — heavy on credibility-building through demonstrated expertise.

## 1. Who's in this niche

- Cohort-based course operators (cloud, design, data, marketing, finance, sales, AI).
- One-on-one tutors offering structured programmes.
- Online academies and bootcamps.
- Test-prep providers (JAMB, IELTS, GMAT, CFA, ACCA, etc.).
- Career coaches selling skills programmes.
- Business / entrepreneurship educators.
- Language schools and language coaches.
- Children's enrichment programme operators.
- Skills-trade trainers (catering, fashion, beauty, photography, etc.).

Edge cases:
- University-level academic tutoring — fits but may need extra restricted-claim care around guaranteed admission.
- Children's education content marketed at parents — fits, audience pivot affects voice.
- Religious / faith-based education — flag for restricted-claim care; keep secular framing in scripts unless customer explicitly opts in.
- Get-rich-quick "business education" — restricted by default; route through fintech-style compliance pre-check.

## 2. Tone and voice patterns

Education in Nigeria converts on credibility + outcome specificity. The audience is investing time and money, and rewards content that *proves the curriculum is real* rather than promising vague transformation.

Common tonal markers:

- Specific curriculum references — module names, week-by-week structure.
- Outcome specificity grounded in cohort data ("the most recent cohort", "our typical learner").
- Direct addressing of audience confusion: "you're not bad at maths — your last teacher was".
- Light professional swagger: "this is what employers actually look for" beats "we're the best academy".
- Naija inflection if customer's audience is Nigerian; neutral professional if diaspora-heavy.

Avoid:
- Generic "transform your life" framing.
- Specific salary or job-placement guarantees.
- "Industry-leading" / "world-class" without substance.
- Implied accreditation that the customer hasn't claimed.
- First-person biographical anecdotes that we haven't been given.

## 3. Topic library — by archetype

### Tier Comparison
- "[Cohort A] vs [Cohort B] — when each is the right fit."
- "Self-paced vs cohort-based: the trade-offs."
- "[N]-week intensive vs 12-week deep — how to choose."

### Service Anatomy / What You Get
- "Inside the [course name] — every module, every assignment, every output."
- "What lands in your inbox after you enrol."
- "The [N] deliverables in our [programme]."

### Process Tour / Process Demystification
- "From application to first cohort: how the process works."
- "What a typical week in [course] looks like."
- "Behind a single [course] week: instructors, assignments, peer review."

### Insider Checklist / Pre-Decision Audit
- "[N] questions to ask before enrolling in any cohort."
- "What to check on a course curriculum before paying."
- "Red flags in any [niche] course offering."

### Common Mistake / Decision Framework
- "Why most [audience] who try to learn [skill] alone give up by week 4."
- "[N] mistakes self-taught [audience] keep making."
- "Bootcamp vs degree: when each is the right path."

### Quality Tells
- "How to spot a course that actually teaches vs one that gets clicks."
- "[N] signs your instructor knows what they're doing."
- "What separates real curriculum design from repackaged YouTube."

### Decoded Jargon
- "What '[term]' actually means in a [niche] curriculum."
- "Decoding course-marketing language."
- "Reading a syllabus — the parts that actually matter."

### Educational Breakdown / Quick-Win
- "A [skill] concept in 60 seconds."
- "One thing every [audience] should know about [topic]."
- "The fastest way to [skill outcome] — the version you can use today."

### Industry Pattern / Market Reality
- "What [industry] actually hires for in 2026."
- "The state of [niche] careers right now."
- "Why most [niche] roles look different from what universities teach."

### Cost Reveal / Pricing Breakdown
- "[Course price]. Here's where every naira goes."
- "Why our cohort costs ₦[X] — instructors, infrastructure, materials, support."
- "The real cost of a [niche] career — by the numbers."

### Use-Case Spotlight / Adjacent Possibility
- "[Programme] for someone who's never written a line of code."
- "Beyond [common use] — what graduates actually do."
- "[Course] from the angle of [specific career change]."

### Outcome Showcase (T2V — careful)
- Cohort completion footage (no specific named graduates without consent).
- Curriculum visualisation (modules animating across screen).
- Workspace shots — laptops, notes, learning environments.
- Instructor-on-camera in teaching pose (avatar reference).

## 4. Brand voice variables (defaults; overridden by extraction)

```
common_do_say:
  - specific module / week / assignment names
  - exact cohort sizes, durations, pricing, deliverables
  - "the most recent cohort", "our typical learner" — observational
  - direct addressing of audience self-doubt
  - employer / industry-relevant language

common_do_not_say:
  - "transform your life" generic
  - specific salary guarantees
  - specific job-placement guarantees
  - "world-class" / "industry-leading" without substance
  - first-person biographical claims not in customer material
```

## 5. Restricted claims to flag

- Specific salary guarantees ("graduates earn ₦Xm") — hard-block without verified data + disclaimer.
- Specific job-placement percentages without methodology.
- Implied university affiliation when none exists.
- Implied government accreditation when none exists.
- Specific exam-pass-rate percentages without methodology.
- "Become a [profession] in 3 months" overclaim — flag for honest timeline.

## 6. Niche-specific framework × archetype affinity adjustments

- **Educational frameworks dominate** (consistent with the niche's nature).
- **Tier Comparison runs strongest here.** Course buyers compare options heavily.
- **Cost Reveal / Pricing Breakdown convert exceptionally well.** Course pricing scrutiny is high in Nigeria.
- **Process Demystification matters** — Nigerian buyers are wary of paying for vapourware.
- **Outcome Showcase runs medium** — high impact when grounded, high risk when not.
- **Behind-the-Work runs medium** — instructor demos work; admin work doesn't.

## 7. Sample reference material fallback — observational, not first-person

> Example A (specificity-led):
> "Our most recent cohort had 47 learners. 38 completed all 12 weeks. 31 shipped a final project that's currently live. The breakdown of where they came from: 22 self-taught, 14 from other bootcamps, 11 university students. This is the data we look at, not vibes."

> Example B (educational, observational):
> "Most people who try to learn [skill] alone burn out around week 4. The reason isn't motivation — it's the lack of feedback loops. Here's why structured cohorts solve this and self-study often doesn't."

> Example C (curriculum-grounded):
> "Week 6 of our programme covers [topic]. By the end of that week, learners build [output] and present it to a peer review group. That's why a learner who finishes our course can show employers a portfolio piece — not just a certificate."

None of these claim "I built this course because I was once that struggling student" or "Tomi went from beginner to senior engineer in 6 months". Observational, curriculum-grounded framing only.

## 8. Photo aesthetic notes

- Instructor-in-teaching-pose photos work very well for avatar.
- Workspace and laptop shots feed visual_style well.
- Cohort group photos — flag for individual consent before any specific people are referenced; safer to keep generic ("our recent cohort").
- Whiteboard / curriculum diagram photos work well for T2V references.

## 9. Common upsell signals

- Customer enrols cohorts on a fixed schedule (every 4-12 weeks).
- Customer mentioned launching new programme or new module.
- Customer operates across markets (Nigerian + diaspora students).
- Customer mentioned scaling instructor team.

Upsell framing: "30 videos lets you cover the full curriculum (one module per video for several weeks), pricing breakdown, instructor demos, and outcome content — that's most of a cohort enrolment cycle."

## 10. No-fabrication notes specific to education

Education is high-stakes for fabrication because false outcome claims can harm audience financial decisions. The AI must resist:

- **Specific graduate transformation stories.** "Tomi went from no-job to senior engineer in 6 months" — off the table without consent and substantiation.
- **"When I was a student / when I was struggling..."** — off the table unless customer typed it into step 6.
- **Implied insider hiring knowledge** — "what hiring managers actually look for" — okay only as observational expertise, never as personal-anecdote claims.
- **Specific-cohort outcome percentages** without methodology — flag.
- **Implied curriculum credentials** — "this curriculum is recognised by [body]" — off the table unless substantiated.

What we do instead:

- **Curriculum education** — what's actually in the course.
- **Pricing transparency** — what the cost covers.
- **Process demystification** — what the cohort experience actually involves.
- **Decision frameworks** — how to choose among learning paths.
- **Industry pattern observations** — what [niche] careers actually look like.
- **Defensible opinion** on pedagogy, employer expectations, niche reality.
- **Cohort-level data** when available with methodology disclosure.

## 11. Cross-references

- `docs/specs/script-frameworks.md`
- `docs/specs/angle-archetypes.md`
- `docs/specs/research-methodology.md`
- `docs/specs/content-types-allowed.md`
- `niche-briefs/restricted.md`
