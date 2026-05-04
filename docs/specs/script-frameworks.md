# Script frameworks

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent.
**Last updated:** 2026-05-04.

This document is the canonical library of copywriting and scriptwriting frameworks that the AI brief-analysis system selects from when generating angles for a customer's calendar. It pairs with `docs/specs/angle-archetypes.md` (the *what* — what topics) and `docs/specs/research-methodology.md` (the *how* — how the AI mines material).

Frameworks are referenced by **name-of-framework**, never by name-of-marketer. Per ADR 0012, we don't anchor outputs to specific individuals — we anchor to the structural patterns those individuals are known for. This keeps the doc evergreen and avoids style-mimicry IP exposure.

## 1. How frameworks are used

When the AI brief-analysis runs for a customer, the deterministic seeding system (see `docs/specs/non-duplication-system.md`) selects N frameworks from this library based on tier:

- **Starter (7 videos):** 3 frameworks selected, applied across the 7-video calendar.
- **Standard (14 videos):** 5 frameworks selected, applied across the 14-video calendar.
- **Calendar (30 videos):** 8 frameworks selected, applied across the 30-video calendar.

Each framework drives the *structural shape* of a script — its opening, its arc, its payoff. The angle-archetype determines the topic. The brand-voice block determines the language register. The visual-style block determines how it looks. Together, these four layers compose a script that's structurally sound (framework), topically grounded (archetype), linguistically authentic (brand-voice), and visually coherent (style).

## 2. The framework taxonomy

Twenty-five frameworks, grouped into five families:

| Family | Frameworks |
|---|---|
| Direct response (conversion-driving) | DR Formula, PAS, AIDA, PAIPS, Value Equation |
| Hook-stack (attention engineering) | 3-Layer Hook Stack, Pattern Interrupt, Open Loop, Curiosity Gap, Specificity Stack |
| Educational (teach-and-prove) | Quick-Win, Educational Breakdown, Process Demystification, Numbered List, Checklist Reveal |
| Persuasive (perspective-shift) | Myth-Buster, Comparison, Anti-Trend, Industry Insider, Cost Reveal |
| Narrative (no-fabrication-safe) | Behind-the-Work, Dataset Reveal, Decoded Jargon, Steel-Man, Frame Re-Set |

Each framework below documents:

- **What it is** — the structural pattern in plain language.
- **When it's the right pick** — what kind of business / angle / awareness level it suits.
- **Structure** — the actual sequence the AI uses to compose a script.
- **Hook patterns** — 3-5 opening lines the AI can pattern-match against.
- **CTA fit** — what kind of call-to-action this framework naturally lands on.
- **Length fit** — best at 30s, 60s, or both.
- **Niche fit** — which of the 7 niches this works best in.
- **No-fabrication notes** — what this framework MUST NOT generate (specific to our content rule, see `docs/specs/content-types-allowed.md`).

## 3. Family A — Direct response

These are the workhorses of conversion-driving content. Heavy on outcome promise and CTA clarity. Use sparingly across a calendar — too much DR feels salesy.

### 3.1 DR Formula

**What it is.** The classic Direct Response structure: hook → problem → solution → value proposition → social proof signal → call to action. Originated in long-form sales letters, adapted for short-form video.

**When it's the right pick.** Awareness level "problem-aware" or "solution-aware". The customer's audience knows they have a pain point but hasn't decided how to solve it. Works best when the customer's offering is the *answer* to a specific known problem.

**Structure (30s):**
- 0-3s **Hook**: name the problem in one line.
- 3-8s **Agitation**: the cost of leaving the problem unsolved.
- 8-18s **Solution**: introduce the customer's offering as the bridge.
- 18-24s **Value proposition**: what specifically they get.
- 24-27s **Social proof signal**: a number, a category, an outcome (no fabricated testimonials).
- 27-30s **CTA**: one clear next step.

**Hook patterns.**
- "Most [audience] never realize they're losing [resource] every [timeframe]."
- "If you've ever [common frustration], stop doing this."
- "There's a simple reason your [process] keeps failing."
- "The single biggest mistake [audience] make with [topic] is [specific thing]."
- "[Number] of [audience] are doing [thing] wrong — and it's costing them [outcome]."

**CTA fit.** Strong CTAs. "Book a call." "Visit the site." "DM us [keyword]."

**Length fit.** 30s and 60s.

**Niche fit.** Strong in fintech, real estate, education. Acceptable in beauty, fashion, food, health (but use sparingly — these niches reward soft sell).

