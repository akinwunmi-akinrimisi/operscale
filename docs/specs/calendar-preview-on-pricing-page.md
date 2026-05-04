# Spec: calendar preview on pricing page

The interactive component that lets customers see what their content posting schedule would look like across 7, 14, or 30 days. Lives on the marketing site at `operscale.cloud/pricing`. Static — no API calls when the customer browses.

## Why it exists

The biggest objection at the pricing stage is "what does 14 videos actually look like for my business?" A grid showing day-by-day content makes the abstract package concrete. It's a conversion lever, not just decoration.

Expected lift: visual previews on pricing pages typically lift conversion 10-30% in our category. We measure post-launch.

## What it does

- Shows three tier cards: Starter (7 days), Standard (14 days), Calendar (30 days).
- Each tier card embeds a small calendar grid sized to the tier.
- Customer can click a tier button to switch between Starter / Standard / Calendar.
- Customer can pick their niche from a dropdown — sample topics and palette change to match.
- Hovering or tapping a day cell shows a popover with the topic, content type, and sample caption.
- "Want this calendar?" CTA below the grid scrolls to / launches the form.

## Visual structure

### Layout

- Calendar grid sized to the tier:
  - 7 days = 7 cells in 1 row of 7 (or 2 rows on narrow viewports)
  - 14 days = 14 cells in 2 rows of 7
  - 30 days = 30 cells in 5 rows of 6
- Each cell is ~80×80px on desktop, ~60×60px on mobile.
- Each cell shows: day number, content-type tag (UGC / T2V / CAROUSEL), optional 60s badge.

### Color coding

Cells follow a deterministic rhythm pattern (see "Content rhythm pattern" below) using the design system color ramps:

- UGC video cells: coral ramp (warm, customer-personal feel) — `c-coral` 100 fill, 800 text
- T2V video cells: blue ramp (cool, cinematic feel) — `c-blue` 100 fill, 800 text
- Carousel cells: purple ramp — `c-purple` 100 fill, 800 text
- 60s badge: small pill in top-right of cell

## Content rhythm pattern

The rhythm is deterministic, not random — customers see consistent variety across page reloads. Defined per niche in `apps/web/src/content/calendar-preview/<niche>.json`.

### Starter (7 days, 7 videos + 3 carousels)

```
Day 1: UGC 30s     (intro / hook)
Day 2: Carousel    (key value prop)
Day 3: T2V 30s     (cinematic mood piece)
Day 4: UGC 30s     (educational / how-to)
Day 5: Carousel    (testimonial)
Day 6: UGC 30s     (behind-the-scenes)
Day 7: UGC 30s     (CTA / push to action)

Bonus carousel slot (8 cells total since 7 videos + 3 carousels = 10 items):
Day 8: Carousel    (recap / week summary)
```

We render 8 cells for Starter even though it's a "7-day" calendar — the +1 carousel for the recap. The marketing copy explains: "we send a small bonus carousel at end of week one to recap performance."

### Standard (14 days, 14 videos + 7 carousels)

UGC majority, T2V cinematic anchors at predictable intervals (every 3-4 days), carousels every 2 days. Detailed pattern lives in the niche JSON.

### Calendar (30 days, 30 videos + 14 carousels)

Pattern groups into 4 weekly arcs. Each week opens with a UGC 60s hero, fills with mixed UGC/T2V across the week, closes with a carousel recap. Detailed in niche JSON.

## Interactive behavior

### Hover / tap a day cell

Shows a popover above (or below on edge cells) with:

- Day number and content type label
- Sample topic line (e.g., "Why your moisturiser fails in Lagos heat")
- Sample caption (e.g., "POV: you finally figure out humidity. Save this.")
- Small thumbnail tile (if we have one for this niche-day combination)
- Optional length badge (30s or 60s)

Popover uses Tooltip pattern from shadcn-ui, customised.

### Niche picker

A dropdown above the calendar with options for the 7 niches:
- Beauty
- Real estate
- Fashion / e-commerce
- Fintech
- Health / wellness
- Food / restaurant
- Education

Default niche is "Beauty" (the largest segment we expect).

When the niche changes:
- Sample topics and captions update from the niche's JSON.
- The calendar palette shifts to match the niche's brand mood (subtle — we don't drastically restyle, we tint).
- The URL gets a `?niche=beauty` query param so this is a shareable link.

### Tier picker

Three buttons above the calendar:
- Starter (7 days)
- Standard (14 days) — pre-selected by default ("most popular")
- Calendar (30 days)

Switching tier re-renders the grid. Cell content re-derives from the rhythm pattern + tier scope.

## Implementation

### Component structure

