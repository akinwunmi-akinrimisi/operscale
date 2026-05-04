# Content mix playbook

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Last updated:** 2026-05-03.

This document explains how we decide what kinds of videos and carousels to put in a customer's calendar and why that mix performs. It's the playbook the AI brief-analysis prompt and the Phase 2 production agent both consult when turning a brief into a deliverable.

## 1. The mix at a glance

Every Phase 1 calendar follows this mix:

- **60% UGC** (you on camera, via HeyGen avatar, optionally using customer-uploaded photos)
- **40% T2V cinematic** (text-to-video via Veo 3.1 Fast or Seedance 2.0 Fast, depending on lane)
- **Carousels bundled** at a 2:1 video-to-carousel ratio (3 carousels per 7 videos, etc.)

The mix doesn't change between tiers. A Starter customer gets 4 UGC + 3 T2V + 3 carousels; a Calendar customer gets 18 UGC + 12 T2V + 14 carousels. Same ratio, different volume.

## 2. Why 60/40, not 100/0 or 50/50

We've watched what works for Nigerian SMBs across the test niches (beauty, real-estate, fashion, food, fintech, health, education) and the pattern is clear:

- **UGC drives trust.** Founders who appear on camera explaining their own product convert browsers into buyers. This is the workhorse of any SMB content calendar.
- **Pure UGC plateaus.** A feed of 30 UGC videos in a row becomes monotonous. Engagement drops by the third or fourth video as the visual register flattens.
- **T2V cinematic introduces variety and aspirational tone.** It signals production value. It anchors the calendar's visual identity. It gives the customer's feed a reason to stop the scroll.
- **All-T2V calendars feel impersonal.** Customers consistently report that the SMBs they trust most are the ones whose face they can recognise.

60/40 is the sweet spot we've landed on. UGC carries the trust load; T2V carries the variety and aspirational load. Within each calendar there's a deliberate rhythm — UGC clusters interleaved with T2V anchors — so the customer's feed feels coherent rather than randomly shuffled.

## 3. Content rhythm patterns

The order in which UGC, T2V, and carousels appear matters as much as the ratio. The Phase 2 production agent uses a deterministic rhythm pattern (not random) so customers can trust what they're getting and so each calendar has a recognisable arc.

### 3.1 Starter (7 days, 7 videos + 3 carousels)

```
Day 1: UGC 30s     (intro / hook — meet the founder)
Day 2: Carousel    (key value prop, 5 image cards)
Day 3: T2V 30s     (cinematic mood piece)
Day 4: UGC 30s     (educational / how-to)
Day 5: Carousel    (testimonial or social proof)
Day 6: UGC 30s     (behind-the-scenes)
Day 7: UGC 30s     (CTA / push to action)
Day 8: Carousel    (week recap — bonus)
```

The arc: open with personality (Day 1 UGC), stake the value prop (Day 2 carousel), introduce visual ambition (Day 3 T2V), educate to build expertise (Day 4 UGC), prove the product works (Day 5 carousel), open the kitchen (Day 6 UGC), close with action (Day 7 UGC), recap to reinforce (Day 8 carousel).

### 3.2 Standard (14 days, 14 videos + 7 carousels)

Two seven-day arcs. The first arc mirrors Starter. The second arc deepens:

- **Days 8-14**: open with a UGC 60s "deep dive" (Day 8 — first 60s in the calendar), follow with an alternating UGC/T2V cadence punctuated by carousels every 2-3 days, close with a UGC 60s "where we're going" piece.

The key Standard-specific move is the introduction of 60s videos at Day 8 and Day 14 — these signal arc transitions and let the customer's feed breathe between the shorter daily content.

### 3.3 Calendar (30 days, 30 videos + 14 carousels)

Four weekly arcs. Each week is a self-contained mini-Starter with its own thematic spine.

- **Week 1 — Introduce.** Founder origin, value prop, signature offering.
- **Week 2 — Educate.** Tutorials, how-tos, demystification content.
- **Week 3 — Validate.** Testimonials, customer journeys, behind-the-scenes.
- **Week 4 — Activate.** Offers, urgency, calls-to-action.

Each week opens with a UGC 60s hero (Days 1, 8, 15, 22), fills with mixed UGC/T2V across the week (UGC 60% of the time, T2V 40%), and closes with a carousel recap.

The 30-day calendar gives us room to commit to the four-week arc properly. Customers see a calendar that has a beginning, middle, and end — not just thirty videos sequentially shipped.

## 4. Lane selection within T2V

T2V has two lanes: quality (Veo 3.1 Fast) and budget (Seedance 2.0 Fast). The Phase 2 production agent picks per-script based on the angle's role.

### 4.1 When to use the quality lane (Veo 3.1 Fast)

- **Hero positions** in the calendar (Day 1, week openers, finale videos).
- **Product reveals** where the visual quality directly affects perceived product quality (luxury fashion, premium food, real-estate).
- **Mood-piece anchors** that establish the brand's visual register early in the calendar.