**No-fabrication notes.** Social proof signal must be a specific, verifiable category statement ("over 100 SMEs we've audited", "in 4 years of this work") — never a fake customer name, never a made-up testimonial, never an invented outcome.

### 3.2 PAS (Problem–Agitation–Solution)

**What it is.** Lighter cousin of DR. Strip out the value-prop and social-proof slots, keep the emotional arc. State the problem, agitate it, present the solution.

**When it's the right pick.** When the audience is problem-aware but the problem feels invisible to them — they've normalized it. Agitation is what makes them notice they have a problem worth solving.

**Structure (30s):**
- 0-4s **Problem**: the pain point, framed concretely.
- 4-15s **Agitation**: what it actually costs (time, money, energy, opportunity).
- 15-27s **Solution**: how the customer's offering removes it.
- 27-30s **CTA**: a soft action (more often "save this" than "buy now").

**Hook patterns.**
- "Why does [common task] always feel impossible?"
- "If [bad thing] keeps happening to you, you're not the problem — [system thing] is."
- "Three years ago I'd have told you [thing] was unavoidable. I was wrong."
- "Stop blaming yourself for [pattern] — here's what's actually going on."

**CTA fit.** Soft. "Save this." "Send to a friend who needs it."

**Length fit.** 30s primarily. Stretches to 60s but loses tension.

**Niche fit.** Strong in fintech, health (with restraint on claims), education. Light fit elsewhere.

**No-fabrication notes.** "Three years ago I'd have told you..." style hooks must be re-cast as observational ("Most people would tell you..." or "The conventional wisdom is...") to avoid implying personal history we haven't collected.

### 3.3 AIDA (Attention–Interest–Desire–Action)

**What it is.** The advertising classic. Get attention, build interest, escalate to desire, close with action. More gradient than DR — the audience is gently led rather than confronted.

**When it's the right pick.** When the audience is "unaware" or "problem-aware" and you need to build the case from zero. AIDA is patient; DR is urgent.

**Structure (30s):**
- 0-3s **Attention**: a strong visual or statement that earns the watch.
- 3-12s **Interest**: a curiosity-building elaboration.
- 12-22s **Desire**: paint the outcome the audience wants.
- 22-27s **Action**: what to do next.
- 27-30s **Reinforce**: one closing line that locks it in.

**Hook patterns.**
- "Look at this." (followed by a strong visual)
- "Here's something most people don't know about [topic]."
- "What if [aspirational state] was actually within reach?"
- "The thing about [topic] is — it's simpler than you've been told."

**CTA fit.** Medium. "Learn more." "Tap the link."

**Length fit.** 30s and 60s.

**Niche fit.** Strong in fashion, food, beauty. Acceptable elsewhere.

**No-fabrication notes.** "Desire" stage must paint outcomes the customer's offering can plausibly deliver — never invented transformation stories.

### 3.4 PAIPS (Problem–Agitation–Invalidation–Promise–Solution)

**What it is.** Aggressive direct-response variant. After agitating the problem, *invalidate* the audience's existing solutions before promising a better one. Heavy lift; high impact.

**When it's the right pick.** When the audience is "solution-aware" — they're already trying to solve the problem with something else, and the customer's offering is meaningfully better. The invalidation step is what unsticks them from inferior options.

**Structure (30s):**
- 0-3s **Problem**: name it.
- 3-8s **Agitation**: cost.
- 8-15s **Invalidation**: the common solution and why it falls short.
- 15-22s **Promise**: the better outcome.
- 22-27s **Solution**: the offering.
- 27-30s **CTA**.

**Hook patterns.**
- "Everyone tells you to [common advice] — and it's why you're stuck."
- "The standard approach to [problem] is wrong."
- "If you're still doing [thing X] in 2026, you're solving the wrong problem."
- "Most [niche] people will tell you [conventional wisdom]. They're missing [insight]."

**CTA fit.** Strong.

**Length fit.** 60s primarily — needs the room.

**Niche fit.** Strong in fintech, education, real estate. Use carefully in beauty/health where invalidating competitors can read as petty.

**No-fabrication notes.** Invalidation targets *categories of approach* not specific named competitors. We don't make ads that punch down at specific other businesses.

### 3.5 Value Equation

**What it is.** Frame the offering as the result of a math equation: dream outcome × perceived likelihood ÷ time delay × effort. Make the numerator big and the denominator small. Originally a sales-call framework, adapted for video.

