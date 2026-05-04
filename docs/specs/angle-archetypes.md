# Angle archetypes

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent.
**Last updated:** 2026-05-04.

This document is the canonical library of *topic archetypes* the AI brief-analysis system selects from. It pairs with `docs/specs/script-frameworks.md` (the *structure* — how to arc the script) and `docs/specs/research-methodology.md` (the *sourcing* — how the AI grounds these in the customer's actual material).

Where frameworks answer "what shape is this script?", archetypes answer "what is this script about?". A single calendar's worth of videos uses N frameworks × N archetypes deterministically combined, producing structurally varied content on topically varied angles.

## 1. The no-fabrication constraint shapes every archetype

Every archetype in this document is **safe under the no-fabrication rule** (see `docs/specs/content-types-allowed.md`). That means:

- No archetype requires the founder's biographical history.
- No archetype requires real customer testimonials we haven't collected.
- No archetype requires invented anecdotes, transformations, or origin stories.

Each archetype is grounded in something the customer has *actually told us* in the brief, *visible in their reference posts*, *general industry knowledge*, or *the customer's stated expertise*. The AI surfaces what's available and the framework wraps it.

If you find an archetype that seems to require fabrication, that's a doc bug — flag and update.

## 2. The archetype taxonomy

Twenty-five archetypes, grouped by what they ground in:

| Source of grounding | Archetypes |
|---|---|
| Customer-stated facts (pricing, services, products) | Pricing Breakdown, Service Anatomy, Product Tour, Tier Comparison, What You Get |
| Customer expertise (methodology, frameworks) | Insider Checklist, Common Mistake, Pre-Decision Audit, Process Tour, Quality Tells |
| Industry knowledge (public domain) | Decoded Jargon, Industry Pattern, Category Myth, Market Reality, Regulatory Snapshot |
| Audience pain points (problem-aware content) | Symptom Diagnosis, Cost of Inaction, Hidden Trap, Question Loop, Decision Framework |
| Aspirational direction (outcome-aware content) | Outcome Showcase, Day-in-the-Output, Quality Moment, Use-Case Spotlight, Adjacent Possibility |

Each archetype below documents:

- **What it is** — the topical angle in plain language.
- **Source of grounding** — what specifically in the customer's material this draws from.
- **Example topic shapes** — 3-5 example title patterns.
- **Framework affinity** — which frameworks this archetype pairs cleanly with.
- **Niche fit** — which of the 7 niches this works in.
- **Format fit** — UGC vs T2V vs carousel.
- **No-fabrication notes** — what would tip this archetype into fabricated territory if mishandled.

## 3. Family A — Customer-stated facts

These archetypes use information the customer literally typed into their brief. Highest-trust source; lowest fabrication risk.

### 3.1 Pricing Breakdown

**What it is.** Take the customer's stated price for their offering and decompose it into cost components.

**Source of grounding.** Customer's stated pricing in form step 2, plus customer's stated "why this costs what it costs" in step 6.

**Example topic shapes.**
- "[Price]. Here's the breakdown."
- "Why [signature offering] is [price] — the math."
- "What ₦[X] gets you (and what it doesn't)."
- "The cost of [process] — the part you don't see."

**Framework affinity.** Cost Reveal (primary), Specificity Stack, Educational Breakdown, Comparison.

**Niche fit.** Strong in fashion (custom pieces), food (premium dishes/catering), real estate (service fees), beauty (premium products), education (course pricing). Light in fintech (regulatory care).

**Format fit.** UGC (founder explaining), T2V (cost components shown visually), carousel (line-item breakdown).

**No-fabrication notes.** Use only what customer told us. If customer didn't break down costs in their brief, AI flags this archetype as needing customer input before activation.

### 3.2 Service Anatomy

**What it is.** Decompose the customer's service into its constituent parts. What does engagement actually involve?

**Source of grounding.** Customer's stated service description, deliverables, timelines.

**Example topic shapes.**
- "What [service engagement] actually includes."
- "Step by step: how a [service] project unfolds."
- "The 5 deliverables in every [service]."
- "Inside a typical [service] timeline."

**Framework affinity.** Process Demystification, Educational Breakdown, Numbered List.

**Niche fit.** Strong in real estate, education, fintech (advisory), beauty (consulting), fashion (custom services). Less applicable for product-only businesses.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Steps come from customer's stated service. Don't invent stages.

### 3.3 Product Tour

**What it is.** Walk through what the product is, what it contains, what it does. Closer to a feature-focus than a sales pitch.

**Source of grounding.** Customer's stated product description, ingredients/components, specs.

**Example topic shapes.**
- "Inside [signature product]: what's actually in it."
- "What this [product] does — and what it doesn't."
- "[Product] explained in [N] seconds."
- "The full [product] tour."

**Framework affinity.** AIDA, Quick-Win, Educational Breakdown, Curiosity Gap.

**Niche fit.** Strong in beauty (ingredient lists), food (recipe components), fashion (fabric and construction), education (curriculum content). Light in real estate, fintech.

**Format fit.** UGC, T2V (ingredient close-ups), carousel.

**No-fabrication notes.** Components must be the customer's actual product, not generic versions.

### 3.4 Tier Comparison

**What it is.** Compare the customer's own pricing tiers, packages, or service levels. Help the audience self-select.

**Source of grounding.** Customer's stated tier structure.

**Example topic shapes.**
- "[Tier A] vs [Tier B]: which is right for you?"
- "How to know if you need [premium tier] or [standard tier]."
- "Three packages, three audiences. Here's the breakdown."
- "When to upgrade from [Tier A] to [Tier B]."

**Framework affinity.** Comparison, Decision Framework, Educational Breakdown.

**Niche fit.** Strong in education (course tiers), fintech (service tiers), real estate (service levels). Light in beauty, fashion, food (where tier structures are less common).

**Format fit.** UGC, carousel.

**No-fabrication notes.** Tier features come from customer's stated structure.

### 3.5 What You Get

**What it is.** The complete deliverable list for the customer's offering. Concrete, line-item, "if you sign up tomorrow this is what arrives."

**Source of grounding.** Customer's stated deliverables.

**Example topic shapes.**
- "Everything that's in [signature offering]."
- "What lands in your inbox after [purchase trigger]."
- "The full [offering] checklist."
- "What [audience] receive on day 1."

**Framework affinity.** Specificity Stack, Numbered List, Quick-Win.

**Niche fit.** Strong in education, fintech, beauty (kits), fashion (sets), food (catering packages). Less in real estate (deliverables are less list-shaped).

**Format fit.** UGC, carousel.

**No-fabrication notes.** Items must be real and confirmed.

## 4. Family B — Customer expertise

These archetypes use the customer's *methodology and judgement* — not their personal history. Strong fit for service businesses where the founder's expertise is the offering.

### 4.1 Insider Checklist

**What it is.** A specific checklist the customer uses in their work, presented as a usable artifact.

**Source of grounding.** Customer's stated process knowledge.

**Example topic shapes.**
- "The [N]-point checklist for [decision]."
- "Before you [action], check these [N] things."
- "The list I [or 'we' or 'professionals'] use before [process]."
- "Steal this checklist: [context]."

**Framework affinity.** Checklist Reveal, Numbered List, Industry Insider.

**Niche fit.** Strong in real estate (inspection checklists), fintech (financial reviews), education (study frameworks), health (wellness checks), beauty (skin assessments). Light in food, fashion.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Checklist drawn from customer expertise. Don't generate generic checklists not tied to customer's stated approach.

### 4.2 Common Mistake

**What it is.** Identify a mistake the customer has seen in their work — without claiming a specific personal story. Frame as observed pattern.

**Source of grounding.** Customer's stated experience patterns.

**Example topic shapes.**
- "The [N] biggest mistakes [audience] make with [topic]."
- "If you're doing [specific behavior], stop."
- "The mistake even experienced [audience] make."
- "[Common pattern] — and why it doesn't work."

**Framework affinity.** Myth-Buster, PAS, Anti-Trend, Numbered List.

**Niche fit.** Universal.

**Format fit.** UGC, T2V (visualised wrong-vs-right), carousel.

**No-fabrication notes.** Mistakes framed as patterns the customer has *observed*, not as anecdotes about specific named people. "Most beginners do X" ✓. "My client Sarah did X" ✗ (unless customer explicitly provided that anecdote with consent).

### 4.3 Pre-Decision Audit

**What it is.** A list of questions or checks the audience should perform before making a decision in the customer's domain.

**Source of grounding.** Customer's stated expertise on what matters before commitment.

**Example topic shapes.**
- "[N] questions to ask before [major decision]."
- "Don't sign anything without checking this."
- "The audit I'd run before [decision]."
- "If you can't answer these [N] questions, wait."

**Framework affinity.** Checklist Reveal, Numbered List, Educational Breakdown, Industry Insider.

**Niche fit.** Strong in real estate (pre-purchase), fintech (pre-investment), education (pre-enrollment), health (pre-treatment). Light in beauty, fashion, food.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Questions must be substantive and drawn from real expertise.

### 4.4 Process Tour

**What it is.** Walk through how something is done, the customer's way. The focus is the *method*, not the *finished product*.

**Source of grounding.** Customer's stated methodology or visible work in reference posts.

**Example topic shapes.**
- "How [process] is done — properly."
- "From start to finish: a [process] walkthrough."
- "The [N] stages of [outcome]."
- "Inside [process]: what professionals see."

**Framework affinity.** Process Demystification, Educational Breakdown, Behind-the-Work.

**Niche fit.** Strong in food (cooking process), fashion (construction), beauty (formulation), real estate (inspection). Light in fintech, education (less tangible processes).

**Format fit.** T2V (process visualised), UGC (founder narrating), carousel.

**No-fabrication notes.** Process drawn from customer's actual methodology. If customer didn't describe their process, AI flags this archetype as needing customer input.

### 4.5 Quality Tells

**What it is.** What separates good work from bad in the customer's category. The signs of competence the audience can spot themselves.

**Source of grounding.** Customer's stated quality criteria, professional knowledge of category.

**Example topic shapes.**
- "How to spot [good vs bad] in [category]."
- "[N] signs you're getting quality [thing]."
- "The tells of a real [professional/product]."
- "What separates [premium] from [standard]."

**Framework affinity.** Educational Breakdown, Industry Insider, Comparison.

**Niche fit.** Strong in beauty (formulation tells), fashion (construction tells), real estate (property tells), food (ingredient tells). Light in fintech, education.

**Format fit.** UGC, T2V (close-ups of tells), carousel.

**No-fabrication notes.** Tells must be substantive criteria, not vibes.

## 5. Family C — Industry knowledge

These archetypes use general public-domain knowledge of the customer's category. Useful when customer-specific material is thin and we want to ground content in shared reality.

### 5.1 Decoded Jargon

**What it is.** Translate niche jargon into plain language with examples.

**Source of grounding.** Public knowledge of niche terminology.

**Example topic shapes.**
- "What '[term]' actually means."
- "Decoding [N] [niche]-speak terms."
- "If you've heard [term] and nodded — read this."
- "[Term] in plain language."

**Framework affinity.** Decoded Jargon (yes, framework named the same), Educational Breakdown, Industry Insider.

**Niche fit.** Strong in fintech (BVN, NIN, NRS, PFA), real estate (C of O, Governor's consent), beauty (active ingredients, INCI), education (accreditation jargon). Light in fashion, food (lower jargon density).

**Format fit.** UGC, carousel.

**No-fabrication notes.** Definitions must be accurate. AI flags any uncertainty. We don't make up term meanings.

### 5.2 Industry Pattern

**What it is.** A pattern visible across the industry — how things tend to go, what's typical, what's unusual.

**Source of grounding.** Public industry knowledge.

**Example topic shapes.**
- "Why [common industry phenomenon] happens."
- "The pattern in [niche] nobody talks about."
- "What's actually going on in [industry trend]."
- "Why [audience] keep [pattern] — the systemic reason."

**Framework affinity.** Frame Re-Set, Educational Breakdown, Anti-Trend.

**Niche fit.** Strong in fintech, real estate, education. Light elsewhere.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Patterns must be defensible — flag anything speculative.

### 5.3 Category Myth

**What it is.** A widely-believed claim in the niche that's actually wrong (or at least misleading).

**Source of grounding.** Public knowledge of category misconceptions.

**Example topic shapes.**
- "The [niche] myth costing you [resource]."
- "Stop believing [common claim]."
- "[Claim] isn't true. Here's what is."
- "Why [popular advice] backfires."

**Framework affinity.** Myth-Buster (primary), Anti-Trend, Frame Re-Set.

**Niche fit.** Universal but high-care in health (medical myths require substantiation), fintech (financial myths require care).

**Format fit.** UGC, carousel.

**No-fabrication notes.** Both the myth and the truth must be defensible.

### 5.4 Market Reality

**What it is.** A snapshot of the customer's market — pricing ranges, typical timelines, common conditions. Sets context.

**Source of grounding.** Public market data + customer's category knowledge.

**Example topic shapes.**
- "What [product/service] costs in 2026."
- "The [audience] reality: [N] specific facts."
- "Lagos market for [thing], explained."
- "[Niche] right now — the honest snapshot."

**Framework affinity.** Dataset Reveal, Educational Breakdown, Specificity Stack.

**Niche fit.** Strong in real estate, fintech, education, fashion (market trends). Light in beauty, food, health.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Numbers must be cited or verifiably typical. Flag uncertainty.

### 5.5 Regulatory Snapshot

**What it is.** A current-state explanation of regulations or rules affecting the customer's audience.

**Source of grounding.** Public regulatory documents (CBN, FIRS, NDPC, NAFDAC, etc.).

**Example topic shapes.**
- "What changed in [regulation] — and what you need to do."
- "[Regulation] explained: the part that affects you."
- "Five things [regulation] requires that nobody mentions."
- "[Authority] just released [thing]. What it means."

**Framework affinity.** Educational Breakdown, Industry Insider, Process Demystification.

**Niche fit.** Strong in fintech (CBN, FIRS, NDPC), real estate (Lagos State land documents), education (accreditation), beauty (NAFDAC). Light in fashion, food.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Regulatory claims must be accurate and current. AI flags any uncertainty for founder review and *strongly* recommends founder verification before approval.

## 6. Family D — Audience pain points

These archetypes meet the audience where they're hurting. Problem-aware content.

### 6.1 Symptom Diagnosis

**What it is.** Help the audience identify whether they have a specific problem they might not have named yet.

**Source of grounding.** Customer's stated audience pain points.

**Example topic shapes.**
- "If you're experiencing [symptom], you might have [problem]."
- "[N] signs your [thing] isn't working."
- "Here's how to know if [problem] is your problem."
- "The symptoms of [issue] most people miss."

**Framework affinity.** PAS, Educational Breakdown, Numbered List.

**Niche fit.** Strong in fintech (financial symptoms), beauty (skin symptoms with health-claim care), education (knowledge gaps), health (with claim restraint). Light in real estate, fashion, food.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Symptoms must be observably real, not invented.

### 6.2 Cost of Inaction

**What it is.** Make the cost of not addressing a problem visible.

**Source of grounding.** Customer's stated value proposition (often the inverse of "what it costs to do nothing").

**Example topic shapes.**
- "What [problem] costs you every [timeframe]."
- "The hidden price of [doing nothing about X]."
- "Every month you delay [action], you lose [resource]."
- "[Problem] doesn't go away. It compounds."

**Framework affinity.** PAS, PAIPS, DR Formula.

**Niche fit.** Strong in fintech (cost of poor money management), education (cost of skill gaps), real estate (cost of bad decisions). Light elsewhere.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Numbers grounded in the customer's stated experience or industry data.

### 6.3 Hidden Trap

**What it is.** Surface a non-obvious problem the audience might be walking into.

**Source of grounding.** Customer's expertise on what newcomers miss.

**Example topic shapes.**
- "The [niche] trap nobody warns you about."
- "What seems fine but actually isn't."
- "If you do [common action], watch out for [consequence]."
- "The [thing] hiding in plain sight."

**Framework affinity.** Open Loop, Curiosity Gap, Industry Insider.

**Niche fit.** Strong in real estate (legal traps), fintech (fee traps), education (curriculum traps), beauty (ingredient traps). Light elsewhere.

**Format fit.** UGC, carousel.

**No-fabrication notes.** The trap must be a real, defensible risk.

### 6.4 Question Loop

**What it is.** Pose a question the audience has been asking themselves and answer it.

**Source of grounding.** Customer's stated audience FAQs, or common-sense questions in the niche.

**Example topic shapes.**
- "Why does [common phenomenon] happen?"
- "Can you actually [aspirational thing]?"
- "What [audience] really want to know about [topic]."
- "The question I [or 'the answer to the question'] keep getting."

**Framework affinity.** Open Loop, Educational Breakdown, Curiosity Gap.

**Niche fit.** Universal.

**Format fit.** UGC, carousel.

**No-fabrication notes.** "I get this question" must be re-cast as "people ask" or "the question is" unless customer explicitly stated they get the question.

### 6.5 Decision Framework

**What it is.** A structured way to make a decision in the customer's domain. Hand the audience a tool.

**Source of grounding.** Customer's expertise on decision-making in the category.

**Example topic shapes.**
- "How to decide between [A] and [B]."
- "The [N]-step framework for [decision]."
- "If you're stuck on [decision], use this."
- "The decision matrix I [or 'professionals'] use for [topic]."

**Framework affinity.** Educational Breakdown, Numbered List, Comparison.

**Niche fit.** Strong in fintech (financial decisions), education (program selection), real estate (buy vs rent). Light elsewhere.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Framework drawn from customer's actual approach. Don't generate generic decision frameworks not tied to customer's view.

## 7. Family E — Aspirational direction

These archetypes show the audience the outcome — what success looks like in the customer's world.

### 7.1 Outcome Showcase

**What it is.** Show the result the customer's offering produces. Concrete outcome, not vague promise.

**Source of grounding.** Customer's stated outcome claims (with care — flag any unsubstantiated transformation framings).

**Example topic shapes.**
- "What [outcome] looks like in 30 days."
- "From [start state] to [end state]: the visual."
- "[Outcome] isn't theoretical. Here it is."
- "The result you can expect from [approach]."

**Framework affinity.** AIDA, Value Equation, Behind-the-Work.

**Niche fit.** Strong in fashion (finished pieces), food (finished dishes), beauty (skin outcomes with care), real estate (transformed properties). Light in fintech (with substantiation care), education (with outcome-claim care).

**Format fit.** T2V (visualised outcome), carousel.

**No-fabrication notes.** Outcomes must be real and substantiated. Flag any hyperbolic transformation claims.

### 7.2 Day-in-the-Output

**What it is.** A typical day for someone using the customer's offering. Not a customer testimonial — a generalised use-case scenario.

**Source of grounding.** Customer's stated use cases.

**Example topic shapes.**
- "A typical [audience]'s day with [offering]."
- "[Time of day]: how [offering] fits in."
- "The [audience]'s daily routine, with [offering]."
- "What [audience] do differently after [adoption]."

**Framework affinity.** Behind-the-Work, AIDA, Process Demystification.

**Niche fit.** Strong in fintech (apps in daily routine), beauty (skincare routine), fashion (capsule outfit), food (meal planning), education (study routine). Light in real estate.

**Format fit.** T2V (visualised day), UGC, carousel.

**No-fabrication notes.** Frame as generalised "what a typical X looks like" — not "Sarah's day". The avatar voice can plausibly say "if you're a busy professional, your day might look like this".

### 7.3 Quality Moment

**What it is.** A specific moment of quality in the customer's product/service. The first cut into the cake. The fitting that lands. The line-of-code that finally works. Hyper-specific, sensory, brief.

**Source of grounding.** Customer's product/service reality.

**Example topic shapes.**
- "[Specific quality moment] in [N] seconds."
- "This is what [quality] feels like."
- "The moment [outcome] becomes real."
- "[Sensory detail] — that's the difference."

**Framework affinity.** Pattern Interrupt, Behind-the-Work, AIDA.

**Niche fit.** Strong in food (sensory), beauty (sensory), fashion (texture). Light in fintech, real estate, education.

**Format fit.** T2V (sensory close-ups), UGC.

**No-fabrication notes.** Moments drawn from real product/service. T2V can render aspirational moments as long as they represent what the customer actually delivers.

### 7.4 Use-Case Spotlight

**What it is.** Highlight one specific use case for the customer's offering. Not all use cases — one, in depth.

**Source of grounding.** Customer's stated use cases.

**Example topic shapes.**
- "[Offering] for [specific use case]."
- "If you're [specific audience segment], here's why this matters."
- "The [niche] use case nobody thinks about: [use case]."
- "[Use case]: why [offering] fits."

**Framework affinity.** AIDA, DR Formula, Educational Breakdown.

**Niche fit.** Universal.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Use case must be one the customer actually serves. Don't speculate.

### 7.5 Adjacent Possibility

**What it is.** Open up the audience's thinking to a use of the offering they hadn't considered. Demonstrates the offering's range without overpromising.

**Source of grounding.** Customer's offering capabilities.

**Example topic shapes.**
- "[Surprising use case] you can do with [offering]."
- "Most people use [offering] for [common use]. What about [adjacent use]?"
- "[Offering] isn't just for [common use]. It also handles [adjacent use]."
- "Beyond the obvious: [N] ways to use [offering]."

**Framework affinity.** Frame Re-Set, AIDA, Anti-Trend.

**Niche fit.** Strong in fintech (multi-use products), education (multi-context skills), beauty (multi-purpose products), fashion (versatile pieces). Light in real estate, food.

**Format fit.** UGC, carousel.

**No-fabrication notes.** Adjacent uses must be real capabilities of the offering. Don't speculate beyond what's plausible.

## 8. Archetype × niche affinity matrix

Quick reference for which archetypes fit which niches naturally. Lower-affinity selections still happen via the deterministic seed; this is where they'll feel most native.

| Archetype | Beauty | Real Est | Fashion | Fintech | Health | Food | Education |
|---|---|---|---|---|---|---|---|
| Pricing Breakdown | High | High | High | Low | Med | High | High |
| Service Anatomy | Med | High | Med | High | Med | Med | High |
| Product Tour | High | Low | High | Med | Med | High | High |
| Tier Comparison | Low | Med | Low | High | Low | Low | High |
| What You Get | High | Med | High | High | Med | High | High |
| Insider Checklist | Med | High | Low | High | Med | Low | High |
| Common Mistake | High | High | Med | High | High | Med | High |
| Pre-Decision Audit | Med | High | Low | High | Med | Low | High |
| Process Tour | High | Med | High | Low | Med | High | Med |
| Quality Tells | High | High | High | Low | Med | High | Low |
| Decoded Jargon | High | High | Low | High | Med | Low | High |
| Industry Pattern | Low | High | Med | High | Med | Low | High |
| Category Myth | High | High | Med | High | High | Med | High |
| Market Reality | Low | High | Med | High | Low | Low | High |
| Regulatory Snapshot | Med | High | Low | High | High | Low | High |
| Symptom Diagnosis | High | Low | Low | High | High | Low | Med |
| Cost of Inaction | Low | High | Low | High | Med | Low | High |
| Hidden Trap | Med | High | Low | High | Med | Med | High |
| Question Loop | High | High | High | High | High | High | High |
| Decision Framework | Low | High | Low | High | Med | Low | High |
| Outcome Showcase | High | Med | High | Med | Med | High | Med |
| Day-in-the-Output | High | Low | High | High | Med | High | High |
| Quality Moment | High | Low | High | Low | Low | High | Low |
| Use-Case Spotlight | High | Med | High | High | High | High | High |
| Adjacent Possibility | High | Low | High | High | Med | Low | High |

## 9. Selection logic

The deterministic seeding system (full spec in `docs/specs/non-duplication-system.md`) selects archetypes per customer using the same mechanism as frameworks:

```
seed = sha256(customer_id + niche + order_index + submission_week)

available_archetypes = ALL_25 - history_of_used_for_this_customer
selected = deterministic_pick(available_archetypes, count=N_for_tier, seed=seed)
```

Per-tier counts:

- Starter: 3 archetypes for 7 videos (some archetypes drive multiple videos in different framework wrappers).
- Standard: 5 archetypes for 14 videos.
- Calendar: 8 archetypes for 30 videos.

Combined with framework selection: tier × tier = N×M unique combinations possible per customer per order.

## 10. The framework × archetype combination grid

Not every framework × archetype combination produces useful content. The AI's selection logic prefers combinations that score high on both axes. Combinations that don't pair naturally are deprioritized.

A few examples of strong pairings:

- **Cost Reveal × Pricing Breakdown** — natural fit. Cost Reveal framework wrapping Pricing Breakdown archetype produces specific, transparent pricing content.
- **Myth-Buster × Category Myth** — natural fit. Same energy.
- **Educational Breakdown × Decoded Jargon** — natural fit.
- **Behind-the-Work × Process Tour** — natural fit. Show the work.
- **Specificity Stack × Market Reality** — natural fit. Numbers wrapping numbers.

Examples of weaker pairings (not invalid, just less natural):

- **PAIPS × Quality Moment** — PAIPS wants conflict, Quality Moment wants serenity. Awkward.
- **Anti-Trend × What You Get** — Anti-Trend punches at conventions, What You Get is plain inventory. Discordant.
- **Cost of Inaction × Adjacent Possibility** — opposite emotional poles.

The AI's selection logic surfaces high-affinity pairings first and only descends to lower-affinity pairings when the deterministic seed forces it. The combination logic is in `docs/specs/non-duplication-system.md`.

## 11. Adding new archetypes

When a new archetype proves itself in production:

1. New archetype gets a section in this doc following the same template.
2. Niche affinity row added in section 8.
3. `non-duplication-system.md` constant `ARCHETYPES_TOTAL` increments.
4. ADR recorded if it changes the family taxonomy.

Like frameworks, don't add archetypes speculatively. Reality should drive growth.

## 12. Cross-references

- `docs/specs/script-frameworks.md` — the structural patterns these archetypes wrap into.
- `docs/specs/research-methodology.md` — how the AI mines material to find which archetypes are grounded.
- `docs/specs/non-duplication-system.md` — the deterministic selection mechanism.
- `docs/specs/content-types-allowed.md` — the no-fabrication rule that constrains every archetype.
- `docs/specs/ai-brief-analysis.md` — where these archetypes integrate into the prompt.