Roughly 40-50% of T2V output goes through the quality lane. At ~$3.44 per 30s video, this is the more expensive lane.

### 4.2 When to use the budget lane (Seedance 2.0 Fast)

- **Filler T2V positions** that aren't carrying brand-establishment weight.
- **Fast-cut sequences** where the eye spends ≤2s per shot — quality differences are imperceptible at this duration.
- **Niches where the bar is "competent" not "stunning"** (most fintech, education, restricted-niche content).

50-60% of T2V output goes through the budget lane. At ~$0.94 per 30s video, this is what keeps margins healthy.

### 4.3 Decision rule

The production agent uses this rule:

```
if angle.role in ['hero', 'reveal', 'mood_piece']:
    lane = 'quality'
elif niche in ['luxury_fashion', 'premium_food', 'real_estate_high_end']:
    lane = 'quality'
elif average_shot_duration < 2.0:
    lane = 'budget'
else:
    lane = 'budget'
```

This keeps quality-lane usage at ~45% of T2V. If we ever see customers complaining about visual quality in feedback, we shift the threshold toward more quality-lane usage; if margins compress, we shift the other way.

## 5. UGC character consistency

This is the operational challenge that makes UGC actually work at our cost target.

### 5.1 The custom-avatar path (when customer uploaded photos)

If the customer uploaded reference photos in form step 5, Phase 2 production creates a **custom HeyGen avatar** from those photos before any UGC video renders. The avatar persists across all UGC videos in that customer's calendar — same face, same voice, same wardrobe register.

The flow:
1. Phase 1 captures the photos and consent.
2. Phase 2 production agent submits photos to HeyGen's instant avatar API on order start.
3. Avatar is ready in 5-30 minutes (HeyGen-side processing).
4. All UGC scripts in the calendar render against this single avatar.
5. Avatar is retained for the duration of production; deleted post-delivery as part of the photo retention sweep.

### 5.2 The stock-presenter path (when customer skipped photos)

If the customer skipped photo upload, Phase 2 production picks a **stock HeyGen avatar** that matches:
- The setting/vibe selected in form step 6.
- The customer's stated brand voice (matched to a presenter whose energy fits).
- The customer's niche (we maintain a small per-niche shortlist of presenters that perform well).

The same stock avatar is used across all UGC videos in that calendar — never mix presenters within a single customer's deliverable. Mixed presenters look like a content mill; one consistent presenter looks intentional.

### 5.3 Why we don't offer customer choice between presenters

In Phase 1, the form doesn't show a picker. We pick. Reasons:

- **Decision fatigue.** A presenter picker adds a step and a choice the customer doesn't have a strong opinion about.
- **Quality control.** We've curated a small set that we know performs. A picker would give the customer access to all 200+ HeyGen avatars, most of which we'd never recommend.
- **Brand consistency.** When the customer eventually sees the calendar, they should think "this matches my brand" not "I picked this presenter and I'm second-guessing myself."

Phase 2+ may add a "we picked X — does this work?" preview step before production starts. Phase 1 doesn't.

## 6. Brand voice in scripts

Every UGC script and every T2V narration draws from the `brand_voice` block in the AI brief analysis output. This block is what lets us turn a generic content type ("educational how-to UGC video") into something that sounds like the customer.

### 6.1 What the brand voice block captures

- **Tone summary**: warm, conversational, slightly aspirational. Or: technical, no-nonsense, expert. Or: playful, irreverent, gen-Z. Etc.
- **Vocabulary pattern**: which words/phrases appear naturally, which don't. For Nigerian SMBs this often includes Naija English markers, light Yoruba/Igbo/Hausa phrasing if the customer uses it.
- **Sentence rhythm**: short and punchy, or long and considered. Where the CTAs land.
- **Emotional register**: warm, distant, hyped, calm.
- **Do-say list**: phrases the customer uses that we should preserve (e.g. "trust me, baby").
- **Do-not-say list**: corporate phrases the customer would never use ("synergize", "leverage solutions").

### 6.2 How the script generator uses it

The Phase 2 script generator includes the brand voice block verbatim in its system prompt. Every UGC and T2V script is generated against this block. The result:

- The customer reads the first delivered script and recognises themselves.
- Across all 7-30 videos in the calendar, the voice stays consistent.
- A reviewer who knows the customer can spot drift quickly.

The brand voice block is the single biggest reason we run founder review on every brief — getting this right early matters more than any other field.

## 7. Visual style consistency

The `visual_style` block in the AI brief analysis output drives the production aesthetic.

### 7.1 What it captures

- **Recommended palette**: 3 hex codes, derived from customer-provided brand colours plus photo tones.
- **Recommended typography**: caption font family.
- **Recommended camera treatment**: natural daylight + mid-shot, or tight studio + dramatic lighting, etc.
- **Recommended caption style**: large bold word-by-word kinetic, or small lower-third subtitle, etc.

### 7.2 How production uses it

