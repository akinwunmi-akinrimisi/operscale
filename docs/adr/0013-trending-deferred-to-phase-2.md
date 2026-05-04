# ADR 0013: Trending-topic incorporation deferred to Phase 2

**Status:** Accepted.
**Date:** 2026-05-04.
**Deciders:** Akinwunmi.

## Context

A natural feature for a content calendar product is "incorporates trending topics in your niche" — the AI generates content that ties into current cultural conversations rather than producing only evergreen material. This was considered for Phase 1 inclusion.

Two problems prevent Phase 1 inclusion:

1. **No scraper.** Phase 1's tech stack does not include a trending-topic scraper. Building one (sources, deduplication, niche tagging, refresh cadence, restricted-content filtering) is its own meaningful project — not in the Phase 1 22-day plan in `docs/implementation.md`.

2. **Promising what we can't deliver erodes the launch.** Customer-facing copy that promises trending content but produces only evergreen content is a credibility leak from day one. Better to launch with framework + archetype variety as the personalisation mechanic and add trending later honestly.

The launch timing offers a clean exit: Operscale Calendar does not launch publicly until Phase 2 ships anyway. The trending feature lands when Phase 2 lands, paired with the customer-facing copy that promises it.

## Decision

Phase 1 of the documentation set (this V2 migration) prepares the structural slot for trending content but does not enable it:

1. **`niche-briefs/_trending.md`** — created as a placeholder with the planned schema. The AI brief analysis prompt explicitly does not load this file in Phase 1.

2. **`docs/specs/ai-brief-analysis.md`** — the prompt structure has a slot for `trending_context` block that is empty in Phase 1. Phase 2 populates it.

3. **`docs/specs/research-methodology.md`** — the four-lens methodology will gain a fifth lens (trending-tie-in) when Phase 2 activates. The current four lenses are sufficient for Phase 1.

4. **Customer-facing copy** — uses the line: *"Personalised content for your business using proven copywriting frameworks."* No trending claim.

5. **Marketing site, brief email, pricing page, form copy** — none promise trending content in Phase 1. Phase 2 release updates copy in the same release as the scraper ships.

When Phase 2 ships:
- Scraper service activates, populating `niche-briefs/_trending.md` on a 6-12 hour cadence.
- AI brief analysis prompt's `trending_context` slot populates from the file.
- Customer-facing copy gets a copy-update PR alongside the feature release.
- A future ADR records the activation.

## Consequences

**Positive:**
- Phase 1 launch credibility — we deliver exactly what we promise.
- Trending feature ships when it's actually ready, not as a half-built attempt.
- The scraper is built once, properly, with restricted-content filtering, instead of being shoehorned into the Phase 1 timeline.
- Customer-facing copy stays honest from day one.

**Negative:**
- Some marketing positioning that "trending content" would have unlocked is unavailable in Phase 1.
- Competitors who claim trending content (truthfully or otherwise) can position against us in this dimension.

**Compensating mechanisms:**
- The framework × archetype variety system (ADR 0011) provides the personalisation differentiation without trending.
- The depth of customer-corpus grounding (`docs/specs/research-methodology.md`) makes content feel personal even without external trending hooks.
- When trending ships in Phase 2, it's an additive upgrade — existing customers' calendars become more current rather than the product's premise changing.

## Cross-references

- `niche-briefs/_trending.md` — the placeholder file with planned schema.
- `docs/specs/ai-brief-analysis.md` — the prompt structure with the empty trending slot.
- `docs/specs/research-methodology.md` — the four-lens methodology.
- ADR 0010 — the no-fabrication rule (which trending content must also obey).
- ADR 0011 — the deterministic seeding mechanism that does the personalisation work in Phase 1.