**When it's the right pick.** When the customer's offering's value isn't obvious from the price tag alone — when context is needed to justify the cost. Strong fit for premium pricing, courses, services with long sales cycles.

**Structure (30s):**
- 0-4s **Hook**: the dream outcome named explicitly.
- 4-10s **Perceived likelihood**: why the customer's approach actually delivers (specifics, numbers, methodology).
- 10-18s **Time-and-effort compression**: how the offering removes typical timeline/effort barriers.
- 18-26s **Recap**: restate the equation.
- 26-30s **CTA**.

**Hook patterns.**
- "[Outcome] in [shorter timeframe than expected]."
- "What if [aspirational thing] took [shorter time], not [longer time]?"
- "The reason [outcome] feels out of reach is the timeline — not the work."
- "[Outcome] without [common downside]."

**CTA fit.** Medium-to-strong.

**Length fit.** 60s primarily.

**Niche fit.** Strong in education, fintech, real estate. Light fit in beauty/fashion (where value is more emotional than computational).

**No-fabrication notes.** "Perceived likelihood" must point to verifiable methodology or category-level evidence — never invented success stories.

## 4. Family B — Hook-stack

These are attention-engineering frameworks. Less about persuasion arc, more about *winning the first 3 seconds*. Layer them under any other framework, or use them as standalone for awareness-building content.

### 4.1 3-Layer Hook Stack

**What it is.** Three independent hook signals stacked in the first 3 seconds: visual hook (something visually arresting), text hook (on-screen text that earns the read), audio hook (an opening line that earns the listen). Audience can only ignore the video if all three fail simultaneously.

**When it's the right pick.** Default for any content where retention is the bottleneck. Universal applicability.

**Structure.** This is a *layer*, not a full framework. Apply it on top of DR/PAS/AIDA/etc.

- **Visual hook**: an unexpected or specific image (close-up, contrast, motion, scale).
- **Text hook**: a 5-8 word headline overlaid on the visual.
- **Audio hook**: the spoken opening line.

All three independent. All three on-message.

**Hook patterns.** N/A — this is structural.

**CTA fit.** Inherits from underlying framework.

**Length fit.** 30s and 60s.

**Niche fit.** Universal.

**No-fabrication notes.** Visual hook must be achievable from customer-provided photos OR generic stock-equivalent T2V — never depict a specific scenario we haven't been told happened.

### 4.2 Pattern Interrupt

**What it is.** Open with something that breaks the audience's default scrolling pattern. Counter-intuitive statement, visual incongruity, sudden shift in tempo or register.

**When it's the right pick.** When the niche is saturated and the customer's content needs to *not look like the rest of the niche's content*. Beauty saturated with smiling selfies → open with a wide shot, no face, ambient sound. Real estate saturated with drone glides → open with a static interior shot, no music.

**Structure (30s):**
- 0-2s **Pattern interrupt**: the unusual opening.
- 2-8s **Resolution**: contextualize what the audience just saw.
- 8-25s **Body**: the actual content.
- 25-30s **Close**: tied back to the opening.

**Hook patterns.**
- "[Unexpected statement that contradicts the niche's default tone]."
- (No words — strong visual or sound that demands explanation.)
- "Most [niche] videos start with [X]. Here's why I don't."
- "[Outcome stated upfront, before the setup]."

**CTA fit.** Medium.

**Length fit.** 30s primarily.

**Niche fit.** Strong in fashion, beauty, real estate, food. Light in fintech/education (those niches expect predictable openings).

**No-fabrication notes.** The "resolution" stage must contextualize honestly — no false setups that imply a story we don't have.

### 4.3 Open Loop

**What it is.** Pose a question or set up a tension in the opening, but don't resolve it until the end. The unfinished loop creates pull through the middle.

**When it's the right pick.** When the content has a single payoff that takes 20+ seconds to set up. Good for educational content with a non-obvious answer. Bad for content where the audience figures out the answer in the first 5 seconds.

**Structure (30s):**
- 0-4s **Loop**: the question or tension.
- 4-22s **Build**: information that escalates the tension without resolving it.
- 22-28s **Payoff**: resolution.
- 28-30s **CTA tie-back**.

**Hook patterns.**
- "There's one thing about [topic] that nobody talks about."
- "Why does [counterintuitive thing] happen?"
- "I'll tell you the answer in 25 seconds — but first, [setup]."
- "Most people [common belief] — but here's what's actually going on."

**CTA fit.** Medium. "Save this for later."