- **Carousels** use the palette and typography directly.
- **T2V cinematic** uses the camera treatment as part of the prompt to Veo/Seedance ("warm natural daylight, mid-shot framing, shallow depth of field").
- **UGC captions** use the caption style.

A customer's calendar feels coherent because every component points to the same visual style block. Without this, you'd see thirty videos that share a presenter but disagree on palette, typography, and caption treatment — which is exactly what generic content-mill output looks like.

## 8. Niche-specific adjustments

Each niche has a small set of overrides that the AI brief analysis applies on top of the general 60/40 mix.

### 8.1 Beauty

- **More UGC than baseline.** Beauty is a face-and-product category; the founder on camera matters even more here. Phase 1 keeps the 60/40 mix but Phase 2+ may shift to 70/30.
- **Carousels skew toward ingredients/before-after.** The carousel templates for beauty bias to "5 ingredients we'll never use" and customer transformation grids.
- **T2V skews toward sensory close-ups.** Slow-motion serum drops, golden-hour applications, shelf reveals. Less narrative, more texture.

### 8.2 Real estate

- **More T2V than baseline.** Real estate buyers want to see the property. Phase 1 keeps the 60/40 mix but T2V here uses heavier quality-lane allocation (60%+ vs 45% baseline).
- **UGC skews to expertise and trust.** "What I'd check before any inspection" beats "look at this listing".
- **Carousels are checklists.** Real-estate buyers print and bring carousels to inspections; we lean into that.

### 8.3 Fashion / e-commerce

- **Balanced 60/40.** Fashion benefits from both founder personality and aspirational visuals.
- **T2V skews to editorial.** Slow-motion fabric, street walks, lookbook treatments.
- **UGC skews to styling and behind-the-scenes.** "How I'd style this 3 ways", "the cost behind one piece".
- **Carousels are styling guides.** Owambe outfit ideas, fabric care, body-shape styling.

### 8.4 Food

- **More UGC than baseline.** Food founders connect through their kitchen presence. 70/30 ratio in Phase 2+; 60/40 in Phase 1.
- **T2V skews to dish reveals.** Steam rising, knife cuts, plating sequences.
- **UGC skews to story and craft.** "Why my jollof tastes different", "a day in my kitchen".
- **Carousels are menu showcases.** Featured dishes, sourcing, pairing guides.

### 8.5 Fintech

- **More T2V than baseline.** Fintech benefits from a calm, considered visual register. Phase 1 keeps 60/40 but T2V uses 70%+ quality lane.
- **UGC skews to expertise and education.** "Why most Nigerian SMEs fail at savings", "tracked my bank charges for 90 days".
- **Carousels are guides and explainers.** "5 fees you didn't know about", emergency-fund setup, tax-season reminders.
- **Restricted-niche care.** If the customer is offering credit, lending, or investment products without NDPC/CBN registration, we flag in brief analysis.

### 8.6 Health

- **Restricted niche** by default. Brief analysis flags any health claims, prescription mentions, before/after weight imagery.
- **Mix tilts toward education and lifestyle**, away from outcome claims.
- **UGC must avoid medical advice register.** Tone is educational, not prescriptive.

### 8.7 Education

- **Balanced 60/40.**
- **UGC skews to teacher/founder authority.** "Three things I wish I knew", "how I built this curriculum".
- **T2V skews to outcome aspirations.** Students at graduations, light-filled classrooms, the future-state aesthetic.
- **Carousels are syllabi and frameworks.** "What you'll learn in 12 weeks", "the 5 pillars of this program".

## 9. Carousel anatomy

Every carousel is 5 image pages. The template:

- **Page 1**: hook. Single statement that earns the swipe. Large type, minimal background.
- **Page 2**: setup. The problem or context.
- **Page 3-4**: payoff. The 3-5 points / examples / steps.
- **Page 5**: CTA. Single action, brand-coloured background.

This template applies across all niches. The content varies; the architecture doesn't. Customers swipe in muscle memory, and we honour that.

## 10. What the production agent reads

When a paid order moves into production, the agent reads:

- This document (rhythm pattern, lane logic, niche adjustments).
- The customer's `brand_voice` block (every script).
- The customer's `visual_style` block (every render).
- The customer's `photo_aesthetic` block (avatar treatment recommendation).
- The relevant `niche-briefs/<niche>.md` (niche-specific topic libraries and tone hints).

The agent does not improvise mix decisions. The mix is fixed; the personalisation is everywhere except the mix.

## 11. When to revisit this playbook

- **30+ days of customer feedback signal.** If post-delivery survey shows "too much T2V" or "too much UGC" consistently, we shift the ratio.
- **Quality-lane T2V engagement consistently outperforms budget-lane.** If customers report better feed performance from quality-lane T2V, we shift the lane mix.
- **A new niche gets added.** Each new niche needs a section in this document plus a niche brief.
- **HeyGen, Veo, or Seedance pricing shifts ≥20%.** Forces a margin or mix adjustment.

The 60/40 mix is a starting point informed by what we've seen, not an inherited truth. We update this document when reality teaches us something new.
