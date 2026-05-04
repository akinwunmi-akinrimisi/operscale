# Niche brief: Food

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.

This document is the operational knowledge the AI consults when a food customer submits a brief.

## 1. Who's in this niche

- Restaurant owners (sit-down, fine dining, casual).
- Cloud kitchens and ghost kitchens.
- Catering businesses (events, corporate, owambe).
- Specialty food / dish-specific brands (jollof specialists, suya brands, pastry).
- Packaged-food brands (sauces, spice blends, frozen meals).
- Pastry and dessert businesses.
- Beverage brands (juices, infused waters, premium coffee).

Edge cases:
- Pure delivery aggregators — fits awkwardly; their content is more about the platform than food.
- Cooking-class educators — fits more like education than food.
- Diet-specific food brands — fits with restricted-niche care if claims drift into health territory.

## 2. Tone and voice patterns

Food in Nigeria converts on **craft and presence**. The founder in their kitchen, the food being made, the family eating it. Successful Nigerian food content is about the people behind the food and the food itself — not abstract "culinary" framing.

Common tonal markers:

- Specific dishes by name: "jollof", "ofada", "amala", "egusi", "suya" — not "Nigerian cuisine".
- Cooking method specificity: "low fire", "smoky pot", "the right pepper".
- Personal craft framing: "my grandmother's", "the way we do it in my house", "I tried it 50 ways before I got it right".
- Price honesty: "₦15k for a portion that feeds 4 — and here's why".
- Sensory language: "smoky", "deep", "rich", "kick", "aroma".

Avoid:
- "Authentic" used generically — every Nigerian food brand says authentic.
- "Modern twist" framing without specifics.
- "Curated" or "elevated" without context.
- Generic "comfort food" framing — too American.
- Photoshop-shiny food imagery as the visual norm.

## 3. Topic library

### 3.1 UGC topics that perform

- "How I make my [signature dish]" (slow, real, from one pot)
- "Why my jollof tastes different from your auntie's"
- "A day in my kitchen — from market to plate"
- "What ₦Xk gets you in catering"
- "The dish my customers always come back for"
- "Pricing breakdown: where the ₦X goes"
- "Why I stopped using [common ingredient] and what I use now"
- "Behind the scenes: catering for a 200-person owambe"
- "Customer story: how this started ordering from us"
- "My non-negotiables when I'm cooking [specific dish]"
- "Things food people hate hearing"
- "How to taste your food properly"
- "What goes into our spice blend"
- "Why I source my pepper from [specific market]"

### 3.2 T2V cinematic topics

Visual register: warm, textured, sensory. Food T2V should make the viewer hungry.

- Steam rising from a pot of jollof being uncovered.
- Hands stirring, hands chopping, hands plating.
- Knife cuts through fresh vegetables in slow motion.
- Pour-shots — sauce over meat, oil into the pan, gravy on amala.
- Wide shot of a kitchen mid-service — controlled chaos.
- Time-lapse from raw ingredients to finished plate.
- Close-up of the first cut into the dish — fork through the cake, knife into the fish.
- Family or customers eating the food and reacting.

### 3.3 Carousel templates

- "5 dishes we're known for"
- "How our jollof is different" (process / ingredient breakdown)
- "Catering menu — what's possible at [size] gathering"
- "Behind the spice blend — what's in it"
- "Sourcing breakdown — where every ingredient comes from"
- "Customer reactions" — quote / face / dish carousel

## 4. Brand voice variables

```
common_do_say:
  - specific dish names (jollof, egusi, suya, ofada, amala, etc.)
  - sensory descriptors (smoky, rich, deep, kick, aroma)
  - process framing (low fire, slow, the right way, my way)
  - market and source specifics (specific markets, specific peppers, specific oils)
  - "I", "my customers", "the kitchen"

common_do_not_say:
  - "authentic" used generically
  - "elevated", "curated", "modern twist" without specifics
  - "comfort food" (American framing)
  - generic "delicious", "tasty", "amazing"
  - "Nigerian cuisine" (too abstract; use specific dishes)
```

## 5. Restricted claims to flag

- **Health claims** — "weight-loss meals", "diabetic-friendly", "heart-healthy" — flag for substantiation. Most food brands shouldn't make these claims; if they do, escalate.
- **Halal / kosher claims** — flag for verification (do they actually have certification?).
- **Organic claims** — flag for substantiation.
- **"Premium ingredients"** without specifics — soften to specific named ingredients.
- **"Award-winning"** without specifics — flag and ask the customer which award.
- **Allergen safety claims** — "nut-free kitchen", "gluten-free" — flag for confirmation; these have legal liability if wrong.

The flag should be specific: "Customer mentioned 'diabetic-friendly meals' — flag for clinical-substantiation; if no dietitian involvement, soften to 'lower-glycemic options' framing or remove."

## 6. Niche-specific calendar rhythm bias

Food calendars deviate from baseline 60/40:

- **UGC tilts heavier (70/30 vs 60/40 baseline).** Food founders connect through their kitchen presence; the camera in their kitchen matters more than abstract cinematic.
- **T2V skews to dish reveals and process shots.** Less narrative, more texture and craft.
- **Carousels are menu showcases and process explainers.** Customers save these and refer back when ordering.
- **Avoid early-week aspirational T2V.** Open with the founder in the kitchen on Day 1, not with a moody food close-up.

## 7. Sample reference material fallback

> Example A (craft / personal):
> "My jollof recipe is my mum's, with three changes I made over the last 5 years. She uses a different pepper, I use a smokier one. She uses one onion, I use two. She'd kill me if she heard this — but the customers love mine."

> Example B (founder / kitchen):
> "Today I'm cooking 80 portions of jollof for a wedding. This is what 7 hours in the kitchen looks like. The pepper alone takes 2 hours — and I'll tell you why."

> Example C (educational / sensory):
> "There's a difference between jollof that's smoky and jollof that's burnt. Most people get it wrong by 30 seconds. Here's what to look for."

## 8. Photo aesthetic notes

Food customers commonly upload:
- Themselves (founder UGC).
- Their kitchen / restaurant space.
- Their food / signature dishes.

For founder photos: note kitchen wardrobe (apron, chef whites if applicable), lighting register (kitchens often have warm/yellow lighting — note this for avatar treatment).

For food / kitchen photos: these don't go through the avatar pipeline. They feed into the visual style block as colour and styling references for cinematic T2V (warm tones, kitchen palettes, food-photography conventions).

## 9. Common upsell signals

- Customer mentioned multiple dishes / menu items (Starter's 7 videos can't cover variety).
- Customer mentioned catering AND dine-in / delivery service lines.
- Customer mentioned upcoming menu launch or seasonal items.
- Customer mentioned hosting events (which need their own content arc).

Upsell framing: "with 30 days we can dedicate a week to your signature dishes, a week to behind-the-scenes craft, a week to customer stories, and a week to your catering offerings — that's the full breadth of your kitchen."

## 10. Compliance and care

- Avoid health claims unless customer can substantiate.
- Avoid "premium" without specifics.
- Default to specific dish names rather than abstract food framing.
- For catering customers, ensure event types are realistic and don't promise things they can't deliver.
- For packaged-food brands with NAFDAC registration: verify before referencing the registration in any script.
