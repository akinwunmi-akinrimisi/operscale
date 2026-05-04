# Non-duplication system

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Used by:** AI brief analysis prompt, founder review CRM, schema, every framework and archetype reference.
**Last updated:** 2026-05-04.

This document specifies the mechanism that guarantees no two customers — and no two orders from the same returning customer — receive the same combination of script frameworks and angle archetypes. It pairs with `docs/specs/script-frameworks.md` (the bank of 25 frameworks), `docs/specs/angle-archetypes.md` (the bank of 25 archetypes), and `docs/specs/ai-brief-analysis.md` (the prompt that consumes the selections).

The mechanism has four layers: a deterministic seed, an exclusion list per customer, a least-recently-used fallback when the bank exhausts, and a re-analyze rotation when the founder asks for different angles.

## 1. The non-duplication guarantees

Phase 1 commits to three guarantees:

**Guarantee A — Cross-customer uniqueness within a niche.** Two different customers in the same niche, ordering in the same week, never receive the same combination of frameworks and archetypes.

**Guarantee B — Per-customer freshness across orders.** A returning customer's second, third, fourth (etc.) order never reuses a framework × archetype pair from any of their previous orders, until the bank exhausts.

**Guarantee C — Auditability.** Every selection is reproducible from inputs. Given a customer ID, a niche, and an order index, you can recompute exactly which frameworks and archetypes were chosen, and you can identify why.

These guarantees are non-negotiable. If a code change breaks any of them, the change ships without a doc update — meaning it's already wrong per `CONTRIBUTING.md` rule #1.

## 2. The deterministic seed

The selection is driven by a hash that incorporates four inputs:

```
seed_input = customer_id + "::" + niche + "::" + order_index + "::" + submission_week_iso
seed = sha256(seed_input)
```

Where:

- **customer_id** — the UUID of the customer in the `customers` table.
- **niche** — the lowercased niche slug (e.g. `beauty`, `real_estate`, `fashion`, `fintech`, `health`, `food`, `education`).
- **order_index** — 1 for the customer's first order, 2 for the second, and so on. Computed from `select count(*) + 1 from orders where customer_id = $1`.
- **submission_week_iso** — the ISO week (e.g. `2026-W18`) of `briefs.submitted_at` in WAT.

The seed is stored as `analysis_runs.framework_seed` (a hex string) at analysis time. It's also written to `activity_log` for audit.

Why these four inputs:

- `customer_id` ensures different customers get different seeds.
- `niche` is included even though it's redundant for any one customer — it makes the seed describable in plain language ("this customer's first beauty order from week 18, 2026").
- `order_index` ensures a returning customer's nth order differs from their (n-1)th.
- `submission_week_iso` rotates the available pool over time, so popular frameworks don't get permanently burned across all customers in a week.

## 3. The selection algorithm

For a given `(customer_id, niche, order_index, submission_week_iso)`:

```
seed = sha256(customer_id + "::" + niche + "::" + order_index + "::" + submission_week_iso)

# Fetch this customer's history of used framework × archetype pairs.
used_pairs = SELECT (framework_slot, archetype_slot)
             FROM customer_framework_history
             WHERE customer_id = $1

# Bank state.
all_frameworks = [25 frameworks from docs/specs/script-frameworks.md]
all_archetypes = [25 archetypes from docs/specs/angle-archetypes.md]

# Required counts by tier.
N_frameworks = {Starter: 3, Standard: 5, Calendar: 8}[order.tier]
N_archetypes = {Starter: 3, Standard: 5, Calendar: 8}[order.tier]

# Pre-filter: build the available pool of pairs that haven't been used.
all_pairs = cross_product(all_frameworks, all_archetypes)  # 625 pairs total
available_pairs = all_pairs - used_pairs

# Affinity score: each pair has a score from the niche × framework matrix
# (script-frameworks.md section 9) and the niche × archetype matrix
# (angle-archetypes.md section 8). High = 3, Med = 2, Low = 1.
# Combination affinity = framework_affinity × archetype_affinity.

# Sort available pairs by affinity descending, then by deterministic seed-driven order.
available_pairs_sorted = sort(
  available_pairs,
  by=(affinity_for_niche desc, hash(seed + pair_id) asc)
)

# Selection: take top N_frameworks unique frameworks and N_archetypes unique archetypes
# from the sorted list, ensuring we hit the count without duplicating a framework or archetype.
selected_pairs = []
seen_frameworks = set()
seen_archetypes = set()

for pair in available_pairs_sorted:
  if pair.framework not in seen_frameworks or pair.archetype not in seen_archetypes:
    selected_pairs.append(pair)
    seen_frameworks.add(pair.framework)
    seen_archetypes.add(pair.archetype)
  if len(seen_frameworks) >= N_frameworks and len(seen_archetypes) >= N_archetypes:
    break

# selected_pairs now contains enough unique frameworks and archetypes.
```

