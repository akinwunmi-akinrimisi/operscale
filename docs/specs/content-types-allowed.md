# Content types allowed

**Status:** Authoritative for Phase 1.
**Authoritative source for:** the no-fabrication rule.
**Used by:** AI brief analysis prompt, every niche brief, founder review CRM, every script-frameworks and angle-archetypes entry.
**Last updated:** 2026-05-04.

This is the canonical rule about what kinds of content Operscale Calendar produces and — more important — what kinds it does not. Every other doc that touches content generation references this one. If you're generating, reviewing, or editing content and uncertain about a specific case, this document settles it.

The short version: we make content **about** the customer's business; we do not make up content **from** the customer's biography.

## 1. Why this rule exists

Three reasons.

**Customer protection.** Our customers don't sit for an interview before placing an order. They fill in a form. They paste reference posts. They optionally upload reference photos. That's the corpus we have. If we invent stories beyond what's there — *"my grandmother taught me this recipe"*, *"I started this brand because I lost my last job"*, *"my client Tomi went from broke to debt-free in 18 months"* — we're putting words in real businesses' mouths that they did not say. When a customer sees their delivered calendar and notices a fabricated story, the trust evaporates. There's no recovery from that for the customer relationship or for Operscale.

**Audience protection.** People watch and act on this content. A fabricated transformation story in a fintech video ("how I cleared ₦Xm in debt") that lands with a viewer who matches the implied demographic is borderline misinformation. Beauty before-and-afters that we invented are deceptive. Even if the customer would be willing to take credit for the fabrication, the audience deserves accurate signals about what works and what doesn't.

**Operscale protection.** Our reputation is the entire product moat. Once it leaks that we fabricate founder stories, we're indistinguishable from any content mill — and content mills don't sustain margin or referral flywheels. The no-fabrication rule is not a constraint that limits the product; it's the constraint that *defines* the product.

## 2. The fabrication-line decisions, locked

These four decisions were made in the design phase. They're not open for debate during script generation; the AI obeys them, the founder reviewer enforces them.

### 2.1 First-person opinion content — IN

Statements that put a substantive opinion in the avatar's voice are allowed.

**Allowed examples:**
- "In my experience, X is the bigger problem than Y."
- "I'd argue [defensible position]."
- "The way I see it, [perspective]."
- "I don't agree with the conventional take here."

The opinion must be *defensible* — the AI flags any opinion it can't defend with a reason. But it doesn't have to come from a specific lived event.

The reasoning: opinions are how expertise reads on camera. A teacher who never says "I think" sounds like a textbook. The line is biographical specificity — opinions are fine, life events are not.

### 2.2 Generic numbers as authority signal — IN

Statements that imply expertise through unspecified scope are allowed.

**Allowed examples:**
- "After hundreds of inspections..."
- "Years of doing this..."
- "Across the businesses we've worked with..."
- "The patterns I keep seeing..."

These don't claim a specific event; they claim accumulated competence. As long as the customer's business genuinely involves the implied scope of work (a real estate agent has plausibly done many inspections; a fintech advisor has plausibly seen many client situations), the framing is honest.

The AI flags any number-as-authority claim that the customer's business plausibly couldn't support — e.g. a brand-new business saying "after years of doing this".

### 2.3 UGC stays. The 60/40 mix holds.

The customer-uploaded-photos pathway is the central UGC mechanic. We generate a HeyGen avatar from the customer's photos and have that avatar deliver scripts.

The avatar speaks scripts the customer "would plausibly say given their business" — meaning content drawn from their stated expertise, their stated services, their stated values. It doesn't speak scripts about their personal history we don't have.

In practice this means:

- The avatar can say *"five things to check before any property inspection"* (drawn from real-estate expertise the customer claimed). ✓
- The avatar can say *"in my experience, most first-time buyers underestimate service charge"* (defensible opinion). ✓
- The avatar can say *"after dozens of these projects, here's the pattern"* (generic numbers). ✓
- The avatar cannot say *"my mum taught me this when I was eight"* (biographical detail we don't have). ✗
- The avatar cannot say *"my client Sarah went from X to Y in three months"* (specific testimonial we don't have). ✗
- The avatar cannot say *"when I was running my old company..."* (specific personal history we don't have). ✗

The 60/40 UGC-to-T2V mix in the calendar holds — UGC stays the dominant lane. The constraint is *what* the avatar says, not *whether* it speaks.

### 2.4 No fabricated customer stories, testimonials, or transformations

This is the strictest line. We do not produce:

- Named customer testimonials.
- Customer transformation stories ("Tola's 8-week journey", "How [name] saved ₦Xm").
- Before-and-after narratives about specific people.
- Quoted customer reactions ("Tomi told me last week...").

The only exception: a customer's brief explicitly provides a testimonial AND grants consent to use it. That goes through founder review and gets logged in `brief_consent` as a separate consent type. Phase 1 does not have a UI surface for collecting this — meaning testimonials are *off the table by default* for Phase 1.

## 3. The full list — what we produce

Drawn from the angle archetypes (`docs/specs/angle-archetypes.md`), here's the categorical list of content we produce:

**Educational content about the customer's domain.** How service charge is calculated. What's in our spice blend. Decoding ingredient lists. The 5 fees in Nigerian bank statements. How to inspect a property. The grounding: customer's stated expertise + general industry knowledge.

**Product/service explanations.** What's in the offering. What lands when you buy. The deliverables list. The grounding: customer's stated product/service description.

**Pricing transparency.** The breakdown of what something costs. Why custom takes 14 hours. The grounding: customer's stated pricing + customer's stated cost components.

**Industry-level commentary.** Common mistakes in the niche. Patterns we observe. Myths to bust. The grounding: customer's stated expertise + public industry knowledge.

**Demonstrative cinematic content.** Hands cooking. Fabric in motion. Steam rising. Property reveals. The grounding: customer's product/service reality, rendered cinematically without claims about specific events.

**Sales / promotional framing.** Value-prop, why-now, what-makes-this-different. The grounding: customer's stated value proposition, never imported claims.

**Frameworks and checklists.** Pre-decision audits. Quality tells. Decision matrices. The grounding: customer's expertise expressed as transferable knowledge.

**Defensible opinion.** First-person stances on category questions, framed as "I think / in my view / the way I see it". The grounding: positions the customer's expertise can defend.

## 4. The full list — what we do not produce

**Founder origin stories.** "I started this brand because..." / "I built this when..." / "It all began..." We don't have the customer's biography. We don't invent it.

**Customer testimonials.** Named or anonymous specific customer transformations, quotes, or reactions. We don't have consent. We don't fabricate consent.

**"I once / I used to / I learned the hard way" personal anecdotes.** Even if the script feels like it could plausibly be true for the customer, we don't write specific lived events into their voice.

**"My students went on to..." outcome stories about specific people.** Generic class-level outcomes are fine ("the cohort just graduated") but specific individuals require their own consent.

**Family or cultural personal background.** "My mum taught me..." / "My grandmother used to..." / "Growing up in [specific place]..." These are intimate biographical claims. Off the table.

**Specific past employer or company history.** "When I was at [company]..." / "After my last business..." We don't know the customer's career arc.

**Specific event narratives.** "Three years ago, I almost lost..." / "Last month I had a client who..." Even if these would land well, we don't have the events.

## 5. Edge cases the AI must handle

Six edge cases worth being explicit about, because the AI will hit them:

### 5.1 The customer's reference posts contain founder narrative

A real estate customer pastes a reference Instagram caption that begins *"When I started in real estate 4 years ago, I had no idea..."*. The customer is comfortable with this kind of content for themselves.

**Rule.** The AI extracts the *tone and register* from such posts (warm, reflective, founder-led) but does *not* reuse the specific biographical content. The brand voice block captures "uses reflective opening", not "once said: 'when I started in real estate 4 years ago'".

The script generator produces opening lines in similar register without specific biography: *"Real estate has its own rhythm — and after watching it for a while, you start spotting patterns"* ✓ rather than *"After 4 years of real estate, I've spotted patterns"* ✗ (which states a duration we shouldn't fabricate from a single reference post).

If the customer's reference posts repeatedly state a specific duration (consistent across 5+ posts: *"after 4 years"*, *"in my four years"*, *"with 4+ years"*), that's de facto a customer-stated fact and the AI may use it. Stated once, it's a one-off; stated 5+ times, it's part of how they describe themselves.

### 5.2 The customer's brief mentions a specific personal detail

Customer fills in form step 6 *"why did you start this business?"* and writes *"I started this skincare brand because my own skin barrier was broken from Lagos sun and bad products."*. They've given us this story explicitly.

**Rule.** Customer-provided biographical facts are usable. They've consented by typing them in. The AI may surface this in the brand voice block and the script generator may use it in scripts.

But: the AI does *not* embellish. If the customer wrote one sentence about their origin, the avatar says approximately one sentence. We don't expand a single line into a full origin-story video.

The founder review screen flags any script that materially extends customer-provided biographical material beyond what was given. The founder confirms or trims at review time.

### 5.3 The customer asks for testimonial content

Customer's form mentions *"I want videos featuring my best customers."* Or in step 6: *"feature [specific customer name]'s journey."*

**Rule.** Phase 1 default: AI flags this as out-of-scope and the founder reviewer reaches out to the customer to clarify. The path forward is either (a) the customer provides written consent from the named individual + the testimonial content, or (b) we redirect the brief toward category-level outcomes ("the kind of journey we've seen") rather than individual testimonials.

The CRM has a "request testimonial consent" workflow planned for Phase 2+. Phase 1 handles this manually via founder email.

### 5.4 The avatar would naturally say "I" — when does that count as fabrication?

The avatar says "I" all the time in scripts. *"I think the bigger issue is..."*, *"In my view..."*, *"I'd start with..."*. These are fine.

The fabrication line is when "I" attaches to a specific event the customer did not tell us about. *"I once spent ₦2m on a bad inspection"* ✗. *"I think most buyers spend too much on inspections without checking the right things"* ✓.

The AI's check: does this "I" claim a *specific event* or a *general view*? Specific events without source = fabrication. General views = allowed.

### 5.5 The avatar would imply a credential the customer didn't claim

Customer's brief says they're a real estate agent. The avatar says *"as a licensed broker..."*. The customer didn't claim "broker" or "licensed" — they said "agent".

**Rule.** Credential-implying language must match the customer's stated credential exactly. The AI's brief analysis output preserves the customer's credential phrasing in the brand voice block. Any drift in the script generator gets flagged.

### 5.6 The script needs a hook and the most natural hook is biographical

Sometimes a script begs for a personal opening. *"Three years ago I'd have told you this was unavoidable. I was wrong."* That's a strong hook structurally.

**Rule.** The AI's hook-pattern fallback for these cases re-casts personal openers as observational ones:

- "Three years ago I'd have told you..." → "The conventional wisdom is..."
- "I used to think..." → "Most people think..."
- "I learned the hard way..." → "The lesson here is..."

The hook stays strong; the biographical claim is removed.

The Open Loop and PAS frameworks (`docs/specs/script-frameworks.md`) explicitly call out these re-casts in their no-fabrication notes.

## 6. The founder review checkpoint

The founder review CRM is the last line of enforcement. Even with the AI obeying every rule above, the founder watches for:

- Scripts that drift into invented biographical detail.
- Scripts that imply customer relationships we don't have.
- Outcome claims that exceed what the customer said.
- Credential overclaims.

The CRM review screen surfaces a `no_fabrication_check` flag on any script the AI itself was uncertain about. The founder approves, edits, or re-analyzes.

Per `docs/runbooks/crm-runbook.md` section 4.3, this is part of the standard decision tree at every brief review.

## 7. The customer-facing language

Customer-visible copy across the marketing site, brief email, pricing page, and form copy uses this framing:

> *We build personalised content calendars for your business using proven copywriting frameworks. Every video and carousel is grounded in your stated expertise, your products, and your industry — never in invented stories or fabricated testimonials.*

That's the contract. Any marketing copy that drifts from this — promises "viral", promises "transformations", implies founder interviews — is wrong copy. Update copy, not the rule.

## 8. Adding to the rule

This document gets updated when reality teaches us a new edge case. Examples of changes that have happened or could happen:

- A new framework is added (`docs/specs/script-frameworks.md`) that needs a new no-fabrication note.
- A new niche is opened (`niche-briefs/`) that has unique fabrication risks.
- A specific founder review reveals a recurring AI-generated fabrication pattern that needs a new explicit rule.

Update the doc. Update the AI prompt that references it. Update the founder review checklist. All in the same PR per `CONTRIBUTING.md`.

## 9. Cross-references

- `docs/specs/script-frameworks.md` — every framework's no-fabrication notes reference this document.
- `docs/specs/angle-archetypes.md` — every archetype's no-fabrication notes reference this document.
- `docs/specs/research-methodology.md` — the methodology for sourcing material that obeys this rule.
- `docs/specs/non-duplication-system.md` — the deterministic system that uses framework + archetype banks under this constraint.
- `docs/specs/ai-brief-analysis.md` — the prompt that enforces this rule at generation time.
- `docs/runbooks/crm-runbook.md` — the founder review process that enforces this rule at approval time.
- `niche-briefs/restricted.md` — the meta-doc on restricted niches references this for fabrication-risk niches.
- Every `niche-briefs/*.md` — each niche brief has a no-fabrication section anchored here.
