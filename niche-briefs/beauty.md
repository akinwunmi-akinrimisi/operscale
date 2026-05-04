# Niche brief: Beauty

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.

This document is the operational knowledge the AI consults when a beauty customer submits a brief. It's not customer-facing.

## 1. Who's in this niche

- Skincare brand founders (cleansers, serums, moisturisers, body care).
- Cosmetics founders (lipsticks, eyeshadow, foundation, brow products).
- Haircare brand founders (oils, treatments, tools).
- Spa, salon, and treatment-clinic owners.
- Beauty consultants and educators selling courses or coaching.

Edge cases that **don't** fit cleanly:
- Cosmetic surgery — restricted (medical claims, before/after regulation).
- Aggressive whitening products — flagged as ethically restricted (we don't make ads for skin bleaching).
- Lash and brow extensions service-only — fits, but content slants more toward UGC service-demonstration.

## 2. Tone and voice patterns

Beauty in Nigeria mostly converts on **warmth and trust**, not authority. The dominant register is "I tried this and it works for me, here's why" rather than "studies show". Even technical founders (chemists, dermatologists) lean conversational on social.

Common tonal markers in successful Nigerian beauty content:

- Light Pidgin or Yoruba interjections used naturally (not performatively): "abeg", "no wahala", "trust me, baby".
- First-person stakes: "this saved my skin", "I cried the first time it worked".
- Specific local grounding: harmattan dryness, Lagos heat, NEPA-light makeup mirror struggles.
- Direct address to the viewer: "you've been doing this wrong" works; "consumers should consider" doesn't.

Avoid:
- Clinical / corporate vocabulary ("efficacy", "consumers", "demographic").
- US-style "blessed and grateful" gratitude opens.
- Generic skincare-Twitter aesthetic ("the girls who get it, get it").
- Whitening-as-improvement framing — even when the customer's product is brightening-focused, we frame as "even tone" or "glow", never "lighter".

## 3. Topic library

### 3.1 UGC topics that perform

These map to the angle slots in the AI brief analysis output. Specific enough to be useful, generic enough to adapt.

- "Why your moisturiser stops working in Lagos heat (and what to do)"
- "I tried [competitor] for 30 days — here's what I noticed"
- "The 3-product bedtime routine I've stuck with for 2 years"
- "My customers always ask about [specific ingredient] — here's the truth"
- "What I wish I knew before launching a skincare brand"
- "How to read a Nigerian beauty product label" (advanced founder positioning)
- "Why my serum costs ₦X (here's the breakdown)"
- "Skincare myths Nigerian women are tired of hearing"
- "The signature product story — how this came to be"
- "A day in the life of running a beauty brand from Lagos"
- "Customer transformation: [name]'s 8-week journey"
- "What harmattan does to your skin (and how to fight back)"
- "Reading my one-star reviews and responding"
- "What's actually in our [product]" (ingredient breakdown)

### 3.2 T2V cinematic topics

Visual register: warm, sensory, tactile. Beauty T2V succeeds when it makes the viewer want to touch the product.

- Slow-motion serum drop on a leaf or skin.
- Sunlit shelf with the full product line arranged.
- Hands smoothing cream into skin during golden hour.
- Ingredients arranged on a wooden board (raw shea butter, rose petals, etc.).
- Steam from a heated towel against a clay mask application.
- Texture macros — cream pulls, foam bursts, oil sheets.
- Wide shot of a spa or workshop with morning light.
- The brand colour palette rendered as fabric, paint, or natural materials.

### 3.3 Carousel templates

- "5 ingredients we'll never use (and exactly why)"
- "Real customer transformations" — 4 image cards plus 1 close
- "The 3-step bedtime routine for [specific concern]"
- "Decoding ingredient lists" — what 'fragrance' actually means, etc.
- "Behind every batch" — process photos
- "[Founder]'s skincare journey" — origin story carousel

## 4. Brand voice variables

The AI brief analysis prompt uses these variables when filling out the `brand_voice` block for beauty customers:

```
common_do_say:
  - product/result-specific language ("this serum", "my hyperpigmentation", "your skin barrier")
  - personal stakes ("I", "you", "my customers")
  - outcome-focused verbs ("evens", "calms", "softens")
  - light Naija inflection if customer reference posts use it

common_do_not_say:
  - "consumer", "demographic", "market"
  - "efficacious", "synergistic", "innovative"
  - whitening / lightening framing
  - medical claims ("treats", "cures", "heals")
```

## 5. Restricted claims to flag

The AI brief analysis must flag (do not silently suppress) when a beauty customer's brief implies any of:

- **Medical claims** — "treats acne", "cures eczema", "heals scarring" — flag for founder review. We can soften to "supports clearer skin", "comforts dry skin", "fades the appearance of marks" but only with founder approval.
- **Whitening / lightening** — entire framing flagged. Founder may approve "even-tone" / "glow" pivots; bleaching framing is hard-blocked.
- **Before/after weight or body imagery** — flagged. Beauty content shouldn't drift into body-aesthetic territory without explicit customer direction.
- **Implied dermatologist endorsement** when no dermatologist is involved — flag.
- **NAFDAC claims** when the customer hasn't confirmed registration — flag.

The flag should be specific. Don't say "restricted niche" — say "Customer mentioned 'cures eczema' in step 3. Soften to 'comforts irritated skin' or escalate for medical-review approval."

## 6. Niche-specific calendar rhythm bias

Beauty calendars run slightly differently from the baseline 60/40 mix described in `docs/content-mix-playbook.md`:

- **UGC-heavier overall.** 60/40 is the floor. The Phase 2 production agent biases toward 65/35 when the founder is photogenic and engaged on camera (signaled by reference posts + photo upload).
- **More carousels in the early days.** Beauty buyers consume carousels for ingredient education and social proof. The first quarter of any beauty calendar (Days 1-3 of Starter, Days 1-4 of Standard, Days 1-7 of Calendar) skews carousel-heavy.
- **T2V cinematic positioned as anchors, not fillers.** A beauty calendar doesn't need 12 cinematic videos all doing similar things; it needs 3-4 standout cinematic videos that establish the brand's visual identity, with the rest being budget-lane fillers.

## 7. Sample reference material

When an AI brief analysis runs for a beauty customer with no reference posts in step 4, the prompt falls back to these examples to anchor the brand voice block:

> Example A (warm, conversational):
> "Y'all, this serum has been carrying me through Lagos harmattan. Three drops at night. That's it. My skin is thanking me."

> Example B (educational, expert):
> "If your moisturiser feels heavy in Lagos heat, that's not the moisturiser — that's the formulation. Water-based products evaporate fast in our humidity. Here's what to look for instead."

> Example C (founder-storytelling):
> "I started this brand because my own skin barrier was broken from Nigerian sun and bad products. Three years later, this is the formula that healed me. And it's now healing 4,000+ Nigerian women."

The AI picks the example closest to the customer's reference posts and uses it as a tone anchor.

## 8. Photo aesthetic notes for beauty

When the customer uploads photos, the photo aesthetic block should look for:

- **Skin clarity in the photos.** Acne, eczema visible? Don't comment on it in the brief email — but flag for the production agent so the avatar treatment doesn't accidentally exaggerate it.
- **Lighting register.** Beauty performs best in warm natural daylight. Flag harsh fluorescent or direct flash photos as "may need different reference for avatar".
- **Wardrobe and styling.** Beauty founders often wear neutral / earth tones. Note the palette so the visual style block can echo it.
- **Setting hints.** Indoor home, indoor studio, outdoor — affects the camera treatment recommendation in `visual_style`.

## 9. Common upsell signals

Beauty customers who picked Starter frequently underestimate calendar volume. The AI brief analysis should recommend an upsell to Standard when:

- Customer has 2+ products in their range (a 7-video calendar can't show all of them).
- Customer mentioned "launch" or "relaunch" in goals.
- Customer has been on Instagram for less than 6 months (low organic reach makes volume more important).

When upselling, frame it concretely: "with 14 videos you can dedicate 3-4 to each product line and still have room for behind-the-scenes" — don't generic-pitch.

## 10. Restricted-niche-style fallback

If a beauty customer's brief is borderline (medical claims, body-image framing, whitening) and the founder reviewer chooses to discard, the fallback flow is the same as any other niche:

- Discard from CRM.
- No further automated emails.
- Founder may follow up manually if they want to redirect the customer toward a compliant content angle.

We don't have a separate "beauty-restricted" sub-flow in Phase 1.
