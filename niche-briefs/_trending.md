# Niche brief: Trending topics (placeholder)

**Status:** Phase 2 placeholder. Not active in Phase 1.
**Activates when:** trending-topic scraper ships in Phase 2.
**Used by:** AI brief analysis prompt (Phase 2 only).
**Last updated:** 2026-05-04.

This document is a structural placeholder for the trending-topic data feed planned for Phase 2. Phase 1 does not consume this file in any active way — the AI brief analysis prompt explicitly does not reference it during Phase 1 generation.

The file exists in the V2 documentation set so that:

1. The schema and structure are documented before the scraper is built.
2. Phase 2 implementation has a known target shape.
3. The AI brief analysis prompt's V2 structure has the slot pre-defined, even though Phase 1 leaves it empty.

Per ADR 0013, **Phase 1 customer-facing copy does not promise trending-topic incorporation**. The product launches with framework + archetype variety as the personalisation mechanic. Trending topics activate only when Phase 2 ships and the customer-facing copy gets updated in the same release.

## 1. Planned structure (Phase 2)

When this file activates, it will be a periodically-rebuilt content file with the following sections, populated by an automated scraper running on the agent service:

```
# Niche brief: Trending topics

## Last updated: <timestamp>
## Window: <last N days>
## Sources: <list of platforms, hashtags, news feeds>

## By niche

### Beauty
- Trending hashtag 1 — context, sample post examples
- Trending angle 2 — context, why it's resonating
- Recurring conversation 3 — how brands are participating

### Real estate
- ...

### Fashion-ecom
- ...

### Fintech
- ...

### Health
- ...

### Food
- ...

### Education
- ...

## Cross-niche conversations
- Topics resonating across multiple niches
- Cultural moments worth referencing
- News events with relevant commentary opportunities

## What to skip
- Trending topics inappropriate for sponsored content
- Topics that violate the no-fabrication rule
- Topics that approach restricted-claim territory
```

## 2. Phase 2 integration plan

When the scraper ships:

1. The agent service runs the scraper on a 6-12 hour cadence.
2. The scraper writes to this file with a timestamped header.
3. The AI brief analysis prompt incorporates this file when active (controlled by a `TRENDING_ENABLED` config flag).
4. The framework × archetype selection adds a "trending tie-in" weighting where applicable.
5. Customer-facing copy on the marketing site adds: *"Optionally tied to trending conversations in your niche, refreshed every 12 hours."*

ADR 0013 covers the deferral; a future ADR will cover the activation.

## 3. Until then

This file remains a static placeholder. The AI brief analysis prompt explicitly does not load it during Phase 1. The customer-facing language about trending content stays unmade until the feature ships.

## 4. Cross-references

- `docs/adr/0013-trending-deferred-to-phase-2.md` — the deferral ADR.
- `docs/specs/ai-brief-analysis.md` — where this file will plug in (Phase 2).
- `docs/specs/research-methodology.md` — the methodology that will incorporate trending data when active.