```
apps/web/src/app/pricing/page.tsx                  # Page route
apps/web/src/app/pricing/components/
  CalendarPreview.tsx                              # The grid + state
  NichePicker.tsx                                  # Dropdown
  TierPicker.tsx                                   # Three-button selector
  DayCell.tsx                                      # Single grid cell
  Popover.tsx                                      # Hover/tap popover content
  
apps/web/src/content/calendar-preview/
  beauty.json
  real-estate.json
  fashion.json
  fintech.json
  health.json
  food.json
  education.json
  
apps/web/public/calendar-preview/
  beauty/thumb-day-1.jpg
  beauty/thumb-day-2.jpg
  ... (30 thumbnails per niche, generated once)
```

### Niche JSON structure

```json
{
  "niche": "beauty",
  "display_name": "Beauty",
  "palette_tint": "#F5C4B3",
  "ugc_topics": [
    {
      "topic": "Why your moisturiser fails in Lagos heat",
      "caption": "POV: you finally figure out humidity. Save this.",
      "thumb": "/calendar-preview/beauty/thumb-ugc-1.jpg"
    },
    // ... 10-15 items
  ],
  "t2v_topics": [
    {
      "topic": "Slow-motion serum drop on a leaf",
      "caption": "Plant-based, made for skin that lives outside.",
      "thumb": "/calendar-preview/beauty/thumb-t2v-1.jpg"
    },
    // ... 5-8 items
  ],
  "carousel_topics": [
    {
      "topic": "5 ingredients we will never use",
      "caption": "(and exactly why)",
      "thumb": "/calendar-preview/beauty/thumb-car-1.jpg"
    },
    // ... 5-8 items
  ]
}
```

### Rhythm derivation

```typescript
function deriveSchedule(tier: 'starter' | 'standard' | 'calendar', niche: NicheData): Day[] {
  const cfg = TIER_CONFIG[tier];
  const days: Day[] = [];

  let ugcIdx = 0, t2vIdx = 0, carIdx = 0;
  let ugcLeft = cfg.ugc_count, t2vLeft = cfg.t2v_count, carLeft = cfg.carousels;

  // Set carousel days (every 2-3 days)
  const carouselDays = computeCarouselDays(cfg.days, cfg.carousels);

  for (let day = 1; day <= cfg.days; day++) {
    let entry;
    if (carouselDays.has(day)) {
      entry = { day, type: 'carousel', ...niche.carousel_topics[carIdx % niche.carousel_topics.length] };
      carIdx++;
      carLeft--;
    } else if (day % 3 === 0 && t2vLeft > 0) {
      entry = { day, type: 't2v', ...niche.t2v_topics[t2vIdx % niche.t2v_topics.length] };
      t2vIdx++;
      t2vLeft--;
    } else {
      entry = { day, type: 'ugc', ...niche.ugc_topics[ugcIdx % niche.ugc_topics.length] };
      ugcIdx++;
      ugcLeft--;
    }
    days.push(entry);
  }
  return days;
}
```

### Static generation

The pricing page is statically generated at build time. The niche-picker switches client-side using URL params; no server hits during browsing.

### Pre-generated thumbnails

30 thumbnails per niche × 7 niches = 210 images. Generated once via a one-off script using Ideogram V3 (~$0.04 each = ~$8.40 total). Scripts:

```
scripts/generate-preview-thumbnails.sh
```

Run during the Day 3 setup. Output goes to `apps/web/public/calendar-preview/<niche>/`.

### Bundle size considerations

210 thumbnails is meaningful. We:

- Resize each to 200×200 px before shipping.
- Use AVIF or WebP with JPEG fallback.
- Lazy-load thumbnails (only the visible cells load eagerly; popover thumbnails load on hover).
- Total expected payload: ~2-3 MB across all thumbnails.

## Accessibility

- Tier picker buttons are keyboard-navigable (arrow keys cycle).
- Day cells are keyboard-navigable (Tab to enter the grid, arrow keys move).
- Popover content is announced via `aria-describedby` on focused cell.
- Color is not the sole carrier of meaning — text labels say "UGC", "T2V", "CAROUSEL".

## Mobile considerations

- Below 640px viewport, the 14-day grid wraps to 4 rows × 4 cells (with day labels still visible).
- Popovers become bottom sheets on touch devices.
- Tier picker becomes a horizontally scrollable strip if needed.

## What this spec does NOT cover

- The marketing site copy around the previews. Copy is in `apps/web/src/content/marketing.json`.
- Thumbnails as a Phase 2 dynamic feature (showing actual customer past deliveries). Phase 1 thumbnails are static representative samples.
- Calendar export (download as ICS or print). Out of scope.

## Where to look next

- `apps/web/src/app/pricing/page.tsx` — the page implementation.
- `apps/web/src/app/pricing/components/CalendarPreview.tsx` — the component.
- `niche-briefs/<niche>.md` — operational knowledge per niche (separate from this UI content but related).
- `docs/content-mix-playbook.md` — the rhythm rationale.
