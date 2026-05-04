# ADR 0012: Frameworks-by-name-of-framework, not by-name-of-marketer

**Status:** Accepted.
**Date:** 2026-05-04.
**Deciders:** Akinwunmi.

## Context

When designing the script frameworks bank, an obvious convention would be to anchor framework names to specific well-known marketers — "[Name]'s 4-step formula", "[Name]'s hook stack", "in the style of [Name]". This is how the marketing-skill ecosystem on the open web often labels these structures, because the structures are associated with the marketers who popularised them.

Two problems with that approach for Operscale:

1. **Style mimicry IP exposure.** Producing content "in the style of [named marketer]" sits in legally murky territory. Our customers don't want to ship content that could read as imitation of a specific public figure.
2. **Coupling to specific personalities.** The bank gets stuck mirroring whoever's currently popular in marketing-Twitter. We want a structural library that doesn't age with personalities.

## Decision

Frameworks in `docs/specs/script-frameworks.md` are named by their **structural pattern**, not by **marketer**:

- "DR Formula" (not "[Name]'s formula")
- "PAS" (not "[Name]'s PAS framework")
- "AIDA" (industry-standard initialism, no individual attribution)
- "Value Equation" (not "[Name]'s Value Equation" — the concept is widely-attributed, but our reference doesn't anchor to one person)
- "Hook Stack" (descriptive of the structure)
- "Anti-Trend" / "Open Loop" / "Specificity Stack" — descriptive terms

Where a framework has a strong association with a specific marketer in the wider ecosystem, the documentation acknowledges the structural pattern without naming individuals.

The AI brief analysis prompt is explicitly instructed: never produce scripts framed as "in the style of [person]". Style channeling stays anchored to the customer's own voice block (per `docs/specs/research-methodology.md`).

## Consequences

**Positive:**
- The bank ages well across marketing-personality cycles.
- No IP-grey-area exposure for customers.
- The AI's output stays anchored to the customer's voice, not external personalities.
- The framework descriptions stay focused on what the structure *does*, not who popularised it.

**Negative:**
- Some framework names are slightly less recognisable to people fluent in marketing-creator culture. (Mitigated: most names are descriptive enough to be understood by anyone.)
- We can't easily import framework banks from external marketing-skill libraries that name-drop heavily; we have to translate.

**Compensating mechanisms:**
- The framework descriptions in `docs/specs/script-frameworks.md` include hook patterns, structure breakdowns, and use cases — making each framework concretely usable without external reference.
- The awesomeskill.ai scriptwriting-methodology skill (per `skills.md`) is filtered through this convention before consumption.

## Cross-references

- `docs/specs/script-frameworks.md` — the framework bank with its naming conventions.
- `docs/specs/research-methodology.md` — voice channeling vs voice mimicry distinction.
- `docs/specs/content-types-allowed.md` — the no-fabrication rule that pairs with this.
- `skills.md` — the external skill library, filtered through these conventions.
- ADR 0010 — the no-fabrication rule.
- ADR 0011 — the deterministic seeding mechanism that uses these frameworks.