**Length fit.** 60s primarily — needs room.

**Niche fit.** Strong in fintech, education, real estate. Acceptable in food (recipe reveals).

**No-fabrication notes.** "I'll tell you" must be re-cast as "the answer is" to avoid implying personal narration we haven't sourced.

### 4.4 Curiosity Gap

**What it is.** Reveal just enough to make the audience NEED to know the rest. Distinct from Open Loop — Curiosity Gap doesn't pose a question, it teases an answer.

**When it's the right pick.** When the content has a specific, surprising fact or piece of insider knowledge.

**Structure (30s):**
- 0-3s **Tease**: hint at what's coming without giving it.
- 3-22s **Build**: contextualize, but slowly reveal.
- 22-28s **Reveal**.
- 28-30s **CTA**.

**Hook patterns.**
- "There are 3 things [insider category] do that [outsiders] never figure out."
- "[Surprising number] of [audience] are losing [resource] this way."
- "The trick to [outcome] isn't [common assumption] — it's [tease]."
- "Watch this until the end."

**CTA fit.** Soft-to-medium.

**Length fit.** 30s and 60s.

**Niche fit.** Universal.

**No-fabrication notes.** The "reveal" must be a real piece of information drawn from the customer's domain (their pricing, their methodology, their industry data) — never a fabricated insight.

### 4.5 Specificity Stack

**What it is.** Open with an unusually specific number or detail. Specificity signals authority because vague claims are easy to make and specific ones aren't.

**When it's the right pick.** When the customer has access to specific numbers — pricing breakdowns, time durations, percentage outcomes, count of items.

**Structure (30s):**
- 0-3s **Specific opener**: a number, a duration, a quantity.
- 3-8s **Context**: what this number means.
- 8-26s **Implications and details**.
- 26-30s **CTA**.

**Hook patterns.**
- "₦47,300. That's the average [thing] in [context]."
- "It takes 14 hours to hand-finish one of these."
- "There are exactly 6 things to check before you sign a [document]."
- "After 220 inspections, I keep seeing the same 3 mistakes."

**CTA fit.** Medium.

**Length fit.** 30s and 60s.

**Niche fit.** Strong everywhere except niches where specificity feels cold (occasionally beauty, fashion).

**No-fabrication notes.** Numbers must be either (a) drawn from the customer's stated business reality, (b) drawn from industry-level public data with attribution, or (c) flagged in the AI brief output as needing customer substantiation. Never invented.

## 5. Family C — Educational

These build authority by teaching. They convert by proving competence rather than asking for the sale. Use these heavily — most of a customer's calendar should be educational.

### 5.1 Quick-Win

**What it is.** A single small, immediately-actionable tip. The audience can apply it in under 60 seconds of effort. The implicit promise: if this small thing works, imagine what the full offering does.

**When it's the right pick.** Default educational format. Universal.

**Structure (30s):**
- 0-3s **Promise**: name the win.
- 3-25s **The tip**: how to do it.
- 25-30s **CTA**: usually a soft "save this" or "follow for more."

**Hook patterns.**
- "Here's a [topic] tip you can use in the next 60 seconds."
- "If you do this one thing, [outcome]."
- "The fastest way to [outcome] is [specific small action]."
- "Steal this: [specific tactic]."

**CTA fit.** Soft.

**Length fit.** 30s primarily.

**Niche fit.** Universal.

**No-fabrication notes.** The tip must be genuinely useful and within the customer's domain expertise — not generic advice repackaged.

### 5.2 Educational Breakdown

**What it is.** Deconstruct a concept, process, or thing the audience finds confusing. Make the abstract concrete.

**When it's the right pick.** When the niche has technical jargon or opaque processes that customers struggle with. Strong fit for fintech (financial concepts), real estate (legal documents), education (curriculum structure), beauty (ingredient science).

**Structure (60s):**
- 0-5s **Hook**: name the thing being explained.
- 5-20s **Why it's confusing**.
- 20-50s **The breakdown**: 3-5 key parts.
- 50-58s **Recap**: the simple version.
- 58-60s **CTA**.

**Hook patterns.**
- "[Term/document] explained in 60 seconds."
- "If you've ever wondered what [thing] actually means — here it is."
- "[Concept] is simpler than it looks. Here's the version nobody tells you."
- "Three things [niche] people assume you know — but you probably don't."

**CTA fit.** Soft.

**Length fit.** 60s primarily.

**Niche fit.** Strong in fintech, real estate, education, health. Acceptable elsewhere.