This algorithm guarantees:

- **Determinism**: same inputs → same outputs.
- **Uniqueness within a customer**: pairs from history are excluded.
- **Affinity-aware**: high-niche-fit pairings come first.
- **Cross-customer variation**: different `customer_id` produces different sort order via the hash, so two customers in the same niche get different selections even from the same affinity tier.

## 4. The customer_framework_history table

A small table tracks every (framework, archetype) pair ever delivered to a customer:

```sql
create table customer_framework_history (
  customer_id     uuid not null references customers(id) on delete restrict,
  order_id        uuid not null references orders(id) on delete restrict,
  framework_slot  text not null,
  archetype_slot  text not null,
  used_at         timestamptz default now(),
  primary key (customer_id, framework_slot, archetype_slot)
);

create index customer_framework_history_customer_idx
  on customer_framework_history (customer_id);

create index customer_framework_history_order_idx
  on customer_framework_history (order_id);
```

**When rows are written.** When the founder approves an analysis (`founder_approved` event), the trigger writes one row per `(framework, archetype)` pair from the approved analysis run. Rows are NOT written on initial AI analysis — only on founder approval. This means re-analyses don't burn pairs from the bank; only delivered selections do.

**Primary key choice.** `(customer_id, framework_slot, archetype_slot)` enforces that the same pair never repeats for the same customer. If the algorithm ever tries to select an already-used pair, the INSERT fails on the unique constraint and the application code handles the conflict gracefully (logs warning, picks the next-best available pair).

**ON DELETE RESTRICT.** A customer's history outlives their account. NDPC deletion (per `docs/data-model.md` section 9) anonymises history rather than dropping it — the framework slots stay, the customer_id is anonymised so the customer can't be re-identified. This keeps the bank-exhaustion analytics valid even after deletion requests.

## 5. The framework_seed column on analysis_runs

The selection result is stored on the analysis run itself:

```sql
alter table analysis_runs add column framework_seed jsonb;

-- Example contents:
{
  "seed_hash": "abc123...",
  "seed_inputs": {
    "customer_id": "uuid",
    "niche": "beauty",
    "order_index": 2,
    "submission_week_iso": "2026-W18"
  },
  "selected_frameworks": ["DR_FORMULA", "QUICK_WIN", "PATTERN_INTERRUPT", "COST_REVEAL", "MYTH_BUSTER"],
  "selected_archetypes": ["PRICING_BREAKDOWN", "QUALITY_TELLS", "CATEGORY_MYTH", "PRODUCT_TOUR", "INSIDER_CHECKLIST"],
  "selected_pairs": [
    {"framework": "DR_FORMULA", "archetype": "PRICING_BREAKDOWN", "affinity": 9},
    {"framework": "COST_REVEAL", "archetype": "PRICING_BREAKDOWN", "affinity": 9},
    ...
  ],
  "exhaustion_warning": false,
  "lru_fallback_used": false
}
```

This makes every analysis fully auditable. The CRM displays it for the founder. The AI prompt consumes it. Phase 2 production reads it to know what frameworks each script in the calendar uses.

## 6. Bank exhaustion

