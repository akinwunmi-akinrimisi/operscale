# ADR 0011: Deterministic per-customer framework × archetype seeding

**Status:** Accepted.
**Date:** 2026-05-04.
**Deciders:** Akinwunmi.

## Context

Phase 1 commits to producing content that is meaningfully different across customers and across orders for the same returning customer. Without an explicit mechanism, an AI generator with the same prompt and similar customer corpus tends to produce structurally similar output — same hook patterns, same archetype, same script arc. Two beauty customers in the same week would risk getting recognisably similar calendars; a returning customer's third order would risk re-using the same patterns as their first.

The product's premise is *personalisation* — at three tiers and growing customer base, generic AI output undermines the proposition.

## Decision

Every customer's brief analysis runs through a deterministic seed system that:

1. Computes a seed from `(customer_id, niche, order_index, submission_week_iso)`.
2. Selects N frameworks and N archetypes from the 25-framework × 25-archetype banks.
3. Excludes any (framework, archetype) pair already used in this customer's history.
4. Sorts available pairs by niche-affinity, then by deterministic seed-driven order.
5. Stores the selection in `analysis_runs.framework_seed` (JSONB column).
6. Records approved selections in `customer_framework_history` (separate table) on founder approval.

Per-tier counts: Starter 3×3, Standard 5×5, Calendar 8×8.

When the customer's available pool drops below `2 × max(N)`, an exhaustion warning fires in the CRM. When it drops below the required count, the system uses LRU fallback (least-recently-used pairs from history are reused).

Re-analyses come in two modes:
- "Same frameworks" — re-runs AI with the existing seed.
- "New frameworks" — rotates the seed via a re-analysis salt.

Approved selections (and only approved selections) burn pairs from the bank — re-analyses don't burn until one is approved.

The full mechanism lives in `docs/specs/non-duplication-system.md`.

## Consequences

**Positive:**
- Cross-customer uniqueness within a niche is guaranteed.
- Per-customer freshness across orders is guaranteed (until exhaustion at ~9 Calendar orders).
- Every selection is reproducible from inputs (auditable).
- The two re-analyze modes give the founder fine control over what gets retried.

**Negative:**
- A new schema column (`framework_seed`) and a new table (`customer_framework_history`) — minor schema growth.
- Estimated input-token cost increase of 30-50% on the AI brief analysis call (~$1.50/month at 30 orders), because the prompt now includes selected frameworks/archetypes context.
- Bank exhaustion at ~9 Calendar orders requires the LRU fallback; expanding the bank requires deliberate doc + ADR work.

**Compensating mechanisms:**
- The bank exhaustion warning gives the founder lead time to expand frameworks/archetypes before any customer hits the LRU fallback.
- The deterministic algorithm is pure-function and unit-testable.
- The seed inputs are stable across re-runs, so re-analyzing always produces consistent results in same-frameworks mode.

## Cross-references

- `docs/specs/non-duplication-system.md` — the full mechanism.
- `docs/specs/script-frameworks.md` — the bank of 25 frameworks.
- `docs/specs/angle-archetypes.md` — the bank of 25 archetypes.
- `docs/data-model.md` — the schema columns and tables.
- `docs/specs/founder-review-flow.md` — how the two re-analyze modes integrate with the CRM.
- ADR 0010 — the no-fabrication rule that constrains every selection.