**No-fabrication notes.** Explanation must be factually accurate. AI flags any uncertainty for founder review before approving the script.

### 5.3 Process Demystification

**What it is.** Cousin of Educational Breakdown, but specifically about *what happens behind a service*. Show the audience what the customer does in a typical engagement, deliverable by deliverable.

**When it's the right pick.** Service businesses — real estate, education, fintech advisory, beauty consulting. Anyone selling a process more than a product.

**Structure (60s):**
- 0-5s **Hook**: "Here's what actually happens when you work with [business type]."
- 5-50s **The process steps**: 3-6 stages, each named and briefly described.
- 50-58s **The outcome**.
- 58-60s **CTA**.

**Hook patterns.**
- "Here's what actually happens when you [start a process]."
- "Step by step, this is how [process] works."
- "Most people don't know what [service category] actually involves. Here it is."
- "Behind every [outcome] is this exact 6-step process."

**CTA fit.** Medium.

**Length fit.** 60s primarily.

**Niche fit.** Strong in real estate, education, fintech, food (catering process). Acceptable elsewhere.

**No-fabrication notes.** Process steps must be drawn from customer-stated reality. AI surfaces uncertain steps for founder confirmation.

### 5.4 Numbered List

**What it is.** "5 things to check before X." "3 mistakes to avoid in Y." Structurally simplest framework — the number is the entire promise.

**When it's the right pick.** Default for educational content where the lesson decomposes naturally into discrete items.

**Structure (30s):**
- 0-3s **Hook**: the number and the topic.
- 3-25s **The items**: roughly 4-5s each.
- 25-30s **CTA**.

**Hook patterns.**
- "[Number] things every [audience] should know about [topic]."
- "Avoid these [number] [mistakes/red flags/traps]."
- "[Number] questions to ask before you [decision]."
- "[Number] reasons your [process] isn't working."

**CTA fit.** Soft. "Save this list."

**Length fit.** 30s and 60s.

**Niche fit.** Universal.

**No-fabrication notes.** Each item must be a real piece of advice. No padding with fluff items just to hit the number.

### 5.5 Checklist Reveal

**What it is.** A specific checklist used in a specific context, presented as a usable artifact. The audience saves the video to refer back to.

**When it's the right pick.** When the customer's expertise produces actual usable lists — pre-purchase checks, document audits, ingredient screens, technical specs.

**Structure (30s):**
- 0-3s **Hook**: name the checklist.
- 3-25s **The items**: presented sequentially with on-screen text overlays.
- 25-30s **CTA**: "save this".

**Hook patterns.**
- "The [N]-item checklist I use before [action]."
- "Steal this checklist: [context]."
- "Print this and bring it to your next [scenario]."
- "If this list isn't on your phone, you're missing [outcome]."

**CTA fit.** Soft. "Save this."

**Length fit.** 30s primarily.

**Niche fit.** Strong in real estate, fintech, education. Acceptable in beauty, food, health.

**No-fabrication notes.** Checklist items drawn from customer expertise; no invented criteria.

## 6. Family D — Persuasive

These shift the audience's perspective. Use moderately — too much can feel preachy.

### 6.1 Myth-Buster

**What it is.** Identify a widely-held belief in the niche, then dismantle it with specifics.

**When it's the right pick.** When the customer's offering benefits from challenging conventional wisdom. Strong in fintech (myths about saving), health (wellness misinformation), real estate (buyer myths).

**Structure (30s):**
- 0-3s **The myth**: stated cleanly.
- 3-8s **Why people believe it**.
- 8-22s **Why it's wrong**.
- 22-28s **The actual truth**.
- 28-30s **CTA**.

**Hook patterns.**
- "Everyone says [common belief]. They're wrong."
- "The [niche] myth that's costing you [resource]."
- "Stop believing [common claim]. Here's what's actually true."
- "[Common practice] doesn't work. Here's what does."

**CTA fit.** Medium.

**Length fit.** 30s and 60s.

**Niche fit.** Strong in fintech, health, real estate, education. Use carefully in beauty/fashion/food (myth-busting in those can read as snobbery).

**No-fabrication notes.** The "actual truth" must be substantiated. Flag anything uncertain.

### 6.2 Comparison

**What it is.** Compare two approaches/products/options side by side, surface the trade-offs, recommend one.

**When it's the right pick.** When the audience is "solution-aware" and weighing options. Strong in fintech (product comparisons), real estate (neighbourhood comparisons), education (program comparisons).