The total bank size is 25 frameworks × 25 archetypes = 625 unique pairs. A Calendar-tier customer uses 64 pairs per order. So a customer can do ~9 Calendar orders before exhaustion (or ~25 Starter orders, ~25 Standard orders, since framework and archetype counts are per-tier).

When a customer's `available_pairs` count drops below `2 × max(N_frameworks, N_archetypes)`, the system fires a warning. When it drops below the actual required count, the system invokes the LRU fallback.

### 6.1 Exhaustion warning

When `available_pairs.count < 2 × max(N_frameworks, N_archetypes)`:

1. The AI brief analysis output includes a `bank_exhaustion_warning` field.
2. The CRM Pending Review queue shows an orange flag on the customer's row.
3. The CRM review screen shows a banner: *"This customer has used [N]/[total] pairs in the framework × archetype bank. Approving this brief uses [M] more pairs. Consider expanding the bank or planning manual handling for future orders."*
4. An `activity_log` event is written: `event_type = 'bank_exhaustion_warning'`, `payload = {customer_id, used: N, total: 625, this_order_uses: M}`.

The warning is informational. The brief still proceeds normally.

### 6.2 LRU fallback

When `available_pairs.count < required count`:

1. The selection algorithm switches to LRU mode.
2. It pulls the *least-recently-used* pairs from the customer's history (i.e. those used longest ago).
3. The number of LRU pairs reused is the gap between available and required.
4. The `framework_seed.lru_fallback_used` flag is set to true.
5. The `framework_seed.lru_pairs_reused` field lists the specific pairs.
6. The CRM banner upgrades: *"This customer has exhausted the bank. The AI selected [X] new pairs and [Y] least-recently-used pairs from previous orders. Last reuse of these pairs was N orders ago."*
7. Activity log: `event_type = 'bank_exhausted_lru_fallback'`, `payload = {pairs_reused: [...]}`.

The LRU fallback is the safety net. Customers who hit it are extremely loyal repeat customers — Phase 1 doesn't expect to see this, but if it happens, the system handles gracefully rather than failing.

### 6.3 What to do when exhaustion becomes common

If multiple customers hit exhaustion warnings within a quarter, that's a signal to expand the bank. The path:

1. Add new frameworks to `docs/specs/script-frameworks.md` (target: 5-10 new).
2. Add new archetypes to `docs/specs/angle-archetypes.md` (target: 5-10 new).
3. Update affinity matrices.
4. Bump `FRAMEWORKS_TOTAL` and `ARCHETYPES_TOTAL` constants in this doc and the application config.
5. Existing customers' history is unchanged — they immediately have fresh pairs available.

ADR recorded for any bank expansion.

## 7. Re-analyze handling

The CRM founder review screen has two re-analyze buttons:

- **"Re-analyze (same frameworks)"** — keeps the same `framework_seed`, asks the AI to produce a different output using the same frameworks/archetypes. Useful when the founder thinks the frameworks were right but the *execution* was off.
- **"Re-analyze (new frameworks)"** — rotates the seed by incrementing a re-analysis counter, asks the AI to produce output with a fresh selection. Useful when the founder thinks the frameworks themselves were wrong for this customer.

The mechanism for each:

### 7.1 Re-analyze (same frameworks)

The new `analysis_runs` row has:

- Same `framework_seed.selected_frameworks`.
- Same `framework_seed.selected_archetypes`.
- Same `framework_seed.selected_pairs`.
- New `run_index` (incremented).
- `trigger_type = 're_analyze_same_frameworks'`.
- `founder_note` populated.

The AI prompt receives the same framework/archetype context but is told: *"Previous output for this brief used these frameworks but the founder requested a different execution. Specifically: {founder_note}. Produce a different output using the same frameworks."*

### 7.2 Re-analyze (new frameworks)

The seed is regenerated with a salt:

```
new_seed_input = customer_id + "::" + niche + "::" + order_index + "::"
                 + submission_week_iso + "::reanalyze::" + new_run_index
new_seed = sha256(new_seed_input)
```

