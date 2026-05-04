# ADR 0010: No-fabrication content rule

**Status:** Accepted.
**Date:** 2026-05-04.
**Deciders:** Akinwunmi.

## Context

Operscale Calendar produces content on behalf of customers who never sit for a content interview. The intake corpus is the form payload, optional reference posts, optional photos, and the niche brief. Without guardrails, an AI generator can produce confident-sounding content that includes invented founder origin stories, fabricated customer testimonials, and made-up biographical anecdotes — all of which would harm the customer (their voice, mis-stated), their audience (claims they didn't make, served as fact), and Operscale (reputational exposure indistinguishable from a content mill).

The risk isn't theoretical; the AI's training distribution rewards founder-narrative storytelling and customer-transformation arcs in marketing content. Without an explicit constraint, the system drifts toward those patterns by default.

## Decision

We enforce a no-fabrication rule across all content generation:

1. **Scripts make content about the customer's business — not invented content from the customer's biography.** Specifically:
   - No founder origin stories beyond what the customer explicitly typed in form step 6.
   - No customer testimonials, transformation arcs, or specific named-customer narratives unless the customer provided documented consent.
   - No family or cultural personal background ("my mum taught me", "my grandmother's recipe") unless customer-stated.
   - No specific event narratives ("three years ago I almost lost...") unless customer-stated.
   - No specific past-employer claims unless customer-stated.

2. **First-person opinion content stays IN.** Defensible opinions ("in my experience", "the way I see it") are allowed because they convey expertise without claiming biography.

3. **Generic numbers as authority signal stay IN.** "After hundreds of inspections..." / "across the businesses we've worked with..." are allowed when the customer's business plausibly supports the implied scope.

4. **The rule is enforced at three checkpoints:**
   - AI brief analysis prompt (system prompt enforcement + per-line audit).
   - Founder review CRM (visible flags, manual confirmation required for any flagged line).
   - Customer-facing marketing copy (sets expectations honestly).

The full rule and edge cases live in `docs/specs/content-types-allowed.md`. Every framework and archetype documents its own no-fabrication notes. Every niche brief includes a no-fabrication-specific-to-this-niche section.

## Consequences

**Positive:**
- Customers receive content they could actually publish without being misrepresented.
- Audiences receive content with honest claims.
- Operscale's reputation has a defensible position that scales (no fabrication = no quiet PR risk that compounds with volume).
- The constraint forces stronger educational, pricing-transparency, and process-tour content — which is what actually performs in Nigerian SMB marketing anyway.

**Negative:**
- Some topics that would be easy to write fabricated versions of (founder transformation arcs, customer testimonials) are off the table without consent flow.
- Customers who expected origin-story content are mildly disappointed; mitigated by upfront marketing copy.
- The AI prompt is meaningfully longer and more constrained, increasing token costs by an estimated 30-50%.

**Compensating mechanisms:**
- The framework × archetype variety system (ADR 0011) ensures content stays personalised despite the constraint.
- The AI brief analysis methodology (`docs/specs/research-methodology.md`) extracts more grounded specifics from the corpus, making content feel personal even without biography.
- The founder review CRM catches any AI drift.

## Cross-references

- `docs/specs/content-types-allowed.md` — the canonical rule.
- `docs/specs/script-frameworks.md` — every framework's no-fabrication notes.
- `docs/specs/angle-archetypes.md` — every archetype's no-fabrication notes.
- ADR 0011 — the deterministic per-customer seeding that ensures variety under this constraint.
- ADR 0012 — frameworks-by-name-of-framework, not by-name-of-marketer.