**Structure (60s):**
- 0-5s **Hook**: name what's being compared.
- 5-25s **Option A**: pros and cons.
- 25-50s **Option B**: pros and cons.
- 50-58s **The recommendation and why**.
- 58-60s **CTA**.

**Hook patterns.**
- "[A] vs [B] — which is right for you?"
- "I get this question every week: should I [A] or [B]?"
- "The honest comparison nobody else will give you."
- "When [A] beats [B], and when [B] beats [A]."

**CTA fit.** Medium.

**Length fit.** 60s primarily.

**Niche fit.** Strong in fintech, real estate, education. Acceptable elsewhere.

**No-fabrication notes.** Comparisons stay at the *category* level — "Lekki vs Ikoyi" is fine, "[Specific Competitor X] vs [Specific Competitor Y]" is not.

### 6.3 Anti-Trend

**What it is.** Take a popular niche trend and argue against it. Stake a contrarian position with reasoning.

**When it's the right pick.** When the niche has visible groupthink and the customer has a defensible counter-position. High-risk, high-reward — works brilliantly when right, falls flat when contrarian-for-its-own-sake.

**Structure (30s):**
- 0-3s **The trend**: name it.
- 3-10s **Why everyone's doing it**.
- 10-22s **Why it's actually a problem**.
- 22-28s **What to do instead**.
- 28-30s **CTA**.

**Hook patterns.**
- "Why I'm not doing [trending thing] in [niche]."
- "[Trend] isn't the move. Here's what is."
- "Everyone's chasing [trend]. They'll regret it."
- "Stop doing [popular practice]. It's already losing."

**CTA fit.** Medium.

**Length fit.** 30s primarily.

**Niche fit.** Strong in fashion, fintech, education. Use carefully in health/food (contrarian health takes can be dangerous).

**No-fabrication notes.** The contrarian position must be *defensible* — flag anything that's contrarian without backing.

### 6.4 Industry Insider

**What it is.** Position the audience as someone receiving privileged insider information. The implicit framing: "you're getting the version professionals know but don't say publicly."

**When it's the right pick.** When the niche has a clear professional/amateur divide and the customer's expertise is on the professional side.

**Structure (30s):**
- 0-3s **Hook**: signal that this is insider knowledge.
- 3-25s **The insight**: what professionals know but rarely share.
- 25-30s **CTA**.

**Hook patterns.**
- "[Insider category] don't talk about this. I will."
- "What every [professional] knows about [topic] that they don't tell clients."
- "If I were [your situation], I'd ask my [professional] this."
- "The secret most [niche] professionals won't admit."

**CTA fit.** Medium.

**Length fit.** 30s and 60s.

**Niche fit.** Strong in real estate, fintech, education, health. Acceptable in beauty/fashion (insider styling, sourcing).

**No-fabrication notes.** "What professionals know" must be drawn from the customer's actual expertise. No invented insider claims.

### 6.5 Cost Reveal

**What it is.** Break down what something actually costs — to make, to deliver, to operate. Honest pricing transparency framed as a respectful gesture toward the audience.

**When it's the right pick.** When the customer's pricing benefits from explanation — premium prices, custom services, anything where the audience might suspect they're being overcharged.

**Structure (30s):**
- 0-3s **Hook**: the price.
- 3-22s **The breakdown**: 3-5 cost components named explicitly.
- 22-27s **The value statement**.
- 27-30s **CTA**.

**Hook patterns.**
- "[Price]. Here's where every naira goes."
- "Why [product/service] costs [price] — the honest breakdown."
- "Most people think [product] is overpriced. Here's the math."
- "[Specific cost component] alone is [amount]. That's before [other components]."

**CTA fit.** Medium.

**Length fit.** 30s and 60s.

**Niche fit.** Strong in fashion, food, beauty (custom/premium products), real estate (service fees). Acceptable in fintech/education.

**No-fabrication notes.** Cost components must be real and verifiable. AI flags any uncertain numbers for founder review.

## 7. Family E — Narrative (no-fabrication-safe)

These are storytelling frameworks adapted for our no-fabrication rule. They tell stories *about the work*, *about the data*, *about the industry* — never about a specific person whose biography we don't have.

### 7.1 Behind-the-Work

**What it is.** Show the work being done. Not the founder's story; the work itself. Hands cutting fabric. Pots simmering. Documents being reviewed. Code being written.

**When it's the right pick.** When the customer's product/service has visually compelling craft. Strong in food, fashion, beauty, real estate, education.

