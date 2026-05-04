# Niche brief: Health

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.

This document is the operational knowledge the AI consults when a health customer submits a brief. **Restricted-niche care applies throughout — this niche is the closest to a hard-block category in Phase 1.**

## 1. Who's in this niche

In-scope (with restrictions):
- Wellness coaches and educators (lifestyle, sleep, mental health awareness).
- Fitness brand founders (gym programs, fitness apparel, equipment).
- Nutrition educators (food-as-lifestyle, not dietitians without RD-N registration).
- Functional supplement brands (NAFDAC-registered).
- Health-tech startups (telemedicine, scheduling, records).
- Healthcare service providers — clinics, diagnostic centres (with marketing-restraint care).

Out-of-scope (Phase 1 hard-block):
- Weight-loss-specific brands or coaches with before/after framing as primary.
- Unregistered supplements or "miracle cures."
- Skin-bleaching products marketed as "skin lightening treatment."
- Anything claiming to treat serious illness (cancer, HIV, diabetes, heart disease) without a licensed medical practitioner.
- Mental health "instant cure" coaching without licensed practitioners.

The founder review screen must catch these on submission.

## 2. Tone and voice patterns

Health content in Nigeria converts on **measured education**. The category is full of overpromising; trustworthy health voices stand out by being conservative. Successful Nigerian health content sounds like a thoughtful practitioner explaining things, not like an Instagram fitness coach.

Common tonal markers:

- Specific habits, not transformations: "I started walking 30 minutes a day after work" beats "transform your body in 30 days".
- Cultural specificity: Nigerian food (jollof, eba, suya), Lagos commute reality, work-from-home challenges in Nigerian climate.
- Conservative outcomes: "I sleep better", "I feel less anxious", "my energy is more stable" — NOT "I cured my anxiety".
- Process and consistency framing: "30 days of small changes", not "the secret to radical transformation".
- Acknowledgment of context: "this won't work for everyone", "talk to your doctor first".

Avoid:
- Before/after weight imagery.
- "Detox" and "cleanse" framing.
- Medical claims dressed as wellness ("balances hormones", "boosts immunity", "fights inflammation").
- Body-shape-judgmental language.
- "Toxin"-clearing claims.
- Emotional manipulation around body image.

## 3. Topic library

### 3.1 UGC topics that perform

- "What I changed about my evening routine that helped me sleep better"
- "30 days of walking 30 minutes — what actually changed"
- "How I built a simple home workout that I actually do"
- "Eating Nigerian food and still hitting health goals"
- "Why I stopped doing extreme diets (and what I do instead)"
- "Talking to my doctor about [specific common topic]"
- "My honest review of [wellness app or program]"
- "What 6 months of therapy taught me about [specific topic]"
- "How I deal with Lagos stress without losing it"
- "Behind the work: what I tell my clients in week 1"
- "The boring habits that actually work"
- "Things wellness influencers won't tell you"
- "My non-negotiables for staying healthy in Lagos"
- "What changed when I stopped tracking calories"

### 3.2 T2V cinematic topics

Visual register: warm, natural, body-positive. Health T2V should make wellness feel attainable and human, not aspirational and distant.

- A morning walk through a Lagos park or estate.
- Hands cooking a simple Nigerian meal — eba, plantain, vegetable soup.
- A simple home workout in a normal Nigerian apartment.
- Wide shot of a yoga or meditation moment with diffused light.
- Time-lapse of a meal coming together — produce to plate.
- A founder/coach walking with a client through outdoor space.
- Quiet morning routine — water, journal, light stretches.

Avoid:
- Pristine gym aesthetics with model-bodies.
- Western-style green-juice / acai-bowl content (looks aspirational, lands wrong in Lagos).
- Before/after body imagery.

### 3.3 Carousel templates

- "5 small habits I actually maintained"
- "Eating well on a Nigerian budget"
- "What to ask your doctor at your next visit"
- "The 'wellness' habits that aren't actually backed by anything"
- "My week in workouts — for a busy professional"
- "Sleep hygiene checklist for Lagos heat"

## 4. Brand voice variables