This produces a fresh selection from `available_pairs` (excluding pairs already chosen in any prior run for this brief, plus all pairs from the customer's history).

The new `analysis_runs` row has:

- Different `framework_seed.selected_frameworks`.
- Different `framework_seed.selected_archetypes`.
- Different `framework_seed.selected_pairs`.
- New `run_index`.
- `trigger_type = 're_analyze_new_frameworks'`.
- `founder_note` populated.

### 7.3 Discard

If the founder discards entirely (`founder_discarded` event), no rows are written to `customer_framework_history` for any of the runs. The discarded brief doesn't burn pairs.

### 7.4 Approval

When the founder approves any analysis run, only the `selected_pairs` of *that specific run* get written to `customer_framework_history`. Pairs from earlier (rejected) runs of the same brief don't burn — only the approved one.

This is critical: a brief that goes through 3 re-analyses before approval only consumes the pairs from the final approved run, not all 3 attempts.

## 8. The audit trail

For every analysis run, the system writes:

- `analysis_runs` row with `framework_seed` JSONB column.
- `activity_log` row with `event_type = 'ai_analysis_completed'`, `payload = {run_index, frameworks: [...], archetypes: [...]}`.
- `llm_calls` row with `purpose = 'brief_analysis_initial'` or `'brief_analysis_reanalyze_same'` or `'brief_analysis_reanalyze_new'`.

For every approval:

- `customer_framework_history` rows (one per pair).
- `activity_log` row with `event_type = 'founder_approved'`, `payload = {analysis_run_id, edits_count, pairs_burned: [...]}`.

For every exhaustion event:

- `activity_log` row with `event_type = 'bank_exhaustion_warning'` or `'bank_exhausted_lru_fallback'`.

This trail makes it possible to answer auditing questions like:

- "Why did this customer get the Cost Reveal framework?" (Look at `analysis_runs.framework_seed`.)
- "Has this customer ever had the Pricing Breakdown archetype before?" (Query `customer_framework_history`.)
- "How many pairs has this customer used across all orders?" (Count from `customer_framework_history` where `customer_id = X`.)
- "Which frameworks are getting selected most across all customers?" (Aggregate from all `analysis_runs.framework_seed`.)

## 9. Edge cases

### 9.1 First-time customer

`order_index = 1`. `customer_framework_history` has zero rows for this customer. The selection algorithm runs with the full bank available. Standard flow.

### 9.2 Returning customer's nth order

`order_index = n`. `customer_framework_history` has rows from orders 1 through n-1. The selection excludes those pairs. If `available_pairs` is still large, standard flow. If it's getting thin, exhaustion warning. If it's exhausted, LRU fallback.

### 9.3 Customer requests deletion (NDPC)

Per `docs/data-model.md` section 9: `customer_framework_history.customer_id` gets anonymised (set to a sentinel UUID like `00000000-0000-0000-0000-000000000000`). The pair history isn't lost — it just isn't tied to a specific customer anymore. If that customer somehow returns later (unlikely; they'd be a new customer with a new email), they start fresh because their new `customer_id` has zero history.

### 9.4 Customer changes niche between orders

A customer who ordered as "fashion" on order 1 and "beauty" on order 2 has separate seed inputs (because `niche` is part of the seed). Their history is shared across niches, so a pair burned on the fashion order isn't available for the beauty order. This is intentional: variety beats niche-fitting when the customer is genuinely active across niches.

### 9.5 Two customers submit at the exact same time

Different `customer_id`, same `submission_week_iso`. Different seeds. Different selections. No collision. Even with identical niches and identical tiers, the different `customer_id` ensures different sort order in the affinity-sorted available pool.

### 9.6 The same customer submits two briefs in the same week

Each brief gets a separate `order_index` (incremented from the customer's prior order count). Different seeds. Different selections.

### 9.7 The AI fails repeatedly on a brief and the founder writes the brief manually

The manual brief doesn't go through the framework × archetype selection. No seed is computed; no pairs are burned. The order proceeds without history accumulation for that order. ADR consideration: do we want manual briefs to also burn from the bank? Phase 1 says no — manual briefs are a special case and shouldn't constrain the bank.

## 10. The application implementation surface

The selection logic lives in `apps/agent/src/lib/framework-selector.ts`. Pseudocode:

```typescript
interface FrameworkSeedInputs {
  customer_id: string;
  niche: string;
  order_index: number;
  submission_week_iso: string;
}

interface FrameworkSeedResult {
  seed_hash: string;
  seed_inputs: FrameworkSeedInputs;
  selected_frameworks: FrameworkSlot[];
  selected_archetypes: ArchetypeSlot[];
  selected_pairs: { framework: FrameworkSlot; archetype: ArchetypeSlot; affinity: number }[];
  exhaustion_warning: boolean;
  lru_fallback_used: boolean;
  lru_pairs_reused?: { framework: FrameworkSlot; archetype: ArchetypeSlot; last_used_at: string }[];
}

async function selectFrameworksForBrief(
  inputs: FrameworkSeedInputs,
  tier: 'starter' | 'standard' | 'calendar',
  reanalyze_mode?: 'same_frameworks' | 'new_frameworks',
  prior_run?: AnalysisRun,
): Promise<FrameworkSeedResult>;

async function recordApprovedSelection(
  customer_id: string,
  order_id: string,
  pairs: { framework: FrameworkSlot; archetype: ArchetypeSlot }[],
): Promise<void>;
```

The function is pure given its inputs (no side effects beyond the optional history insert), which makes it unit-testable. Test cases live in `apps/agent/src/lib/framework-selector.test.ts`:

- First-time customer gets the highest-affinity pairs.
- Returning customer's pairs exclude history.
- Exhaustion warning fires at the right threshold.
- LRU fallback selects the right pairs.
- Re-analyze with same frameworks preserves the selection.
- Re-analyze with new frameworks rotates the selection.
- Two customers in the same niche/week get different selections.
- The hash is deterministic across runs.

## 11. What this system does NOT do

- **Does not optimize for engagement / virality.** The system optimizes for variety and freshness. Engagement performance is a Phase 2+ concern that may eventually feed back into affinity weights.
- **Does not learn from outcome data.** Phase 1 has no engagement-feedback loop. Selection is rule-based, not learned.
- **Does not allow customers to pick frameworks.** Customers don't see frameworks. Per `docs/specs/content-types-allowed.md`, the customer-facing language is "personalised content using proven copywriting frameworks" — internal mechanisms stay internal.
- **Does not allow founders to pick frameworks at the slot level.** Founders can re-analyze with new frameworks (rotates the entire selection) or re-analyze with same frameworks (keeps the selection). They can't say "swap Quick-Win for Numbered List" — that's over-engineering for Phase 1. (Phase 2+ may add this control.)
- **Does not guarantee one framework per video position.** A 30-day Calendar uses 8 frameworks across 30 videos — meaning each framework drives ~4 videos with different archetypes. The framework-to-video assignment happens in Phase 2 production, not in selection.

## 12. Cross-references

- `docs/specs/script-frameworks.md` — the bank of 25 frameworks.
- `docs/specs/angle-archetypes.md` — the bank of 25 archetypes.
- `docs/specs/ai-brief-analysis.md` — the prompt that consumes the selection.
- `docs/specs/research-methodology.md` — the methodology for sourcing material that the selected frameworks/archetypes wrap.
- `docs/specs/content-types-allowed.md` — the no-fabrication rule that constrains every selection.
- `docs/specs/founder-review-flow.md` — the CRM flow that uses the two re-analyze buttons.
- `docs/data-model.md` — the schema for `analysis_runs.framework_seed` and `customer_framework_history`.
- `docs/runbooks/crm-runbook.md` — the operator's guide for handling exhaustion warnings and LRU fallbacks.
- `docs/adr/0011-deterministic-per-customer-seeding.md` — the ADR.