**Structure (30s):**
- 0-3s **Visual hook**: the work in motion.
- 3-25s **The process**: shown, not narrated. Captions explain what's happening.
- 25-30s **CTA**.

**Hook patterns.** Visual-first. Spoken hook (if any) is a single line:
- "Behind every [outcome] is this."
- "What [a typical day/order/project] actually looks like."
- "[N] hours of [process] in [N] seconds."
- "This is the work."

**CTA fit.** Soft.

**Length fit.** 30s and 60s.

**Niche fit.** Strong in food, fashion, beauty (craft-side). Acceptable in real estate (inspections), education (curriculum building).

**No-fabrication notes.** This framework is the *substitute* for founder-origin narrative. Show the work; don't narrate the founder's life. Captions stay observational ("hand-finishing the seam" not "I learned this technique from my grandmother").

### 7.2 Dataset Reveal

**What it is.** Present an interesting dataset — survey results, operational stats, industry numbers. The data is the story.

**When it's the right pick.** When the customer has access to actual numbers from their work. Strong in real estate (inspection patterns), fintech (savings data), education (cohort outcomes), food (sourcing data).

**Structure (30s):**
- 0-3s **The headline number**.
- 3-25s **What it means**: 3-4 supporting numbers and context.
- 25-30s **The implication and CTA**.

**Hook patterns.**
- "After [N] [actions], here's the pattern."
- "Out of [N] [things], only [smaller N] [outcome]."
- "The data nobody publishes about [topic]."
- "[N]% of [audience] [behavior]. Here's what that means."

**CTA fit.** Medium.

**Length fit.** 30s and 60s.

**Niche fit.** Strong in real estate, fintech, education. Acceptable elsewhere.

**No-fabrication notes.** Data must be drawn from customer's stated experience or cited public industry data. Numbers without source = flag for founder review.

### 7.3 Decoded Jargon

**What it is.** Take a piece of niche jargon and translate it into plain language with examples. Cousin of Educational Breakdown but specifically focused on terminology.

**When it's the right pick.** Niches with high jargon density. Real estate (C of O, Governor's consent), fintech (BVN, NIN, PFA, NRS), beauty (active ingredients, formulation terms), education (accreditation jargon).

**Structure (30s):**
- 0-3s **Hook**: the jargon term.
- 3-22s **What it actually means**, with one concrete example.
- 22-30s **Why it matters to the audience + CTA**.

**Hook patterns.**
- "What '[term]' actually means."
- "Decoding '[jargon]' — the plain version."
- "If you've ever heard [term] and nodded — read this."
- "[Term] explained without the [niche]-speak."

**CTA fit.** Soft.

**Length fit.** 30s primarily.

**Niche fit.** Strong in fintech, real estate, beauty, education. Light fit elsewhere.

**No-fabrication notes.** Definitions must be accurate. AI flags uncertainty.

### 7.4 Steel-Man

**What it is.** Take an opposing position to the customer's offering, present it in its strongest form, then surgically respond. Demonstrates intellectual honesty.

**When it's the right pick.** When the customer has visible competition or a common counter-argument. High-trust framework — shows confidence by engaging with criticism rather than dismissing it.

**Structure (60s):**
- 0-5s **Hook**: name the counter-argument.
- 5-25s **Steel-man**: present it fairly and strongly.
- 25-50s **Response**: where it has merit, where it falls short.
- 50-58s **The synthesis or recommendation**.
- 58-60s **CTA**.

**Hook patterns.**
- "Here's the strongest argument against [customer's approach]."
- "Why some people think [customer's offering] is wrong — and where they have a point."
- "I'll give you the case against [thing] — then the case for."
- "Let's address the [common objection] head-on."

**CTA fit.** Medium.

**Length fit.** 60s primarily.

**Niche fit.** Strong in fintech, education, real estate. Acceptable in health.

**No-fabrication notes.** The steel-man must be fair, not a strawman dressed up. The response must engage with substance, not deflect.

### 7.5 Frame Re-Set

**What it is.** Take the audience's existing mental frame for a topic and replace it with a new one. Not myth-busting (which dismantles); frame re-set rebuilds.

**When it's the right pick.** When the audience's mental model is preventing them from buying. They're not wrong about facts — they're using the wrong category to think about the offering.

**Structure (30s):**
- 0-3s **Hook**: signal a frame shift coming.
- 3-12s **The old frame**: name how the audience usually thinks about the topic.
- 12-22s **The new frame**: a different way to think about it.
- 22-30s **What this changes + CTA**.