```
common_do_say:
  - specific habits ("30 minutes", "twice a week")
  - conservative outcomes ("more energy", "better sleep", "less anxious")
  - "I", "my clients", "in my experience"
  - cultural specifics (Nigerian food, Lagos commute, our weather)
  - "talk to your doctor", "this isn't medical advice"

common_do_not_say:
  - "transform", "miracle", "cure", "heal"
  - "detox", "cleanse", "toxins"
  - "fix" your body
  - before/after framing
  - "balance hormones", "boost immunity" (medical claims)
  - body-shape comparisons or judgments
```

## 5. Restricted claims to flag

This niche has the most flags after fintech:

- **Medical claims** — "treats", "cures", "heals", "balances", "boosts" — flag every instance. Soften toward observational language ("supports", "helps with", "associated with").
- **Weight-loss specific framing** — flag any "lose 10kg", "drop the weight", "transform your body" language.
- **Before/after imagery** — flag in any reference posts; don't recommend before/after as content angle.
- **Supplement claims** — if customer mentions a supplement, must verify NAFDAC registration before allowing claims.
- **Mental health "cure" framing** — anxiety, depression, ADHD as conditions to be cured by content / programs — flag.
- **Diabetes / heart disease / cancer / HIV mentions** — flag immediately for founder review.
- **Children's health products without paediatric professional involvement** — flag.

The flag should always specify the soften: "Customer mentioned 'cure your insomnia' — soften to 'practical habits that may help you sleep more easily' OR escalate for licensed-clinician confirmation."

## 6. Niche-specific calendar rhythm bias

Health calendars run close to baseline but with restraint:

- **UGC tilts heavier (65/35 vs 60/40 baseline).** Health is a trust-driven category; the founder on camera matters.
- **T2V skews to lifestyle / mood pieces** rather than product-reveal cinematic. Slow morning walks, calm cooking shots, daylight stretching.
- **Carousels are educational checklists.** Densely informational, low on hype.
- **Mood-piece anchors are calmer than other niches.** Less drama, more breath.

## 7. Sample reference material fallback

> Example A (educational / measured):
> "I'm a wellness coach, not a doctor. What I tell my clients on day one is: pick one small habit, do it for 30 days, then add another. That's how lasting change happens. Anyone selling you a 7-day transformation is selling you a feeling."

> Example B (founder / personal):
> "Three years ago I was burning out from 70-hour weeks. I didn't transform overnight — I made one small change, then another. Today I sleep 7+ hours, walk 30 min daily, and I'm calmer. Here's what actually worked, and what didn't."

> Example C (cultural / grounded):
> "Eating well in Lagos doesn't mean kale and quinoa. Egusi is fine. Eba is fine. The problem isn't Nigerian food — it's how we eat it. Here's what I changed."

## 8. Photo aesthetic notes

Health customers occasionally upload photos of:
- Themselves (founder UGC).
- Clients (with consent — flag if no consent confirmation).
- Workout / wellness setup spaces.

For founder photos: note wardrobe (often athletic / casual), lighting, setting. The visual style block should bias toward natural daylight, warm tones, body-positive composition.

For client photos: only use if customer explicitly states client consent in step 6 of the form. Otherwise flag and don't reference.

## 9. Common upsell signals

- Customer mentioned program, course, or coaching offering (suggests longer arc).
- Customer mentioned both consumer wellness AND professional/B2B services.
- Customer mentioned upcoming launch or seasonal campaign.

Upsell framing: "with 14 videos we can dedicate 4-5 to your coaching program's specific value and still have lifestyle content for general visibility — that's hard to do in 7 videos."

## 10. Restricted-niche fallback

This niche is the most likely to have a discardable brief. The founder review process is:

- **Read every claim flag carefully.**
- **If claims can be softened**, the AI's brief output already includes soften-suggestions. Founder approves with edits.
- **If claims are inseparable from the customer's offering** (e.g. their entire product is positioned as a cure), founder discards.
- **If the customer's referenced posts are full of body-image-harmful content**, founder discards.

When discarding, the founder may write a personal email to the customer redirecting toward a compliant content angle (e.g. "we'd love to help you with content that focuses on lifestyle habits and practitioner-level expertise, not outcome claims"). This is manual.
