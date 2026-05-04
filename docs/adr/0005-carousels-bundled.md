# ADR 0005: Carousels bundled at every tier (no add-on choice)

**Status:** Accepted, 3 May 2026.

## Context

In v1 of the PRD, carousels were an add-on with three quantity choices. This created decision fatigue at the form, lower attach rate from default-no-carousel customers, and an extra step in the form.

Carousel COGS is small ($0.20/carousel × 14 max = $2.80). Bundling at all tiers without raising prices costs us 1-2 percentage points of margin per tier.

## Decision

Carousels are bundled at every tier:
- Starter: +3 carousels
- Standard: +7 carousels
- Calendar: +14 carousels

Prices unchanged from v1: ₦150k / ₦275k / ₦525k.

The form has no carousel-add-on step.

## Consequences

- Cleaner pricing page; one less decision for the customer.
- Form has 7 steps instead of 8 (offset by adding the photo upload step, so net same length).
- Margin compresses by ~1-2 percentage points per tier (89-94% gross down from 91-95%).
- Carousel attach rate becomes 100%. Phase 2 production-pipeline needs to plan for full carousel volume on every order.
- Marketing line: "no extra fee for carousels" is a clean buying signal.
