# Niche brief: Fashion / e-commerce

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt. Phase 2 production agent. Calendar preview component.

This document is the operational knowledge the AI consults when a fashion or e-commerce customer submits a brief.

## 1. Who's in this niche

- Fashion brand founders (ready-to-wear, ankara, occasion wear, streetwear).
- Bag and accessory brand founders.
- Footwear brand founders.
- Bridal and owambe specialists.
- Fashion e-commerce stores aggregating multiple brands.
- Stylists and personal shoppers selling services.

Edge cases:
- Pure tailoring services without product line — fits, but content slants toward UGC craft and bespoke fitting rather than product reveals.
- Wholesale fashion suppliers — fits awkwardly; their audience is other businesses, not consumers. Flag for content register adjustment.
- Beauty + fashion combo brands — primary niche is whichever they emphasised in step 2; don't try to serve both at once.

## 2. Tone and voice patterns

Fashion in Nigeria converts on **personality and aspiration in equal measure**. The founder's taste, their backstory, and the product itself all matter. Successful Nigerian fashion content reads like a friend who has style, not like a department store.

Common tonal markers:

- Specific styling language: "I paired this with my old jeans and the gold hoops", "the cut hits at the natural waist".
- Cultural specificity: ankara, owambe, aso ebi, gele references used naturally.
- Price transparency or deliberate price reveal moments: "this piece is ₦85k — and here's why every fabric in it cost what it cost".
- Behind-the-scenes craft: tailor cutting, fabric sourcing, fitting sessions.
- Outfit context: "for the wedding", "for Sunday brunch", "for dropping off your kids and looking together".

Avoid:
- Generic "queen / boss" Instagram-influencer register.
- Aspirational language disconnected from reality ("live your best life").
- Excessive emoji or all-caps energy in scripts.
- Photoshopped-thin body imagery as the visual norm.

## 3. Topic library

### 3.1 UGC topics that perform

- "Style 1 piece 3 ways"
- "What ₦Xk gets you in bridal"
- "The fabric difference: why this dress costs more"
- "Behind the design: how this piece came to be"
- "Customer outfit reveal — [name] for her engagement"
- "What I'd wear to [specific Lagos event] right now"
- "Why I dropped my prices last month (and why I'm not lowering them again)"
- "Things tailors hate hearing"
- "How to take care of your ankara so it lasts"
- "What I'm packing for [destination]"
- "The piece I'm most proud of, and why"
- "How my customers actually wear this"
- "Body shape tips: what works on a [shape]"
- "The 5-piece capsule that handles a Lagos work week"

### 3.2 T2V cinematic topics

Visual register: editorial, motion-rich, fabric-aware. Fashion T2V should make the viewer want to touch the product or imagine wearing it.

- Slow-motion fabric flow as a model walks.
- Hands smoothing the seam of a finished piece.
- A model styled head-to-toe walking down a Lagos street (Ikoyi, Lagos Island, Ikate).
- Lookbook stills coming alive — the photo, then the moment-of-photo.
- Time-lapse from raw fabric to finished garment.
- Close-up of beadwork, embroidery, or hand-finishing detail.
- A wide aerial of Lagos with the brand colour echoed in styling.

### 3.3 Carousel templates

- "5 ways to style 1 piece"
- "What goes into a ₦Xk piece" (cost / craft breakdown)
- "Owambe lookbook — 8 outfits"
- "Ankara care guide"
- "Body-shape styling — what works for [shape]"
- "Behind-the-scenes — making [signature piece]"

## 4. Brand voice variables

```
common_do_say:
  - specific cultural references (owambe, aso ebi, gele, ankara, asoke)
  - specific events (wedding, naming ceremony, Sunday brunch, work week)
  - body-positive language ("works on a fuller frame", "flatters a tall figure")
  - craft-specific vocabulary (cut, drape, fall, finish, hand-stitched)
  - price-transparent framing ("yes it's ₦85k — here's why")

common_do_not_say:
  - "queen", "boss", "diva" used generically
  - "investment piece" without context
  - "limited edition" without verifiable rationale
  - thin-only or single-body-shape framing
  - English-only when the customer's reference posts use mixed register
```

## 5. Restricted claims to flag

- **"Imported" claims** — if the customer says fabric is "imported" or "Italian", flag for confirmation. Local-production fashion is a positive in Nigerian market right now; we don't want to falsely import-ize a local brand.
- **Designer names dropped without authorisation** — flag any "as worn by [celebrity]" or "trending with [influencer]" without confirmation.
- **Health claims on shapewear or postpartum wear** — restricted (any "snaps you back" / "transforms" claims need flag).
- **Counterfeiting risk** — if customer references a luxury brand by name in their content (e.g. "alternative to Chanel"), flag for legal sensitivity.

## 6. Niche-specific calendar rhythm bias

Fashion calendars run close to the baseline 60/40:

- **Strong T2V anchor positions.** Fashion benefits from cinematic mood-piece anchors that establish the brand's visual register early in the calendar — Day 1 of any tier should be a high-quality T2V mood piece, not a UGC.
- **UGC skews 50/50 between presenter-led (talking head) and craft-led (hands-on-product, no face).** Some fashion founders are camera-shy; the brief flow should detect this from reference posts and bias craft-led UGC for them.
- **Carousels skew visual.** Less text, more imagery. The 5-page template still applies but the per-page text load is lighter than for beauty or fintech.

## 7. Sample reference material fallback

> Example A (warm / styling-focused):
> "I styled this piece three ways for my client — date night, work meeting, brunch. Same dress, different energy. The trick is the accessories. Let me show you."

> Example B (craft / behind-the-scenes):
> "This piece took 14 hours to hand-finish. The neckline alone is 6 hours of beadwork. When I tell you ₦85k is a fair price, this is what I mean."

> Example C (founder / personal):
> "I started this brand because I couldn't find a single ankara dress that fit my body and didn't make me feel costumed. Now we make pieces for women who want to feel themselves in their own culture."

## 8. Photo aesthetic notes

Fashion customers often upload photos of:
- Themselves (founder UGC).
- Their products on a model.
- Their products flat-lay on a surface.

For founder UGC photos: note the styling, palette, setting. Fashion founders typically have a strong personal aesthetic that should echo through the brand.

For product / model photos: these don't go through the avatar pipeline. They feed into the visual style block as colour and styling references for cinematic T2V.

## 9. Common upsell signals

- Customer has 5+ active SKUs (Starter's 7 videos can't cover).
- Customer mentioned an upcoming collection drop or seasonal launch.
- Customer mentioned both ready-to-wear AND custom / bespoke service lines.
- Customer mentioned active wedding-season pipeline.

Upsell framing: "we can dedicate weeks to your SS25 collection drop, then have full coverage of your wedding-season custom work — that's hard to do in 7 videos."

## 10. Compliance and care

- Avoid putting unverifiable claims about imported / luxury / celebrity-endorsement in scripts.
- Default to body-positive framing across all UGC scripts unless customer's reference posts deliberately set a different register.
- For bridal / occasion-wear customers, the cultural specificity should be high — "owambe" not "Nigerian wedding event".