**Hook patterns.**
- "Stop thinking about [topic] as [old frame]. It's actually [new frame]."
- "The real question isn't [old question] — it's [new question]."
- "[Topic] isn't about [common assumption]. It's about [reframe]."
- "If you're treating [thing] like [category A], that's why it's hard."

**CTA fit.** Medium.

**Length fit.** 30s and 60s.

**Niche fit.** Strong in fintech, education, health. Acceptable in beauty (skincare routines as systems not products), real estate (housing as financial decision not lifestyle).

**No-fabrication notes.** The new frame must be defensible and useful — not contrarian for its own sake.

## 8. Framework selection logic

The deterministic seeding system (full spec in `docs/specs/non-duplication-system.md`) selects frameworks per customer using:

```
seed = sha256(
  customer_id + "::" +
  niche + "::" +
  order_index + "::" +
  submission_week
)

available_frameworks = ALL_25 - history_of_used_for_this_customer
selected = deterministic_pick(available_frameworks, count=N_for_tier, seed=seed)
```

When a returning customer's available pool gets thin (< 2× tier-N frameworks remaining), a warning fires (see non-duplication-system.md section 6).

The selected frameworks are written to `analysis_runs.framework_seed` as a JSON array. They're the system-prompt input for the script generator at production time.

## 9. Niche × framework affinity matrix

Quick reference for which frameworks tend to fit which niches. Not enforcement — the deterministic seed can still pick lower-affinity frameworks; this is just where they'll feel most natural.

| Framework | Beauty | Real Est | Fashion | Fintech | Health | Food | Education |
|---|---|---|---|---|---|---|---|
| DR Formula | Med | High | Med | High | Med | Med | High |
| PAS | Low | Med | Low | High | Med | Low | High |
| AIDA | High | Med | High | Low | Med | High | Med |
| PAIPS | Low | High | Low | High | Low | Low | High |
| Value Equation | Low | High | Low | High | Low | Low | High |
| 3-Layer Hook Stack | High | High | High | High | High | High | High |
| Pattern Interrupt | High | High | High | Low | Med | High | Low |
| Open Loop | Med | High | Med | High | Med | Med | High |
| Curiosity Gap | High | High | High | High | High | High | High |
| Specificity Stack | Med | High | Med | High | Med | High | High |
| Quick-Win | High | High | High | High | High | High | High |
| Educational Breakdown | High | High | Med | High | High | Med | High |
| Process Demystification | Med | High | Med | High | Med | High | High |
| Numbered List | High | High | High | High | High | High | High |
| Checklist Reveal | Med | High | Med | High | Med | Med | High |
| Myth-Buster | High | High | Med | High | High | Med | High |
| Comparison | Low | High | Med | High | Med | Low | High |
| Anti-Trend | Med | High | High | High | Med | Med | High |
| Industry Insider | Med | High | Med | High | High | High | High |
| Cost Reveal | High | High | High | Med | Med | High | High |
| Behind-the-Work | High | Med | High | Low | Med | High | Med |
| Dataset Reveal | Low | High | Low | High | Med | Med | High |
| Decoded Jargon | High | High | Low | High | Med | Low | High |
| Steel-Man | Low | Med | Low | High | Med | Low | High |
| Frame Re-Set | Med | High | Low | High | High | Low | High |

## 10. Adding new frameworks

When a new framework proves itself in production (e.g. founder repeatedly finds themselves wanting a structure not in this library), add it via the standard documentation update pattern:

1. New framework gets a section in this doc following the same template.
2. Affinity matrix row added in section 9.
3. `non-duplication-system.md` constant `FRAMEWORKS_TOTAL` increments.
4. ADR recorded if the new framework changes the family taxonomy.

Don't add frameworks speculatively. The bank should grow because reality demands it, not because we want symmetry.

## 11. Cross-references

- `docs/specs/angle-archetypes.md` — the topic library that pairs with these frameworks.
- `docs/specs/research-methodology.md` — how the AI mines customer material to find which frameworks resonate.
- `docs/specs/non-duplication-system.md` — the deterministic selection mechanism.
- `docs/specs/content-types-allowed.md` — the no-fabrication rule that constrains every framework.
- `docs/specs/ai-brief-analysis.md` — where these frameworks integrate into the prompt.
- `niche-briefs/*.md` — niche-specific tone and language patterns that overlay framework selection.
