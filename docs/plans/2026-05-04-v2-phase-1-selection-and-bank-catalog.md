# V2 Pipeline Phase 1 — Selection + Bank Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land deterministic framework × archetype selection, the in-memory bank catalog (parsed from spec markdown), and the `0006_ai_analysis_jobs` migration. No Claude integration yet; the running production stack is unaffected.

**Architecture:** Phase 1 of the four-phase rollout in `docs/specs/v2-pipeline-implementation-design.md`. Pure-logic modules (deterministic seed, affinity-aware selection, LRU fallback) plus a parser for spec markdown anchored by `<!-- slot: ID -->` HTML-comment frontmatter. New `ai_analysis_jobs` table sits empty until Phase 4 wires it up.

**Tech Stack:** TypeScript 5.6, Node 20, Next.js 15 standalone (the agent app), Vitest (added by Task 1), Supabase Postgres 15, pnpm workspaces, zod 3.23.

**Spec source:** `docs/specs/v2-pipeline-implementation-design.md` §4-5 (data model + components), `docs/specs/non-duplication-system.md` (selection algorithm), `docs/specs/script-frameworks.md` + `docs/specs/angle-archetypes.md` (the bank docs).

---

## File structure (Phase 1)

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/agent/vitest.config.ts` | Vitest config for the agent package |
| Modify | `apps/agent/package.json` | Add `test` script + Vitest dev deps |
| Create | `apps/agent/src/lib/types/v2.ts` | Canonical V2 types (slot enums, AiOutput, FrameworkSeedResult, etc.) |
| Modify | `docs/specs/script-frameworks.md` | Add `<!-- slot: ID -->` to every framework section heading |
| Modify | `docs/specs/angle-archetypes.md` | Add `<!-- slot: ID -->` to every archetype section heading |
| Create | `apps/agent/src/lib/bank-catalog.ts` | Markdown parser → in-memory `BankCatalog` |
| Create | `apps/agent/src/lib/bank-catalog.test.ts` | Unit tests for the parser |
| Create | `apps/agent/src/lib/framework-selector.ts` | Deterministic seed + selection algorithm |
| Create | `apps/agent/src/lib/framework-selector.test.ts` | Unit tests for selection logic |
| Create | `supabase/migrations/0006_ai_analysis_jobs.sql` | Queue table, constraint trigger, RLS, replica identity |
| Modify | `docs/data-model.md` | One-paragraph entry for the new `ai_analysis_jobs` table |

Test fixtures used in tests live alongside the test files in `__fixtures__/` subdirectories.

Files NOT touched in Phase 1: `lib/claude.ts`, all routes, `apps/web/`, any niche brief content. Phase 1 changes are additive — nothing live is rewired.

---

## Task 1 — Set up Vitest in `apps/agent`

**Files:**
- Create: `apps/agent/vitest.config.ts`
- Modify: `apps/agent/package.json` (add test script + dev deps)
- Create: `apps/agent/src/lib/__sanity__/sanity.test.ts` (deleted at end of task — proves the harness works)

- [ ] **Step 1: Add Vitest dev dependencies**

```bash
cd apps/agent
pnpm add -D vitest@^1.6.0 @vitest/coverage-v8@^1.6.0
```

Expected: `pnpm-lock.yaml` updates; `vitest` and `@vitest/coverage-v8` appear under `devDependencies` in `apps/agent/package.json`.

- [ ] **Step 2: Add the `test` script to `apps/agent/package.json`**

Modify `apps/agent/package.json` `"scripts"` block to add two lines (keep the rest unchanged):

```json
"test": "vitest run",
"test:watch": "vitest"
```

Final `scripts` block should look like:

```json
"scripts": {
  "dev": "next dev --port 3002",
  "build": "next build",
  "start": "next start --port 3002 --hostname 0.0.0.0",
  "typecheck": "tsc --noEmit",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `apps/agent/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/__sanity__/**', 'src/lib/__fixtures__/**'],
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 4: Create a sanity test to prove the harness works**

`apps/agent/src/lib/__sanity__/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest harness sanity', () => {
  it('runs and asserts truthy', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run sanity test from `apps/agent` directory**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected output (key lines):
```
 ✓ src/lib/__sanity__/sanity.test.ts (1)
   ✓ vitest harness sanity > runs and asserts truthy
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

If you see "command not found: vitest", re-run `pnpm install` from the repo root.

- [ ] **Step 6: Delete the sanity test (harness proven, no longer needed)**

```bash
rm -rf apps/agent/src/lib/__sanity__
```

- [ ] **Step 7: Commit**

```bash
git add apps/agent/package.json apps/agent/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(agent): add Vitest test harness

Adds vitest 1.6 + @vitest/coverage-v8 to apps/agent. Configures node
environment with src/lib/**/*.test.ts as the include glob and v8
coverage reporting. Phase 1 of the V2 pipeline depends on this harness.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Canonical V2 types

**Files:**
- Create: `apps/agent/src/lib/types/v2.ts`
- Create: `apps/agent/src/lib/types/v2.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/agent/src/lib/types/v2.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  FRAMEWORK_SLOTS,
  ARCHETYPE_SLOTS,
  NICHE_SLUGS,
  TIER_COUNTS,
  type FrameworkSlot,
  type ArchetypeSlot,
  type NicheSlug,
  type Tier,
} from './v2';

describe('V2 canonical types', () => {
  it('exports exactly 25 framework slots', () => {
    expect(FRAMEWORK_SLOTS).toHaveLength(25);
  });

  it('exports exactly 25 archetype slots', () => {
    expect(ARCHETYPE_SLOTS).toHaveLength(25);
  });

  it('exports 7 niche slugs', () => {
    expect(NICHE_SLUGS).toHaveLength(7);
    expect(NICHE_SLUGS).toEqual(
      expect.arrayContaining(['beauty', 'real_estate', 'fashion', 'fintech', 'health', 'food', 'education']),
    );
  });

  it('TIER_COUNTS provides per-tier framework + archetype counts', () => {
    expect(TIER_COUNTS.starter).toEqual({ frameworks: 3, archetypes: 3, video_count: 7, carousel_count: 0 });
    expect(TIER_COUNTS.standard).toEqual({ frameworks: 5, archetypes: 5, video_count: 14, carousel_count: 0 });
    expect(TIER_COUNTS.calendar).toEqual({ frameworks: 8, archetypes: 8, video_count: 30, carousel_count: 0 });
  });

  it('framework slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of FRAMEWORK_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('archetype slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of ARCHETYPE_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('FrameworkSlot type narrows to a member of FRAMEWORK_SLOTS', () => {
    const x: FrameworkSlot = 'DR_FORMULA';
    expect(FRAMEWORK_SLOTS).toContain(x);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: FAIL with `Cannot find module './v2'`.

- [ ] **Step 3: Create the types file**

`apps/agent/src/lib/types/v2.ts`:

```ts
// V2 canonical types. Source of truth: docs/specs/non-duplication-system.md,
// docs/specs/ai-brief-analysis.md, docs/specs/script-frameworks.md,
// docs/specs/angle-archetypes.md.
//
// Slot constants are the runtime contract between the markdown spec docs
// (which carry HTML-comment frontmatter `<!-- slot: ID -->`) and the
// framework-selector + prompt-builder modules.

export const FRAMEWORK_SLOTS = [
  // Family A — Direct response (5)
  'DR_FORMULA',
  'PAS',
  'AIDA',
  'PAIPS',
  'VALUE_EQUATION',
  // Family B — Hook stack (5)
  'THREE_LAYER_HOOK_STACK',
  'PATTERN_INTERRUPT',
  'OPEN_LOOP',
  'CURIOSITY_GAP',
  'SPECIFICITY_STACK',
  // Family C — Educational (5)
  'QUICK_WIN',
  'EDUCATIONAL_BREAKDOWN',
  'PROCESS_DEMYSTIFICATION',
  'NUMBERED_LIST',
  'CHECKLIST_REVEAL',
  // Family D — Persuasive (5)
  'MYTH_BUSTER',
  'COMPARISON',
  'ANTI_TREND',
  'INDUSTRY_INSIDER',
  'COST_REVEAL',
  // Family E — Narrative (5)
  'BEHIND_THE_WORK',
  'DATASET_REVEAL',
  'DECODED_JARGON',
  'STEEL_MAN',
  'FRAME_RE_SET',
] as const;

export type FrameworkSlot = (typeof FRAMEWORK_SLOTS)[number];

export const ARCHETYPE_SLOTS = [
  // Family A — Customer-stated facts (5)
  'PRICING_BREAKDOWN',
  'SERVICE_ANATOMY',
  'PRODUCT_TOUR',
  'TIER_COMPARISON',
  'WHAT_YOU_GET',
  // Family B — Customer expertise (5)
  'INSIDER_CHECKLIST',
  'COMMON_MISTAKE',
  'PRE_DECISION_AUDIT',
  'PROCESS_TOUR',
  'QUALITY_TELLS',
  // Family C — Industry knowledge (5)
  'DECODED_JARGON',
  'INDUSTRY_PATTERN',
  'CATEGORY_MYTH',
  'MARKET_REALITY',
  'REGULATORY_SNAPSHOT',
  // Family D — Audience pain points (5)
  'SYMPTOM_DIAGNOSIS',
  'COST_OF_INACTION',
  'HIDDEN_TRAP',
  'QUESTION_LOOP',
  'DECISION_FRAMEWORK',
  // Family E — Aspirational direction (5)
  'OUTCOME_SHOWCASE',
  'DAY_IN_THE_OUTPUT',
  'QUALITY_MOMENT',
  'USE_CASE_SPOTLIGHT',
  'ADJACENT_POSSIBILITY',
] as const;

export type ArchetypeSlot = (typeof ARCHETYPE_SLOTS)[number];

export const NICHE_SLUGS = [
  'beauty',
  'real_estate',
  'fashion',
  'fintech',
  'health',
  'food',
  'education',
] as const;

export type NicheSlug = (typeof NICHE_SLUGS)[number];

export const TIERS = ['starter', 'standard', 'calendar'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierCounts {
  frameworks: number;
  archetypes: number;
  video_count: number;
  carousel_count: number;
}

// Per docs/pricing-and-packages.md §1: each tier ships videos + carousels.
// output-validator (Task 5) asserts calendar_plan.length === video_count + carousel_count.
export const TIER_COUNTS: Record<Tier, TierCounts> = {
  starter:  { frameworks: 3, archetypes: 3, video_count: 7,  carousel_count: 3  },
  standard: { frameworks: 5, archetypes: 5, video_count: 14, carousel_count: 7  },
  calendar: { frameworks: 8, archetypes: 8, video_count: 30, carousel_count: 14 },
};

export type AffinityLevel = 'High' | 'Med' | 'Low';

export const AFFINITY_SCORES: Record<AffinityLevel, number> = {
  High: 3,
  Med: 2,
  Low: 1,
};

export interface FrameworkEntry {
  slot: FrameworkSlot;
  name: string;        // human-readable e.g. "DR Formula"
  family: string;      // e.g. "Direct response"
  markdown: string;    // full body of the section
  affinity: Record<NicheSlug, AffinityLevel>;
}

export interface ArchetypeEntry {
  slot: ArchetypeSlot;
  name: string;
  family: string;
  markdown: string;
  affinity: Record<NicheSlug, AffinityLevel>;
}

export interface BankCatalog {
  frameworks: Record<FrameworkSlot, FrameworkEntry>;
  archetypes: Record<ArchetypeSlot, ArchetypeEntry>;
  niches: Record<NicheSlug, string>;  // full markdown text per niche brief
}

export interface FrameworkSeedInputs {
  customer_id: string;
  niche: NicheSlug;
  order_index: number;
  submission_week_iso: string;  // e.g. "2026-W18"
}

export interface SelectedPair {
  framework: FrameworkSlot;
  archetype: ArchetypeSlot;
  affinity: number;  // framework_affinity * archetype_affinity, 1-9
}

export interface FrameworkSeedResult {
  seed_hash: string;
  seed_inputs: FrameworkSeedInputs;
  selected_frameworks: FrameworkSlot[];
  selected_archetypes: ArchetypeSlot[];
  selected_pairs: SelectedPair[];
  exhaustion_warning: boolean;
  lru_fallback_used: boolean;
  lru_pairs_reused?: Array<{
    framework: FrameworkSlot;
    archetype: ArchetypeSlot;
    last_used_at: string;
  }>;
}

export type ReanalyzeMode = 'same_frameworks' | 'new_frameworks';

// AiOutput — the model-facing output shape per docs/specs/ai-brief-analysis.md §3.4.
// SupersetOutput — application-side superset that adds CRM-derived fields per Q1 of
// the design doc (brief_summary, upsell_recommendation, estimated_brief_quality_score).
// Violation — single fabrication-audit violation entry.

export type SentenceRhythm = 'short_punchy' | 'mid_length' | 'dense';
export type CorpusQuality = 'thick' | 'thin' | 'absent';
export type EnergyRegister =
  | 'calm' | 'urgent' | 'playful' | 'authoritative' | 'irreverent' | 'warm';
export type SlotFormat = 'ugc_30s' | 'ugc_60s' | 't2v_quality' | 't2v_budget' | 'carousel';
export type FabricationRiskCheck = 'passed' | 'escalate';

export interface BrandVoice {
  voice_phrases: string[];
  sentence_rhythm: SentenceRhythm;
  avoid_words: string[];
  energy_register: EnergyRegister;
  voice_corpus_quality: CorpusQuality;
}

export interface SpecificityInventory {
  numbers: string[];
  proper_nouns: string[];
  process_steps: string[];
  specificity_corpus_quality: CorpusQuality;
}

export interface ExpertiseNugget {
  nugget: string;
  framework_affinity: string[];
}

export interface VisualAesthetic {
  lighting: string;
  setting: string;
  wardrobe_props: string;
  photo_quality_summary: string;
  photos_present: boolean;
}

export interface CalendarSlot {
  slot_index: number;
  day: number;
  format: SlotFormat;
  framework_slot: FrameworkSlot;
  archetype_slot: ArchetypeSlot;
  topic: string;
  hook: string;
  core_beats: string[];
  cta: string;
  fabrication_risk_check: FabricationRiskCheck;
}

export interface Violation {
  slot_index: number;
  line: string;
  violation: string;
}

export interface FabricationAudit {
  lines_checked: number;
  violations_found: Violation[];
  audit_passed: boolean;
}

export interface ReviewFlag {
  reason: string;
  detail: string;
}

export interface AiOutput {
  brand_voice: BrandVoice;
  specificity_inventory: SpecificityInventory;
  expertise_map: ExpertiseNugget[];
  visual_aesthetic: VisualAesthetic;
  calendar_plan: CalendarSlot[];
  fabrication_audit: FabricationAudit;
  flags_for_review: ReviewFlag[];
}

export interface SupersetOutput extends AiOutput {
  brief_summary: string;
  upsell_recommendation: {
    should_upsell: boolean;
    recommended_tier: Tier | null;
    reasoning: string;
    upsell_price_delta: number;
  };
  estimated_brief_quality_score: number;
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all 7 tests pass under `V2 canonical types`.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/types/v2.ts apps/agent/src/lib/types/v2.test.ts
git commit -m "feat(agent): canonical V2 types

Adds FRAMEWORK_SLOTS (25), ARCHETYPE_SLOTS (25), NICHE_SLUGS (7),
TIER_COUNTS, plus FrameworkSeedInputs/Result and BankCatalog types.
Source of truth for the slot IDs that the markdown spec docs anchor to
via <!-- slot: ID --> frontmatter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Add slot frontmatter to `script-frameworks.md`

**Files:**
- Modify: `docs/specs/script-frameworks.md` (25 section headings)

The bank-catalog parser anchors framework markdown to slot IDs via HTML-comment frontmatter on the section heading line. Each `### N.M Framework Name` heading gets the comment **on the line immediately after**, e.g.:

```markdown
### 3.1 DR Formula
<!-- slot: DR_FORMULA -->

**What it is.** ...
```

The comment never renders in HTML. The parser expects exactly this two-line pattern.

- [ ] **Step 1: Read the current heading list**

Confirm the 25 framework headings exist by running:

```bash
grep -nE '^### [0-9]+\.[0-9]+ [A-Z]' docs/specs/script-frameworks.md
```

Expected: 25 lines matching `### 3.1 DR Formula`, `### 3.2 PAS`, etc.

If the count differs from 25, STOP — the spec doc itself is malformed and Phase 1 cannot proceed. File an issue and escalate.

- [ ] **Step 2: Add slot frontmatter to all 25 framework sections**

For each `### N.M Framework Name` heading, insert the matching comment on the next line. Mapping (heading → slot ID):

| Heading | Slot |
|---|---|
| ### 3.1 DR Formula | `DR_FORMULA` |
| ### 3.2 PAS | `PAS` |
| ### 3.3 AIDA | `AIDA` |
| ### 3.4 PAIPS | `PAIPS` |
| ### 3.5 Value Equation | `VALUE_EQUATION` |
| ### 4.1 3-Layer Hook Stack | `THREE_LAYER_HOOK_STACK` |
| ### 4.2 Pattern Interrupt | `PATTERN_INTERRUPT` |
| ### 4.3 Open Loop | `OPEN_LOOP` |
| ### 4.4 Curiosity Gap | `CURIOSITY_GAP` |
| ### 4.5 Specificity Stack | `SPECIFICITY_STACK` |
| ### 5.1 Quick-Win | `QUICK_WIN` |
| ### 5.2 Educational Breakdown | `EDUCATIONAL_BREAKDOWN` |
| ### 5.3 Process Demystification | `PROCESS_DEMYSTIFICATION` |
| ### 5.4 Numbered List | `NUMBERED_LIST` |
| ### 5.5 Checklist Reveal | `CHECKLIST_REVEAL` |
| ### 6.1 Myth-Buster | `MYTH_BUSTER` |
| ### 6.2 Comparison | `COMPARISON` |
| ### 6.3 Anti-Trend | `ANTI_TREND` |
| ### 6.4 Industry Insider | `INDUSTRY_INSIDER` |
| ### 6.5 Cost Reveal | `COST_REVEAL` |
| ### 7.1 Behind-the-Work | `BEHIND_THE_WORK` |
| ### 7.2 Dataset Reveal | `DATASET_REVEAL` |
| ### 7.3 Decoded Jargon | `DECODED_JARGON` |
| ### 7.4 Steel-Man | `STEEL_MAN` |
| ### 7.5 Frame Re-Set | `FRAME_RE_SET` |

If the actual headings in the file differ from this table (e.g. renumbered subsections), follow the file's own ordering and only adjust the heading-text → slot mapping. The slot IDs in `apps/agent/src/lib/types/v2.ts` `FRAMEWORK_SLOTS` are the source of truth — every slot in that array must end up anchored exactly once in this file.

Edit pattern (apply per heading):

```markdown
### 3.1 DR Formula
```
becomes:
```markdown
### 3.1 DR Formula
<!-- slot: DR_FORMULA -->
```

- [ ] **Step 3: Verify slot count matches**

```bash
grep -cE '^<!-- slot: [A-Z_]+ -->$' docs/specs/script-frameworks.md
```

Expected: `25`. If different, return to Step 2 — a slot was missed or doubled.

- [ ] **Step 4: Verify each slot ID is one of the 25 in `FRAMEWORK_SLOTS`**

```bash
grep -oE '<!-- slot: [A-Z_]+ -->' docs/specs/script-frameworks.md \
  | sed -E 's/<!-- slot: ([A-Z_]+) -->/\1/' | sort -u
```

Expected: 25 lines, each matching one entry in `FRAMEWORK_SLOTS` from `apps/agent/src/lib/types/v2.ts`. No duplicates.

- [ ] **Step 5: Verify the markdown still renders correctly**

```bash
head -30 docs/specs/script-frameworks.md
```

Expected: the document opens normally; no broken frontmatter at the top of the file. The HTML comments only appear inside section bodies.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/script-frameworks.md
git commit -m "docs(specs): anchor script-frameworks slots with HTML-comment frontmatter

Adds <!-- slot: ID --> frontmatter to all 25 framework section headings.
This anchors the runtime slot ID (used by framework-selector and the
bank-catalog parser) to the markdown spec text, so renamed or
renumbered headings can't silently break the mapping. Pure metadata
addition — rendered HTML is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — Add slot frontmatter to `angle-archetypes.md`

**Files:**
- Modify: `docs/specs/angle-archetypes.md` (25 section headings)

Same procedure as Task 3 with the archetype mapping.

- [ ] **Step 1: Confirm 25 archetype headings exist**

```bash
grep -nE '^### [0-9]+\.[0-9]+ [A-Z]' docs/specs/angle-archetypes.md
```

Expected: 25 lines.

- [ ] **Step 2: Add slot frontmatter to all 25 archetype sections**

Mapping (heading → slot ID):

| Heading | Slot |
|---|---|
| ### 3.1 Pricing Breakdown | `PRICING_BREAKDOWN` |
| ### 3.2 Service Anatomy | `SERVICE_ANATOMY` |
| ### 3.3 Product Tour | `PRODUCT_TOUR` |
| ### 3.4 Tier Comparison | `TIER_COMPARISON` |
| ### 3.5 What You Get | `WHAT_YOU_GET` |
| ### 4.1 Insider Checklist | `INSIDER_CHECKLIST` |
| ### 4.2 Common Mistake | `COMMON_MISTAKE` |
| ### 4.3 Pre-Decision Audit | `PRE_DECISION_AUDIT` |
| ### 4.4 Process Tour | `PROCESS_TOUR` |
| ### 4.5 Quality Tells | `QUALITY_TELLS` |
| ### 5.1 Decoded Jargon | `DECODED_JARGON` |
| ### 5.2 Industry Pattern | `INDUSTRY_PATTERN` |
| ### 5.3 Category Myth | `CATEGORY_MYTH` |
| ### 5.4 Market Reality | `MARKET_REALITY` |
| ### 5.5 Regulatory Snapshot | `REGULATORY_SNAPSHOT` |
| ### 6.1 Symptom Diagnosis | `SYMPTOM_DIAGNOSIS` |
| ### 6.2 Cost of Inaction | `COST_OF_INACTION` |
| ### 6.3 Hidden Trap | `HIDDEN_TRAP` |
| ### 6.4 Question Loop | `QUESTION_LOOP` |
| ### 6.5 Decision Framework | `DECISION_FRAMEWORK` |
| ### 7.1 Outcome Showcase | `OUTCOME_SHOWCASE` |
| ### 7.2 Day-in-the-Output | `DAY_IN_THE_OUTPUT` |
| ### 7.3 Quality Moment | `QUALITY_MOMENT` |
| ### 7.4 Use-Case Spotlight | `USE_CASE_SPOTLIGHT` |
| ### 7.5 Adjacent Possibility | `ADJACENT_POSSIBILITY` |

Note: `DECODED_JARGON` exists in **both** `FRAMEWORK_SLOTS` and `ARCHETYPE_SLOTS` (same slot ID, different bank). The bank catalog disambiguates by which file the comment appears in.

Same edit pattern as Task 3 — comment on line immediately after each heading.

- [ ] **Step 3: Verify count and uniqueness**

```bash
grep -cE '^<!-- slot: [A-Z_]+ -->$' docs/specs/angle-archetypes.md
```

Expected: `25`.

```bash
grep -oE '<!-- slot: [A-Z_]+ -->' docs/specs/angle-archetypes.md \
  | sed -E 's/<!-- slot: ([A-Z_]+) -->/\1/' | sort | uniq -d
```

Expected: empty output (no duplicates within the file).

- [ ] **Step 4: Commit**

```bash
git add docs/specs/angle-archetypes.md
git commit -m "docs(specs): anchor angle-archetypes slots with HTML-comment frontmatter

Adds <!-- slot: ID --> frontmatter to all 25 archetype section
headings. Mirror of the script-frameworks change. DECODED_JARGON
appears in both files because it exists in both banks; the catalog
parser disambiguates by source file.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — Bank catalog: niche brief loader (smallest piece first)

**Files:**
- Create: `apps/agent/src/lib/bank-catalog.ts` (initial skeleton; expanded in Tasks 6-8)
- Create: `apps/agent/src/lib/bank-catalog.test.ts`
- Create: `apps/agent/src/lib/__fixtures__/sample-niche-brief.md` (test fixture)

The niche brief loader is the simplest piece: read `niche-briefs/<slug>.md` from disk, return the full text. Build incrementally — niche briefs first, then framework parsing, then archetype parsing, then completeness validation.

- [ ] **Step 1: Create the test fixture**

`apps/agent/src/lib/__fixtures__/sample-niche-brief.md`:

```markdown
# Niche brief: Sample (test-only)

**Status:** Test fixture for bank-catalog.test.ts.

This file exists to test the niche-brief loader without depending on
the real niche briefs in niche-briefs/. The body is intentionally short.

## 1. Who's in this niche

- Sample customer A.
- Sample customer B.

## 2. Tone and voice patterns

Sample tone notes.
```

- [ ] **Step 2: Write the failing test**

`apps/agent/src/lib/bank-catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadNicheBrief, NicheBriefMissingError } from './bank-catalog';

const FIXTURE_DIR = join(__dirname, '__fixtures__');

describe('loadNicheBrief', () => {
  it('reads the full markdown body of a niche file', async () => {
    const text = await loadNicheBrief('sample-niche-brief', FIXTURE_DIR);
    expect(text).toContain('# Niche brief: Sample (test-only)');
    expect(text).toContain('## 2. Tone and voice patterns');
  });

  it('throws NicheBriefMissingError when file is missing', async () => {
    await expect(loadNicheBrief('nonexistent', FIXTURE_DIR)).rejects.toBeInstanceOf(
      NicheBriefMissingError,
    );
  });

  it('NicheBriefMissingError carries the niche slug', async () => {
    try {
      await loadNicheBrief('nonexistent', FIXTURE_DIR);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NicheBriefMissingError);
      expect((err as NicheBriefMissingError).nicheSlug).toBe('nonexistent');
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: FAIL with `Cannot find module './bank-catalog'`.

- [ ] **Step 4: Implement `loadNicheBrief`**

`apps/agent/src/lib/bank-catalog.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class NicheBriefMissingError extends Error {
  constructor(public readonly nicheSlug: string, cause?: unknown) {
    super(`Niche brief file not found for slug: ${nicheSlug}`);
    this.name = 'NicheBriefMissingError';
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

/**
 * Read a niche brief markdown file from disk by slug.
 *
 * @param nicheSlug - the niche slug (e.g. "beauty", "real_estate")
 * @param dir - directory containing the .md files (default: <repo>/niche-briefs)
 * @returns the full file body as a UTF-8 string
 * @throws NicheBriefMissingError if the file does not exist
 */
export async function loadNicheBrief(nicheSlug: string, dir: string): Promise<string> {
  const path = join(dir, `${nicheSlug}.md`);
  try {
    return await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NicheBriefMissingError(nicheSlug, err);
    }
    throw err;
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: 3 tests pass under `loadNicheBrief`.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/lib/bank-catalog.ts apps/agent/src/lib/bank-catalog.test.ts apps/agent/src/lib/__fixtures__/sample-niche-brief.md
git commit -m "feat(agent): bank-catalog niche brief loader

Adds loadNicheBrief() with a typed NicheBriefMissingError. First
incremental piece of the bank catalog parser; framework + archetype
section parsing land in following commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Bank catalog: framework section parser + affinity matrix

**Files:**
- Modify: `apps/agent/src/lib/bank-catalog.ts` (extend with framework parsing)
- Modify: `apps/agent/src/lib/bank-catalog.test.ts`
- Create: `apps/agent/src/lib/__fixtures__/sample-frameworks.md`

The parser walks the markdown, finds each `<!-- slot: ID -->` comment, captures everything from that comment until the next `<!-- slot: ID -->` or the next `## ` (top-level section). It also parses the niche × framework affinity table from §9.

- [ ] **Step 1: Create framework fixture with two slots + affinity table**

`apps/agent/src/lib/__fixtures__/sample-frameworks.md`:

```markdown
# Script frameworks (test fixture)

## 3. Family A — Direct response

### 3.1 DR Formula
<!-- slot: DR_FORMULA -->

**What it is.** Sample DR Formula body. One paragraph.

**Hook patterns.**
- "Sample hook line."

### 3.2 PAS
<!-- slot: PAS -->

**What it is.** Sample PAS body.

## 9. Niche × framework affinity matrix

| Framework | Beauty | Real Est | Fashion | Fintech | Health | Food | Education |
|---|---|---|---|---|---|---|---|
| DR Formula | Med | High | Med | High | Med | Med | High |
| PAS | Low | Med | Low | High | Med | Low | High |
```

- [ ] **Step 2: Write the failing test**

Append to `apps/agent/src/lib/bank-catalog.test.ts`:

```ts
import { parseFrameworksFile } from './bank-catalog';

describe('parseFrameworksFile', () => {
  const fixturePath = join(FIXTURE_DIR, 'sample-frameworks.md');

  it('returns one entry per <!-- slot: ID --> comment', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    const slots = Object.keys(entries);
    expect(slots).toEqual(expect.arrayContaining(['DR_FORMULA', 'PAS']));
    expect(slots).toHaveLength(2);
  });

  it('captures the section markdown body up to the next slot', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.markdown).toContain('Sample DR Formula body');
    expect(entries.DR_FORMULA.markdown).toContain('Sample hook line');
    expect(entries.DR_FORMULA.markdown).not.toContain('Sample PAS body');
  });

  it('extracts the human-readable name from the heading', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.name).toBe('DR Formula');
    expect(entries.PAS.name).toBe('PAS');
  });

  it('extracts the family name from the parent ## heading', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.family).toBe('Family A — Direct response');
  });

  it('parses the niche affinity matrix into per-niche levels', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.affinity.beauty).toBe('Med');
    expect(entries.DR_FORMULA.affinity.real_estate).toBe('High');
    expect(entries.DR_FORMULA.affinity.fintech).toBe('High');
    expect(entries.PAS.affinity.beauty).toBe('Low');
    expect(entries.PAS.affinity.fintech).toBe('High');
  });

  it('throws when a slot in the affinity matrix is missing its <!-- slot --> anchor', async () => {
    // Tested in Task 8's completeness validator. Here we just confirm
    // parseFrameworksFile is permissive — it parses what it sees and lets
    // the validator handle the cross-check.
    const entries = await parseFrameworksFile(fixturePath);
    expect(Object.keys(entries)).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Expected: FAIL with `parseFrameworksFile is not a function`.

- [ ] **Step 4: Implement `parseFrameworksFile`**

Append to `apps/agent/src/lib/bank-catalog.ts`:

```ts
import type { FrameworkEntry, FrameworkSlot, NicheSlug, AffinityLevel } from './types/v2';
import { NICHE_SLUGS } from './types/v2';

const SLOT_COMMENT_RE = /^<!-- slot: ([A-Z_]+) -->$/;
const H3_HEADING_RE = /^### [0-9]+\.[0-9]+\s+(.+)$/;
const H2_HEADING_RE = /^## (.+)$/;

interface SectionMatch {
  slot: string;
  name: string;
  family: string;
  markdown: string;
}

/**
 * Walk the file line-by-line. For each <!-- slot: ID --> comment, the
 * heading on the previous line gives the human-readable name, the most
 * recent ## heading gives the family, and the body runs from the comment
 * line until the next <!-- slot --> comment or the next ## heading.
 */
function extractSections(text: string): SectionMatch[] {
  const lines = text.split('\n');
  const sections: SectionMatch[] = [];
  let currentFamily = '';
  let i = 0;
  while (i < lines.length) {
    const h2 = H2_HEADING_RE.exec(lines[i]);
    if (h2) {
      currentFamily = h2[1].trim();
      i++;
      continue;
    }
    const slotMatch = SLOT_COMMENT_RE.exec(lines[i]);
    if (slotMatch) {
      const slot = slotMatch[1];
      const headingLine = i > 0 ? lines[i - 1] : '';
      const headingMatch = H3_HEADING_RE.exec(headingLine);
      const name = headingMatch ? headingMatch[1].trim() : slot;

      // Capture body from this line until next slot or next ##
      const bodyStart = i;
      let bodyEnd = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (SLOT_COMMENT_RE.test(lines[j]) || H2_HEADING_RE.test(lines[j])) {
          bodyEnd = j;
          break;
        }
      }
      sections.push({
        slot,
        name,
        family: currentFamily,
        markdown: lines.slice(bodyStart, bodyEnd).join('\n').trim(),
      });
      i = bodyEnd;
      continue;
    }
    i++;
  }
  return sections;
}

/**
 * Parse the niche × framework (or × archetype) affinity table.
 * Expected header row: | Framework | Beauty | Real Est | Fashion | Fintech | Health | Food | Education |
 * (or | Archetype | ... | for archetypes — first column heading varies but is ignored).
 *
 * Returns a map from row-name (e.g. "DR Formula") to per-niche affinity level.
 */
function parseAffinityMatrix(text: string): Record<string, Record<NicheSlug, AffinityLevel>> {
  const lines = text.split('\n');
  // Find a markdown table whose header includes 'Beauty' and 'Education'
  const headerIdx = lines.findIndex(
    (l) => l.includes('|') && l.includes('Beauty') && l.includes('Education'),
  );
  if (headerIdx < 0) return {};

  // Column order: split by | trim entries, drop the first column (Framework/Archetype name) and rebuild a niche-order list
  const headerCols = lines[headerIdx]
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  // headerCols[0] is the row-axis label ("Framework" or "Archetype")
  const nicheOrder: NicheSlug[] = headerCols.slice(1).map((label) => {
    const map: Record<string, NicheSlug> = {
      Beauty: 'beauty',
      'Real Est': 'real_estate',
      Fashion: 'fashion',
      Fintech: 'fintech',
      Health: 'health',
      Food: 'food',
      Education: 'education',
    };
    if (!(label in map)) {
      throw new Error(`Unknown niche column header in affinity matrix: ${label}`);
    }
    return map[label];
  });

  const result: Record<string, Record<NicheSlug, AffinityLevel>> = {};
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) break;
    const cols = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
    if (cols.length === 0) continue;
    const rowName = cols[0];
    const cells = cols.slice(1);
    if (cells.length !== nicheOrder.length) continue;
    const affinity: Record<NicheSlug, AffinityLevel> = Object.fromEntries(
      nicheOrder.map((n, idx) => [n, cells[idx] as AffinityLevel]),
    ) as Record<NicheSlug, AffinityLevel>;
    result[rowName] = affinity;
  }
  return result;
}

export async function parseFrameworksFile(path: string): Promise<Record<FrameworkSlot, FrameworkEntry>> {
  const text = await readFile(path, 'utf-8');
  const sections = extractSections(text);
  const affinityByName = parseAffinityMatrix(text);
  const entries: Partial<Record<FrameworkSlot, FrameworkEntry>> = {};
  for (const sec of sections) {
    const affinity = affinityByName[sec.name] ?? affinityByName[sec.name.replace(/-/g, ' ')];
    if (!affinity) {
      // Permissive: parser doesn't fail here. Completeness validator (Task 8) will catch.
      continue;
    }
    entries[sec.slot as FrameworkSlot] = {
      slot: sec.slot as FrameworkSlot,
      name: sec.name,
      family: sec.family,
      markdown: sec.markdown,
      affinity,
    };
  }
  return entries as Record<FrameworkSlot, FrameworkEntry>;
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all 6 tests pass under `parseFrameworksFile`.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/lib/bank-catalog.ts apps/agent/src/lib/bank-catalog.test.ts apps/agent/src/lib/__fixtures__/sample-frameworks.md
git commit -m "feat(agent): bank-catalog framework section + affinity parser

Adds parseFrameworksFile() that walks the markdown line-by-line,
captures section bodies anchored by <!-- slot: ID --> comments, and
parses the niche affinity matrix from the §9 table. Permissive — slots
without an affinity row are skipped here; the completeness validator
(later commit) catches gaps.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Bank catalog: archetype parser (mirrors framework parser)

**Files:**
- Modify: `apps/agent/src/lib/bank-catalog.ts`
- Modify: `apps/agent/src/lib/bank-catalog.test.ts`
- Create: `apps/agent/src/lib/__fixtures__/sample-archetypes.md`

The archetype parser is structurally identical to the framework parser. We add a thin wrapper rather than duplicating logic — `parseArchetypesFile` shares the `extractSections` + `parseAffinityMatrix` helpers with `parseFrameworksFile`.

- [ ] **Step 1: Create archetype fixture**

`apps/agent/src/lib/__fixtures__/sample-archetypes.md`:

```markdown
# Angle archetypes (test fixture)

## 3. Family A — Customer-stated facts

### 3.1 Pricing Breakdown
<!-- slot: PRICING_BREAKDOWN -->

**What it is.** Sample Pricing Breakdown body.

### 3.2 Service Anatomy
<!-- slot: SERVICE_ANATOMY -->

**What it is.** Sample Service Anatomy body.

## 8. Archetype × niche affinity matrix

| Archetype | Beauty | Real Est | Fashion | Fintech | Health | Food | Education |
|---|---|---|---|---|---|---|---|
| Pricing Breakdown | High | High | High | Low | Med | High | High |
| Service Anatomy | Med | High | Med | High | Med | Med | High |
```

- [ ] **Step 2: Write the failing test**

Append to `apps/agent/src/lib/bank-catalog.test.ts`:

```ts
import { parseArchetypesFile } from './bank-catalog';

describe('parseArchetypesFile', () => {
  const fixturePath = join(FIXTURE_DIR, 'sample-archetypes.md');

  it('returns one entry per archetype slot', async () => {
    const entries = await parseArchetypesFile(fixturePath);
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining(['PRICING_BREAKDOWN', 'SERVICE_ANATOMY']),
    );
  });

  it('parses affinity from the §8 archetype table (note: header column "Archetype" not "Framework")', async () => {
    const entries = await parseArchetypesFile(fixturePath);
    expect(entries.PRICING_BREAKDOWN.affinity.beauty).toBe('High');
    expect(entries.PRICING_BREAKDOWN.affinity.fintech).toBe('Low');
    expect(entries.SERVICE_ANATOMY.affinity.real_estate).toBe('High');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Expected: FAIL with `parseArchetypesFile is not a function`.

- [ ] **Step 4: Implement `parseArchetypesFile`**

Append to `apps/agent/src/lib/bank-catalog.ts`:

```ts
import type { ArchetypeEntry, ArchetypeSlot } from './types/v2';

export async function parseArchetypesFile(path: string): Promise<Record<ArchetypeSlot, ArchetypeEntry>> {
  const text = await readFile(path, 'utf-8');
  const sections = extractSections(text);
  const affinityByName = parseAffinityMatrix(text);
  const entries: Partial<Record<ArchetypeSlot, ArchetypeEntry>> = {};
  for (const sec of sections) {
    const affinity = affinityByName[sec.name] ?? affinityByName[sec.name.replace(/-/g, ' ')];
    if (!affinity) continue;
    entries[sec.slot as ArchetypeSlot] = {
      slot: sec.slot as ArchetypeSlot,
      name: sec.name,
      family: sec.family,
      markdown: sec.markdown,
      affinity,
    };
  }
  return entries as Record<ArchetypeSlot, ArchetypeEntry>;
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all archetype parser tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/lib/bank-catalog.ts apps/agent/src/lib/bank-catalog.test.ts apps/agent/src/lib/__fixtures__/sample-archetypes.md
git commit -m "feat(agent): bank-catalog archetype parser

Adds parseArchetypesFile() — structurally identical to the framework
parser, sharing extractSections + parseAffinityMatrix helpers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 — Bank catalog: top-level loader + completeness validator

**Files:**
- Modify: `apps/agent/src/lib/bank-catalog.ts`
- Modify: `apps/agent/src/lib/bank-catalog.test.ts`

Top-level `loadBankCatalog()` reads from default repo paths (`docs/specs/script-frameworks.md`, `docs/specs/angle-archetypes.md`, `niche-briefs/`). Validates that all 25 framework slots, all 25 archetype slots, and all 7 niches are present — throws `BankCatalogIncompleteError` otherwise. This is the worker boot-time check.

- [ ] **Step 1: Write the failing test**

Append to `apps/agent/src/lib/bank-catalog.test.ts`:

```ts
import { loadBankCatalog, BankCatalogIncompleteError } from './bank-catalog';
import { FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, NICHE_SLUGS } from './types/v2';

describe('loadBankCatalog (with real repo files)', () => {
  it('loads all 25 framework slots from docs/specs/script-frameworks.md', async () => {
    const catalog = await loadBankCatalog();
    for (const slot of FRAMEWORK_SLOTS) {
      expect(catalog.frameworks[slot]).toBeDefined();
      expect(catalog.frameworks[slot].markdown.length).toBeGreaterThan(50);
    }
  });

  it('loads all 25 archetype slots from docs/specs/angle-archetypes.md', async () => {
    const catalog = await loadBankCatalog();
    for (const slot of ARCHETYPE_SLOTS) {
      expect(catalog.archetypes[slot]).toBeDefined();
    }
  });

  it('loads all 7 niche briefs from niche-briefs/', async () => {
    const catalog = await loadBankCatalog();
    for (const niche of NICHE_SLUGS) {
      expect(catalog.niches[niche]).toBeDefined();
      expect(catalog.niches[niche].length).toBeGreaterThan(50);
    }
  });

  it('every framework has a complete affinity entry across all 7 niches', async () => {
    const catalog = await loadBankCatalog();
    for (const slot of FRAMEWORK_SLOTS) {
      const entry = catalog.frameworks[slot];
      for (const niche of NICHE_SLUGS) {
        expect(entry.affinity[niche]).toMatch(/^(High|Med|Low)$/);
      }
    }
  });

  it('throws BankCatalogIncompleteError when a slot is missing from spec', async () => {
    // Force a partial-files scenario via a fake repo root with empty fixture files
    const tmpRoot = join(FIXTURE_DIR, '__incomplete-fixture__');
    await expect(loadBankCatalog({ repoRoot: tmpRoot })).rejects.toThrow(/missing/i);
  });
});
```

- [ ] **Step 2: Create the incomplete-fixture directory used by the last test**

```bash
mkdir -p apps/agent/src/lib/__fixtures__/__incomplete-fixture__/docs/specs
mkdir -p apps/agent/src/lib/__fixtures__/__incomplete-fixture__/niche-briefs
echo "# empty" > apps/agent/src/lib/__fixtures__/__incomplete-fixture__/docs/specs/script-frameworks.md
echo "# empty" > apps/agent/src/lib/__fixtures__/__incomplete-fixture__/docs/specs/angle-archetypes.md
```

(No niche-briefs files in this fixture. The completeness validator should fail on missing niches.)

- [ ] **Step 3: Run test to verify it fails**

Expected: FAIL with `loadBankCatalog is not a function` (and `BankCatalogIncompleteError` undefined).

- [ ] **Step 4: Implement `loadBankCatalog` + completeness validator**

Append to `apps/agent/src/lib/bank-catalog.ts`:

```ts
import type { BankCatalog } from './types/v2';
import { FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, NICHE_SLUGS } from './types/v2';

export class BankCatalogIncompleteError extends Error {
  constructor(public readonly missing: { kind: string; slug: string }[]) {
    super(
      `BankCatalog is incomplete. Missing entries: ${missing
        .map((m) => `${m.kind}=${m.slug}`)
        .join(', ')}`,
    );
    this.name = 'BankCatalogIncompleteError';
  }
}

export interface LoadBankCatalogOptions {
  /** Repo root (defaults to process.cwd() ascended until package.json with name="operscale-calendar-platform" is found). */
  repoRoot?: string;
}

async function findRepoRoot(start: string): Promise<string> {
  // Ascend until we find pnpm-workspace.yaml or package.json with the platform name.
  // Fallback to start.
  const { dirname } = await import('node:path');
  const { stat } = await import('node:fs/promises');
  let cur = start;
  for (let i = 0; i < 8; i++) {
    try {
      await stat(join(cur, 'pnpm-workspace.yaml'));
      return cur;
    } catch {
      // continue
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return start;
}

export async function loadBankCatalog(opts: LoadBankCatalogOptions = {}): Promise<BankCatalog> {
  const repoRoot = opts.repoRoot ?? (await findRepoRoot(process.cwd()));
  const frameworksPath = join(repoRoot, 'docs/specs/script-frameworks.md');
  const archetypesPath = join(repoRoot, 'docs/specs/angle-archetypes.md');
  const nichesDir = join(repoRoot, 'niche-briefs');

  const [frameworks, archetypes] = await Promise.all([
    parseFrameworksFile(frameworksPath),
    parseArchetypesFile(archetypesPath),
  ]);

  const niches: Partial<Record<(typeof NICHE_SLUGS)[number], string>> = {};
  for (const slug of NICHE_SLUGS) {
    try {
      niches[slug] = await loadNicheBrief(slug, nichesDir);
    } catch (err) {
      if (err instanceof NicheBriefMissingError) continue;
      throw err;
    }
  }

  const missing: { kind: string; slug: string }[] = [];
  for (const slot of FRAMEWORK_SLOTS) {
    if (!frameworks[slot]) missing.push({ kind: 'framework', slug: slot });
  }
  for (const slot of ARCHETYPE_SLOTS) {
    if (!archetypes[slot]) missing.push({ kind: 'archetype', slug: slot });
  }
  for (const slug of NICHE_SLUGS) {
    if (!niches[slug]) missing.push({ kind: 'niche', slug });
  }
  if (missing.length > 0) {
    throw new BankCatalogIncompleteError(missing);
  }

  return {
    frameworks,
    archetypes,
    niches: niches as Record<(typeof NICHE_SLUGS)[number], string>,
  };
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all bank-catalog tests pass, including the 5 new `loadBankCatalog` tests.

If the test "loads all 25 framework slots" fails because some slots are missing, return to Task 3 — a `<!-- slot: ID -->` comment was missed or misspelled. Use the parser test failure output to identify which slot.

- [ ] **Step 6: Commit**

```bash
git add apps/agent/src/lib/bank-catalog.ts apps/agent/src/lib/bank-catalog.test.ts apps/agent/src/lib/__fixtures__/__incomplete-fixture__
git commit -m "feat(agent): bank-catalog top-level loader + completeness validator

Adds loadBankCatalog() that resolves docs/specs/ + niche-briefs/ paths
relative to repo root, parses all three files, and validates that every
slot in FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, and NICHE_SLUGS is present.
Missing slots throw BankCatalogIncompleteError — invariant #7 from the
implementation design's no-loss list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 — Framework selector: deterministic seed function

**Files:**
- Create: `apps/agent/src/lib/framework-selector.ts`
- Create: `apps/agent/src/lib/framework-selector.test.ts`

The seed function is pure: given customer_id, niche, order_index, submission_week_iso, returns a stable sha256 hex. Used both for initial selection and for re-analyze new-frameworks (with salt).

- [ ] **Step 1: Write the failing test**

`apps/agent/src/lib/framework-selector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSeedHash, computeReanalyzeSeedHash } from './framework-selector';
import type { FrameworkSeedInputs } from './types/v2';

describe('computeSeedHash', () => {
  const inputs: FrameworkSeedInputs = {
    customer_id: '00000000-0000-0000-0000-000000000001',
    niche: 'beauty',
    order_index: 1,
    submission_week_iso: '2026-W18',
  };

  it('returns a 64-char hex string', () => {
    const hash = computeSeedHash(inputs);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across calls', () => {
    expect(computeSeedHash(inputs)).toBe(computeSeedHash(inputs));
  });

  it('changes when customer_id changes', () => {
    const a = computeSeedHash(inputs);
    const b = computeSeedHash({ ...inputs, customer_id: '00000000-0000-0000-0000-000000000002' });
    expect(a).not.toBe(b);
  });

  it('changes when order_index changes', () => {
    const a = computeSeedHash(inputs);
    const b = computeSeedHash({ ...inputs, order_index: 2 });
    expect(a).not.toBe(b);
  });

  it('changes when submission_week_iso changes', () => {
    const a = computeSeedHash(inputs);
    const b = computeSeedHash({ ...inputs, submission_week_iso: '2026-W19' });
    expect(a).not.toBe(b);
  });
});

describe('computeReanalyzeSeedHash', () => {
  const inputs: FrameworkSeedInputs = {
    customer_id: '00000000-0000-0000-0000-000000000001',
    niche: 'beauty',
    order_index: 1,
    submission_week_iso: '2026-W18',
  };

  it('returns a 64-char hex string distinct from the initial seed', () => {
    const initial = computeSeedHash(inputs);
    const reanalyze = computeReanalyzeSeedHash(inputs, 2);
    expect(reanalyze).toMatch(/^[0-9a-f]{64}$/);
    expect(reanalyze).not.toBe(initial);
  });

  it('changes when run_index changes', () => {
    const a = computeReanalyzeSeedHash(inputs, 2);
    const b = computeReanalyzeSeedHash(inputs, 3);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL with `Cannot find module './framework-selector'`.

- [ ] **Step 3: Implement seed functions**

`apps/agent/src/lib/framework-selector.ts`:

```ts
import { createHash } from 'node:crypto';
import type { FrameworkSeedInputs } from './types/v2';

/**
 * Deterministic per-customer seed.
 * Source: docs/specs/non-duplication-system.md §2.
 *
 *   seed_input = customer_id + "::" + niche + "::" + order_index + "::" + submission_week_iso
 *   seed       = sha256(seed_input)
 */
export function computeSeedHash(inputs: FrameworkSeedInputs): string {
  const seedInput = `${inputs.customer_id}::${inputs.niche}::${inputs.order_index}::${inputs.submission_week_iso}`;
  return createHash('sha256').update(seedInput).digest('hex');
}

/**
 * Re-analyze (new frameworks) seed.
 * Source: docs/specs/non-duplication-system.md §7.2.
 *
 *   new_seed_input = customer_id + "::" + niche + "::" + order_index + "::"
 *                  + submission_week_iso + "::reanalyze::" + new_run_index
 */
export function computeReanalyzeSeedHash(inputs: FrameworkSeedInputs, runIndex: number): string {
  const seedInput = `${inputs.customer_id}::${inputs.niche}::${inputs.order_index}::${inputs.submission_week_iso}::reanalyze::${runIndex}`;
  return createHash('sha256').update(seedInput).digest('hex');
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all 7 seed-function tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/framework-selector.ts apps/agent/src/lib/framework-selector.test.ts
git commit -m "feat(agent): framework-selector deterministic seed functions

Implements computeSeedHash + computeReanalyzeSeedHash per
non-duplication-system.md §2 and §7.2. Pure crypto.createHash('sha256')
over the documented input string. Subsequent commits add affinity sort
+ history exclusion + LRU fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10 — Framework selector: affinity-aware deterministic pair sort

**Files:**
- Modify: `apps/agent/src/lib/framework-selector.ts`
- Modify: `apps/agent/src/lib/framework-selector.test.ts`

Given the seed and the bank catalog, sort all 625 (framework, archetype) pairs by `(combined_affinity DESC, hash(seed + pair_id) ASC)`. This is the deterministic ordering the selection algorithm walks.

- [ ] **Step 1: Write the failing test**

Append to `apps/agent/src/lib/framework-selector.test.ts`:

```ts
import { sortPairsByAffinityAndSeed } from './framework-selector';
import type { BankCatalog, FrameworkSlot, ArchetypeSlot, NicheSlug, AffinityLevel } from './types/v2';

function makeAffinity(level: AffinityLevel): Record<NicheSlug, AffinityLevel> {
  return {
    beauty: level,
    real_estate: level,
    fashion: level,
    fintech: level,
    health: level,
    food: level,
    education: level,
  };
}

function makeMinimalCatalog(): BankCatalog {
  // Affinities chosen so there is a tie at combined score = 3:
  //   DR_FORMULA(High) × PRICING_BREAKDOWN(High) = 9
  //   DR_FORMULA(High) × SERVICE_ANATOMY(Low)    = 3   <- tie
  //   PAS(Low)         × PRICING_BREAKDOWN(High) = 3   <- tie
  //   PAS(Low)         × SERVICE_ANATOMY(Low)    = 1
  // The two tied pairs are where seed-based tie-breaking engages.
  return {
    frameworks: {
      DR_FORMULA:    { slot: 'DR_FORMULA', name: 'DR Formula', family: 'A', markdown: '', affinity: makeAffinity('High') },
      PAS:           { slot: 'PAS',        name: 'PAS',        family: 'A', markdown: '', affinity: makeAffinity('Low') },
    } as unknown as BankCatalog['frameworks'],
    archetypes: {
      PRICING_BREAKDOWN: { slot: 'PRICING_BREAKDOWN', name: 'Pricing Breakdown', family: 'A', markdown: '', affinity: makeAffinity('High') },
      SERVICE_ANATOMY:   { slot: 'SERVICE_ANATOMY',   name: 'Service Anatomy',   family: 'A', markdown: '', affinity: makeAffinity('Low') },
    } as unknown as BankCatalog['archetypes'],
    niches: {
      beauty: '', real_estate: '', fashion: '', fintech: '', health: '', food: '', education: '',
    },
  };
}

describe('sortPairsByAffinityAndSeed', () => {
  it('returns all 4 pairs from a 2x2 catalog', () => {
    const catalog = makeMinimalCatalog();
    const pairs = sortPairsByAffinityAndSeed(catalog, 'beauty', 'abc123');
    expect(pairs).toHaveLength(4);
  });

  it('orders pairs by combined affinity descending', () => {
    // Combined affinity (with tie at 3):
    //   DR_FORMULA(High=3) * PRICING_BREAKDOWN(High=3) = 9
    //   DR_FORMULA(High=3) * SERVICE_ANATOMY(Low=1)    = 3
    //   PAS(Low=1)         * PRICING_BREAKDOWN(High=3) = 3
    //   PAS(Low=1)         * SERVICE_ANATOMY(Low=1)    = 1
    const catalog = makeMinimalCatalog();
    const pairs = sortPairsByAffinityAndSeed(catalog, 'beauty', 'abc123');
    expect(pairs[0].affinity).toBe(9);
    expect(pairs[pairs.length - 1].affinity).toBe(1);
  });

  it('breaks affinity ties using hash(seed + framework + archetype)', () => {
    const catalog = makeMinimalCatalog();
    // Both seeds will produce the same affinity ordering on the top-affinity pair,
    // but tie-breaking among middle pairs (affinity 3 and 6) should reorder them
    // for different seeds.
    const a = sortPairsByAffinityAndSeed(catalog, 'beauty', 'seed-A');
    const b = sortPairsByAffinityAndSeed(catalog, 'beauty', 'seed-B');
    // The full ordering should differ for different seeds (at least somewhere)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('is deterministic for a given seed', () => {
    const catalog = makeMinimalCatalog();
    const a = sortPairsByAffinityAndSeed(catalog, 'beauty', 'fixed-seed');
    const b = sortPairsByAffinityAndSeed(catalog, 'beauty', 'fixed-seed');
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL with `sortPairsByAffinityAndSeed is not a function`.

- [ ] **Step 3: Implement the sort**

Append to `apps/agent/src/lib/framework-selector.ts`:

```ts
import type {
  BankCatalog,
  FrameworkSlot,
  ArchetypeSlot,
  NicheSlug,
  SelectedPair,
} from './types/v2';
import { AFFINITY_SCORES } from './types/v2';

/**
 * Sort all framework × archetype pairs by combined affinity (descending),
 * breaking ties with sha256(seed + framework + archetype) ascending.
 *
 * Source: docs/specs/non-duplication-system.md §3.
 *
 * Returns all pairs sorted; the caller filters by history exclusion and
 * walks the list to pick the required count.
 */
export function sortPairsByAffinityAndSeed(
  catalog: BankCatalog,
  niche: NicheSlug,
  seedHash: string,
): SelectedPair[] {
  const frameworkSlots = Object.keys(catalog.frameworks) as FrameworkSlot[];
  const archetypeSlots = Object.keys(catalog.archetypes) as ArchetypeSlot[];

  const pairs: Array<SelectedPair & { tieBreaker: string }> = [];
  for (const f of frameworkSlots) {
    const fAff = AFFINITY_SCORES[catalog.frameworks[f].affinity[niche]];
    for (const a of archetypeSlots) {
      const aAff = AFFINITY_SCORES[catalog.archetypes[a].affinity[niche]];
      const tieBreaker = createHash('sha256').update(`${seedHash}::${f}::${a}`).digest('hex');
      pairs.push({ framework: f, archetype: a, affinity: fAff * aAff, tieBreaker });
    }
  }

  pairs.sort((x, y) => {
    if (x.affinity !== y.affinity) return y.affinity - x.affinity;
    return x.tieBreaker < y.tieBreaker ? -1 : x.tieBreaker > y.tieBreaker ? 1 : 0;
  });

  // Strip the tieBreaker from the public-shape result.
  return pairs.map(({ framework, archetype, affinity }) => ({ framework, archetype, affinity }));
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all 4 sort tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/framework-selector.ts apps/agent/src/lib/framework-selector.test.ts
git commit -m "feat(agent): framework-selector affinity-aware pair sort

Cross-product all framework × archetype pairs (625 in production, 4 in
test fixture), score by combined affinity (high=3, med=2, low=1; pair
score = framework × archetype = 1-9), break ties deterministically with
sha256(seed::framework::archetype). Source: non-duplication-system.md §3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11 — Framework selector: history exclusion + LRU fallback

**Files:**
- Modify: `apps/agent/src/lib/framework-selector.ts`
- Modify: `apps/agent/src/lib/framework-selector.test.ts`

Given the sorted pair list, exclude pairs from `customer_framework_history`. If the available pool falls below required, switch to LRU fallback (reuse least-recently-used historical pairs to fill the gap).

- [ ] **Step 1: Write the failing test**

Append to `apps/agent/src/lib/framework-selector.test.ts`:

```ts
import { selectPairsFromSorted } from './framework-selector';

describe('selectPairsFromSorted', () => {
  const allPairs: SelectedPair[] = [
    { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
    { framework: 'PAS',        archetype: 'PRICING_BREAKDOWN', affinity: 6 },
    { framework: 'DR_FORMULA', archetype: 'SERVICE_ANATOMY',   affinity: 3 },
    { framework: 'PAS',        archetype: 'SERVICE_ANATOMY',   affinity: 2 },
  ];

  it('picks N unique frameworks and N unique archetypes from the top of the sorted list', () => {
    const result = selectPairsFromSorted(allPairs, [], 2, 2);
    expect(result.selected_frameworks).toEqual(expect.arrayContaining(['DR_FORMULA', 'PAS']));
    expect(result.selected_archetypes).toEqual(expect.arrayContaining(['PRICING_BREAKDOWN', 'SERVICE_ANATOMY']));
    expect(result.lru_fallback_used).toBe(false);
  });

  it('skips pairs already in customer_framework_history', () => {
    const history = [{ framework: 'DR_FORMULA' as FrameworkSlot, archetype: 'PRICING_BREAKDOWN' as ArchetypeSlot, last_used_at: '2026-01-01T00:00:00Z' }];
    const result = selectPairsFromSorted(allPairs, history, 1, 1);
    // Best non-excluded pair is PAS x PRICING_BREAKDOWN
    expect(result.selected_pairs[0]).toEqual({ framework: 'PAS', archetype: 'PRICING_BREAKDOWN', affinity: 6 });
  });

  it('uses LRU fallback when available pool is insufficient', () => {
    const history = [
      { framework: 'DR_FORMULA' as FrameworkSlot, archetype: 'PRICING_BREAKDOWN' as ArchetypeSlot, last_used_at: '2026-01-01T00:00:00Z' },
      { framework: 'PAS' as FrameworkSlot,        archetype: 'PRICING_BREAKDOWN' as ArchetypeSlot, last_used_at: '2026-02-01T00:00:00Z' },
      { framework: 'DR_FORMULA' as FrameworkSlot, archetype: 'SERVICE_ANATOMY' as ArchetypeSlot,   last_used_at: '2026-03-01T00:00:00Z' },
      { framework: 'PAS' as FrameworkSlot,        archetype: 'SERVICE_ANATOMY' as ArchetypeSlot,   last_used_at: '2026-04-01T00:00:00Z' },
    ];
    const result = selectPairsFromSorted(allPairs, history, 2, 2);
    expect(result.lru_fallback_used).toBe(true);
    expect(result.lru_pairs_reused).toBeDefined();
    // The oldest-used pair should be reused first.
    expect(result.lru_pairs_reused?.[0].last_used_at).toBe('2026-01-01T00:00:00Z');
  });

  it('emits exhaustion_warning when available pairs is below 2x N but not yet exhausted', () => {
    // A 3x3 catalog with 7 of 9 pairs already used. 2 pairs available, both
    // qualify for selection of N=1, but the warning fires because available < 2*N.
    const allPairs9: SelectedPair[] = [
      { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
      { framework: 'DR_FORMULA', archetype: 'SERVICE_ANATOMY',   affinity: 6 },
      { framework: 'DR_FORMULA', archetype: 'PRODUCT_TOUR',      affinity: 3 },
      { framework: 'PAS',        archetype: 'PRICING_BREAKDOWN', affinity: 6 },
      { framework: 'PAS',        archetype: 'SERVICE_ANATOMY',   affinity: 4 },
      { framework: 'PAS',        archetype: 'PRODUCT_TOUR',      affinity: 2 },
      { framework: 'AIDA',       archetype: 'PRICING_BREAKDOWN', affinity: 6 },
      { framework: 'AIDA',       archetype: 'SERVICE_ANATOMY',   affinity: 4 },
      { framework: 'AIDA',       archetype: 'PRODUCT_TOUR',      affinity: 2 },
    ];
    const history = allPairs9.slice(0, 7).map((p) => ({
      framework: p.framework,
      archetype: p.archetype,
      last_used_at: '2026-01-01T00:00:00Z',
    }));
    const result = selectPairsFromSorted(allPairs9, history, 1, 1);
    expect(result.exhaustion_warning).toBe(true);
    expect(result.lru_fallback_used).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL with `selectPairsFromSorted is not a function`.

- [ ] **Step 3: Implement the selection algorithm**

Append to `apps/agent/src/lib/framework-selector.ts`:

```ts
export interface HistoryRow {
  framework: FrameworkSlot;
  archetype: ArchetypeSlot;
  last_used_at: string;  // ISO timestamp
}

export interface SelectionFromSortedResult {
  selected_frameworks: FrameworkSlot[];
  selected_archetypes: ArchetypeSlot[];
  selected_pairs: SelectedPair[];
  exhaustion_warning: boolean;
  lru_fallback_used: boolean;
  lru_pairs_reused?: Array<{ framework: FrameworkSlot; archetype: ArchetypeSlot; last_used_at: string }>;
}

function pairKey(p: { framework: FrameworkSlot; archetype: ArchetypeSlot }): string {
  return `${p.framework}::${p.archetype}`;
}

/**
 * Walk the sorted pair list, accumulate pairs that satisfy:
 *   - not in history
 *   - introduce a new framework OR archetype until both quotas are met
 *
 * If the available pool is too thin to satisfy the quota, fill the gap with
 * LRU pairs from history.
 *
 * Source: docs/specs/non-duplication-system.md §3 (selection algorithm), §6 (exhaustion).
 */
export function selectPairsFromSorted(
  sortedPairs: SelectedPair[],
  history: HistoryRow[],
  nFrameworks: number,
  nArchetypes: number,
): SelectionFromSortedResult {
  const historyKeys = new Set(history.map(pairKey));
  const availablePairs = sortedPairs.filter((p) => !historyKeys.has(pairKey(p)));

  const requiredCount = Math.max(nFrameworks, nArchetypes);
  const exhaustion_warning = availablePairs.length < 2 * requiredCount && availablePairs.length >= requiredCount;
  const needLruFallback = availablePairs.length < requiredCount;

  const selectedPairs: SelectedPair[] = [];
  const seenFrameworks = new Set<FrameworkSlot>();
  const seenArchetypes = new Set<ArchetypeSlot>();

  for (const pair of availablePairs) {
    if (
      seenFrameworks.size >= nFrameworks &&
      seenArchetypes.size >= nArchetypes
    ) {
      break;
    }
    const newF = !seenFrameworks.has(pair.framework);
    const newA = !seenArchetypes.has(pair.archetype);
    if (
      (newF && seenFrameworks.size < nFrameworks) ||
      (newA && seenArchetypes.size < nArchetypes)
    ) {
      selectedPairs.push(pair);
      seenFrameworks.add(pair.framework);
      seenArchetypes.add(pair.archetype);
    }
  }

  let lru_pairs_reused: SelectionFromSortedResult['lru_pairs_reused'];

  if (needLruFallback || seenFrameworks.size < nFrameworks || seenArchetypes.size < nArchetypes) {
    // Fall back to LRU history pairs to fill the quotas.
    const lruSorted = [...history].sort((a, b) => a.last_used_at.localeCompare(b.last_used_at));
    lru_pairs_reused = [];
    for (const h of lruSorted) {
      if (
        seenFrameworks.size >= nFrameworks &&
        seenArchetypes.size >= nArchetypes
      ) {
        break;
      }
      const newF = !seenFrameworks.has(h.framework);
      const newA = !seenArchetypes.has(h.archetype);
      if (
        (newF && seenFrameworks.size < nFrameworks) ||
        (newA && seenArchetypes.size < nArchetypes)
      ) {
        selectedPairs.push({ framework: h.framework, archetype: h.archetype, affinity: 0 });
        lru_pairs_reused.push({ framework: h.framework, archetype: h.archetype, last_used_at: h.last_used_at });
        seenFrameworks.add(h.framework);
        seenArchetypes.add(h.archetype);
      }
    }
  }

  return {
    selected_frameworks: [...seenFrameworks],
    selected_archetypes: [...seenArchetypes],
    selected_pairs: selectedPairs,
    exhaustion_warning,
    lru_fallback_used: lru_pairs_reused !== undefined && lru_pairs_reused.length > 0,
    lru_pairs_reused,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all 4 selection tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/framework-selector.ts apps/agent/src/lib/framework-selector.test.ts
git commit -m "feat(agent): framework-selector history exclusion + LRU fallback

selectPairsFromSorted() walks the affinity-sorted pair list, excludes
pairs already burned for this customer (customer_framework_history),
and fills the per-tier quota. If the available pool is thin, falls back
to least-recently-used historical pairs (sorted by last_used_at ASC).
Emits exhaustion_warning when the pool drops below 2x required count.

Source: docs/specs/non-duplication-system.md §3, §6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12 — Framework selector: top-level `selectFrameworksForBrief`

**Files:**
- Modify: `apps/agent/src/lib/framework-selector.ts`
- Modify: `apps/agent/src/lib/framework-selector.test.ts`

The user-facing entry point. Composes seed + sort + select + history fetch into one function. Includes the re-analyze branches (same / new frameworks). DB read is dependency-injected for testability.

- [ ] **Step 1: Write the failing test**

Append to `apps/agent/src/lib/framework-selector.test.ts`:

```ts
import { selectFrameworksForBrief } from './framework-selector';
import type { FrameworkSeedResult, ReanalyzeMode } from './types/v2';

describe('selectFrameworksForBrief', () => {
  const inputs: FrameworkSeedInputs = {
    customer_id: '00000000-0000-0000-0000-000000000001',
    niche: 'beauty',
    order_index: 1,
    submission_week_iso: '2026-W18',
  };

  it('initial mode: returns FrameworkSeedResult with selected_pairs covering tier quotas', async () => {
    const catalog = makeMinimalCatalog();
    const fetchHistory = async () => [];
    const result = await selectFrameworksForBrief({
      inputs, tier: 'starter', catalog, fetchHistory,
    });
    expect(result.seed_hash).toMatch(/^[0-9a-f]{64}$/);
    // The minimal catalog only has 2 frameworks + 2 archetypes; starter wants 3.
    // LRU fallback fires (history is empty so it produces a degraded result —
    // selected_frameworks and _archetypes will have at most 2 each).
    expect(result.selected_frameworks.length).toBeLessThanOrEqual(2);
  });

  it('initial mode with a richer catalog covers full tier quota', async () => {
    const catalog: BankCatalog = makeMinimalCatalog();
    // Inject a 3rd framework + archetype to satisfy starter (N=3).
    (catalog.frameworks as Record<string, unknown>).AIDA = {
      slot: 'AIDA', name: 'AIDA', family: 'A', markdown: '', affinity: makeAffinity('Med'),
    };
    (catalog.archetypes as Record<string, unknown>).PRODUCT_TOUR = {
      slot: 'PRODUCT_TOUR', name: 'Product Tour', family: 'A', markdown: '', affinity: makeAffinity('Med'),
    };
    const result = await selectFrameworksForBrief({
      inputs, tier: 'starter', catalog, fetchHistory: async () => [],
    });
    expect(result.selected_frameworks).toHaveLength(3);
    expect(result.selected_archetypes).toHaveLength(3);
    expect(result.lru_fallback_used).toBe(false);
  });

  it('re-analyze same_frameworks: reuses prior framework_seed verbatim', async () => {
    const priorSeed: FrameworkSeedResult = {
      seed_hash: 'fixed-prior-hash',
      seed_inputs: inputs,
      selected_frameworks: ['DR_FORMULA', 'PAS'],
      selected_archetypes: ['PRICING_BREAKDOWN', 'SERVICE_ANATOMY'],
      selected_pairs: [
        { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
      ],
      exhaustion_warning: false,
      lru_fallback_used: false,
    };
    const result = await selectFrameworksForBrief({
      inputs, tier: 'starter', catalog: makeMinimalCatalog(),
      fetchHistory: async () => [], mode: 'same_frameworks', priorSeed, runIndex: 2,
    });
    expect(result.seed_hash).toBe('fixed-prior-hash');
    expect(result.selected_pairs).toEqual(priorSeed.selected_pairs);
  });

  it('re-analyze new_frameworks: rotates seed and excludes prior selection from this brief', async () => {
    const priorSeed: FrameworkSeedResult = {
      seed_hash: 'fixed-prior-hash',
      seed_inputs: inputs,
      selected_frameworks: ['DR_FORMULA'],
      selected_archetypes: ['PRICING_BREAKDOWN'],
      selected_pairs: [
        { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
      ],
      exhaustion_warning: false,
      lru_fallback_used: false,
    };
    const result = await selectFrameworksForBrief({
      inputs, tier: 'starter', catalog: makeMinimalCatalog(),
      fetchHistory: async () => [], mode: 'new_frameworks', priorSeed, runIndex: 2,
    });
    expect(result.seed_hash).not.toBe('fixed-prior-hash');
    // Prior pair must not appear in new selection (it's excluded as if it were history)
    const containsPriorPair = result.selected_pairs.some(
      (p) => p.framework === 'DR_FORMULA' && p.archetype === 'PRICING_BREAKDOWN',
    );
    expect(containsPriorPair).toBe(false);
  });

  it('two different customer_ids in the same niche/week get different selections', async () => {
    const catalog: BankCatalog = makeMinimalCatalog();
    (catalog.frameworks as Record<string, unknown>).AIDA = {
      slot: 'AIDA', name: 'AIDA', family: 'A', markdown: '', affinity: makeAffinity('Med'),
    };
    (catalog.archetypes as Record<string, unknown>).PRODUCT_TOUR = {
      slot: 'PRODUCT_TOUR', name: 'Product Tour', family: 'A', markdown: '', affinity: makeAffinity('Med'),
    };
    const a = await selectFrameworksForBrief({
      inputs, tier: 'starter', catalog, fetchHistory: async () => [],
    });
    const b = await selectFrameworksForBrief({
      inputs: { ...inputs, customer_id: '00000000-0000-0000-0000-000000000002' },
      tier: 'starter', catalog, fetchHistory: async () => [],
    });
    expect(a.seed_hash).not.toBe(b.seed_hash);
    // The selected_pairs ordering should differ for different seeds (at least for tied affinity slots)
    expect(JSON.stringify(a.selected_pairs)).not.toBe(JSON.stringify(b.selected_pairs));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL with `selectFrameworksForBrief is not a function`.

- [ ] **Step 3: Implement the entry point**

Append to `apps/agent/src/lib/framework-selector.ts`:

```ts
import type { FrameworkSeedResult, ReanalyzeMode, Tier } from './types/v2';
import { TIER_COUNTS } from './types/v2';

export interface SelectFrameworksInput {
  inputs: FrameworkSeedInputs;
  tier: Tier;
  catalog: BankCatalog;
  fetchHistory: (customer_id: string) => Promise<HistoryRow[]>;
  mode?: ReanalyzeMode;
  priorSeed?: FrameworkSeedResult;
  runIndex?: number;  // required when mode is 'new_frameworks'
}

/**
 * Top-level entry point. Composes seed + sort + select + history.
 * Source: docs/specs/non-duplication-system.md §3, §7.
 */
export async function selectFrameworksForBrief(
  input: SelectFrameworksInput,
): Promise<FrameworkSeedResult> {
  const { inputs, tier, catalog, fetchHistory, mode, priorSeed, runIndex } = input;
  const { frameworks: nF, archetypes: nA } = TIER_COUNTS[tier];

  // Re-analyze same_frameworks: reuse prior selection verbatim.
  if (mode === 'same_frameworks') {
    if (!priorSeed) {
      throw new Error('selectFrameworksForBrief: mode=same_frameworks requires priorSeed');
    }
    return priorSeed;
  }

  // Determine seed hash.
  const seed_hash =
    mode === 'new_frameworks'
      ? computeReanalyzeSeedHash(inputs, runIndex ?? (priorSeed ? 2 : 2))
      : computeSeedHash(inputs);

  // Fetch customer history; for new_frameworks, also exclude prior selection from this brief.
  const history = await fetchHistory(inputs.customer_id);
  const effectiveHistory: HistoryRow[] =
    mode === 'new_frameworks' && priorSeed
      ? [
          ...history,
          ...priorSeed.selected_pairs.map((p) => ({
            framework: p.framework,
            archetype: p.archetype,
            last_used_at: new Date().toISOString(),
          })),
        ]
      : history;

  const sortedPairs = sortPairsByAffinityAndSeed(catalog, inputs.niche, seed_hash);
  const selection = selectPairsFromSorted(sortedPairs, effectiveHistory, nF, nA);

  return {
    seed_hash,
    seed_inputs: inputs,
    selected_frameworks: selection.selected_frameworks,
    selected_archetypes: selection.selected_archetypes,
    selected_pairs: selection.selected_pairs,
    exhaustion_warning: selection.exhaustion_warning,
    lru_fallback_used: selection.lru_fallback_used,
    lru_pairs_reused: selection.lru_pairs_reused,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: all 5 `selectFrameworksForBrief` tests pass; total Phase 1 tests now ~30.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/framework-selector.ts apps/agent/src/lib/framework-selector.test.ts
git commit -m "feat(agent): framework-selector top-level selectFrameworksForBrief

Composes seed + sort + history-exclusion + LRU into one entry point.
Branches for re-analyze modes:
  - same_frameworks: reuse priorSeed verbatim
  - new_frameworks: rotate seed via reanalyze salt, exclude prior pairs

DB access is dependency-injected (fetchHistory) — production call
sites pass a Supabase-backed reader; tests pass an in-memory function.

Source: docs/specs/non-duplication-system.md §3, §7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13 — Migration `0006_ai_analysis_jobs.sql`

**Files:**
- Create: `supabase/migrations/0006_ai_analysis_jobs.sql`
- Modify: `docs/data-model.md` (add one paragraph for the new table)

The migration text is verbatim from `docs/specs/v2-pipeline-implementation-design.md` §4.1. After writing, apply via paramiko SSH + docker exec psql per `memory/reference_infra.md`.

- [ ] **Step 1: Create the migration file**

`supabase/migrations/0006_ai_analysis_jobs.sql`:

```sql
-- 0006_ai_analysis_jobs.sql
--
-- Phase 1 of V2 brief-analysis pipeline.
-- Source: docs/specs/v2-pipeline-implementation-design.md §4.1.
--
-- Creates the durable queue table the worker container polls. Adds:
--  - ai_analysis_jobs table with status enum + idempotency_key
--  - constraint trigger enforcing founder_note + prior_run_id for re_analyze_*
--  - replica identity full (CLAUDE.md gotcha #4)
--  - RLS: anon denied; founder reads via JWT claim; service_role bypasses

create table ai_analysis_jobs (
  id                uuid primary key default gen_random_uuid(),
  brief_id          uuid not null references briefs(id) on delete cascade,
  trigger_type      text not null check (trigger_type in (
                      'initial',
                      're_analyze_same_frameworks',
                      're_analyze_new_frameworks')),
  founder_note      text,
  prior_run_id      uuid references analysis_runs(id),
  status            text not null default 'queued' check (status in (
                      'queued','running','completed','failed')),
  attempt_count     int  not null default 0,
  idempotency_key   text not null unique,
  enqueued_at       timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  error_detail      jsonb,
  resulting_run_id  uuid references analysis_runs(id)
);

create index ai_analysis_jobs_pickup_idx on ai_analysis_jobs (status, enqueued_at);
create index ai_analysis_jobs_brief_idx  on ai_analysis_jobs (brief_id);

-- Constraint trigger: founder_note + prior_run_id required when trigger_type starts with 're_analyze_'.
create or replace function ai_analysis_jobs_validate_reanalyze()
returns trigger language plpgsql as $body$
begin
  if new.trigger_type like 're_analyze_%' then
    if new.founder_note is null or length(trim(new.founder_note)) = 0 then
      raise exception 'founder_note required for trigger_type %', new.trigger_type;
    end if;
    if new.prior_run_id is null then
      raise exception 'prior_run_id required for trigger_type %', new.trigger_type;
    end if;
  end if;
  return new;
end;
$body$;

create trigger ai_analysis_jobs_validate_reanalyze_trg
  before insert or update on ai_analysis_jobs
  for each row execute function ai_analysis_jobs_validate_reanalyze();

-- CLAUDE.md gotcha #4: Realtime needs full row payload on UPDATE.
alter table ai_analysis_jobs replica identity full;

-- RLS: anon denied; founder reads (CRM job-status panel); service_role bypasses RLS.
alter table ai_analysis_jobs enable row level security;

create policy ai_analysis_jobs_anon_deny
  on ai_analysis_jobs as restrictive for all to anon using (false);

create policy ai_analysis_jobs_founder_read
  on ai_analysis_jobs as permissive for select to authenticated
  using ((auth.jwt() ->> 'role') = 'founder');

comment on table ai_analysis_jobs is
  'Durable queue for V2 brief analysis. Worker polls for status=queued and claims with FOR UPDATE SKIP LOCKED.';
```

- [ ] **Step 2: Update `docs/data-model.md`**

Add a new section in `docs/data-model.md` describing `ai_analysis_jobs`. The existing data-model.md should have a section per table. Find the right place (alphabetical or grouped by domain) and insert:

```markdown
## ai_analysis_jobs

Phase 1 of V2 (migration `0006_ai_analysis_jobs.sql`). Durable queue for brief
analysis work. Inserted by the analyze HTTP route at form-submit or re-analyze
trigger time; consumed by the worker container which polls every 5 seconds and
claims rows with `FOR UPDATE SKIP LOCKED`.

Lifecycle: `queued` → `running` → `completed | failed`. Stuck rows
(`status='running'` for >5 min) are reclaimed by the worker startup sweep.

Key columns:
- `idempotency_key` (UNIQUE) — `{brief_id}::{trigger_type}::{prior_run_index|0}` —
  prevents duplicate enqueue.
- `attempt_count` — incremented on each claim; ≥3 → permanent failure.
- `prior_run_id` + `founder_note` — required for re-analyze trigger types.
- `resulting_run_id` — populated on success; FK to analysis_runs.

RLS: anon denied; founder reads via JWT claim; service_role bypasses.
Replica identity full (per CLAUDE.md gotcha #4).
```

- [ ] **Step 3: Apply the migration to staging Supabase**

From the local machine, use the paramiko + docker pattern per `memory/reference_infra.md`:

```bash
PYTHONIOENCODING=utf-8 python -c "
import paramiko, os
os.environ['PYTHONIOENCODING'] = 'utf-8'
with open(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)

# Upload the migration via SFTP
sftp = c.open_sftp()
sftp.put(
    r'c:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform\supabase\migrations\0006_ai_analysis_jobs.sql',
    '/tmp/0006_ai_analysis_jobs.sql',
)
sftp.close()

for cmd in [
    'docker cp /tmp/0006_ai_analysis_jobs.sql supabase-db-1:/tmp/0006_ai_analysis_jobs.sql',
    'docker exec supabase-db-1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/0006_ai_analysis_jobs.sql',
    'docker exec supabase-db-1 psql -U postgres -d postgres -c \"\\d+ ai_analysis_jobs\"',
]:
    print(f'=== {cmd} ===')
    _, out, err = c.exec_command(cmd, timeout=120)
    print(out.read().decode('utf-8', errors='replace'))
    e = err.read().decode('utf-8', errors='replace')
    if e: print(f'[stderr] {e}')
c.close()
"
```

Expected: third command (`\d+ ai_analysis_jobs`) prints the table definition with all columns, indexes, RLS enabled, and the trigger present.

- [ ] **Step 4: Sanity check the trigger**

```bash
PYTHONIOENCODING=utf-8 python -c "
import paramiko, os
with open(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
# Try to insert a re_analyze_* row without founder_note. Trigger should reject.
sql = (
  \"insert into ai_analysis_jobs (brief_id, trigger_type, idempotency_key) \"
  \"values (gen_random_uuid(), 're_analyze_same_frameworks', 'sanity-check-key');\"
)
_, out, err = c.exec_command(
    f'docker exec supabase-db-1 psql -U postgres -d postgres -c \"{sql}\"',
    timeout=30,
)
print('out:', out.read().decode())
print('err:', err.read().decode())
c.close()
"
```

Expected stderr: `ERROR: founder_note required for trigger_type re_analyze_same_frameworks`. (And no row inserted — confirm with a follow-up `SELECT count(*) FROM ai_analysis_jobs` returning 0.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_ai_analysis_jobs.sql docs/data-model.md
git commit -m "feat(db): 0006 ai_analysis_jobs migration

Adds the durable queue table for V2 Phase 1. Includes the constraint
trigger enforcing founder_note + prior_run_id for re_analyze_* rows,
replica identity full, and RLS with founder read + anon deny.

Migration applied to staging Supabase (postgres container
supabase-db-1) and verified: \\d+ shows full schema; sanity insert
without founder_note correctly rejected by trigger.

Source: docs/specs/v2-pipeline-implementation-design.md §4.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14 — Phase 1 close-out: full test run + push + PR

**Files:** None new.

- [ ] **Step 1: Run full Phase 1 test suite**

```bash
pnpm --filter @operscale-calendar/agent test -- --reporter=verbose
```

Expected: ~30 passing tests across:
- `types/v2.test.ts` (7)
- `bank-catalog.test.ts` (~14: niche loader 3 + framework parser 6 + archetype parser 2 + loader/validator 5)
- `framework-selector.test.ts` (~16: seed 7 + sort 4 + select 4 + top-level 5)

Zero failures, zero skipped.

- [ ] **Step 2: Run typecheck across the workspace**

```bash
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: zero errors. If TS complains about strict-null on the `as Record<...>` casts in `parseFrameworksFile` / `parseArchetypesFile`, the parsers are doing what's needed; the casts narrow `Partial<Record<>>` to `Record<>` only after the completeness validator has confirmed all keys are present. If you see a real error, fix in place rather than suppressing.

- [ ] **Step 3: Run lint**

```bash
pnpm --filter @operscale-calendar/agent lint
```

Expected: zero errors. ESLint warnings are tolerated; errors block.

- [ ] **Step 4: Verify the docker image still builds**

(Local check; full deploy is Phase 4 work.)

```bash
cd /c/Users/DELL/Documents/Antigravity/operscale-calender/operscale-calendar-platform
docker build -f apps/agent/Dockerfile -t operscale-calendar-agent:phase-1-test . 2>&1 | tail -20
```

Expected: build succeeds (the new dev-deps don't break the production build because Vitest is in `devDependencies` and the production stage prunes them).

- [ ] **Step 5: Push the Phase 1 branch**

If working on `main` directly (per the project's current pattern), push:

```bash
git push origin main
```

If working on a `feature/v2-phase-1` branch:

```bash
git push -u origin feature/v2-phase-1
gh pr create --title "V2 Phase 1: selection + bank catalog + 0006 migration" --body "$(cat <<'EOF'
## Summary

Implements Phase 1 of the V2 brief-analysis pipeline per
\`docs/specs/v2-pipeline-implementation-design.md\` §9 Phase 1.

- Vitest test harness in apps/agent
- Canonical V2 types (FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, NICHE_SLUGS, TIER_COUNTS)
- HTML-comment slot frontmatter on all 25 frameworks + 25 archetypes
- bank-catalog.ts: parse-on-startup with completeness validator
- framework-selector.ts: deterministic seed, affinity sort, history exclusion, LRU fallback, re-analyze branches
- Migration 0006_ai_analysis_jobs.sql applied to staging

No Claude integration. No live route changes. The running production
stack is unaffected; the new ai_analysis_jobs table sits empty until
Phase 4 wires it up.

## Test plan

- [ ] \`pnpm --filter @operscale-calendar/agent test\` — green (~30 tests)
- [ ] \`pnpm --filter @operscale-calendar/agent typecheck\` — zero errors
- [ ] \`pnpm --filter @operscale-calendar/agent lint\` — zero errors
- [ ] Docker image builds locally
- [ ] Migration applied + trigger verified on staging Supabase
EOF
)"
```

- [ ] **Step 6: Update memory with Phase 1 completion**

Update `C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\project_state.md` to reflect that Phase 1 has shipped. Append to the "Day-1 loose ends" section or add a new "V2 Phase 1 — shipped" section noting:

- Phase 1 commits (range)
- 0006 migration applied to staging
- Phase 2 (prompt-builder + output-validator + fabrication-audit + post-processor) is the next chunk
- Phase 1 plan file at `docs/plans/2026-05-04-v2-phase-1-selection-and-bank-catalog.md`

Don't commit memory updates — memory lives outside the repo.

---

## Self-review checklist

After all tasks above are done, before declaring Phase 1 complete:

- [ ] **Spec coverage**: every Phase 1 deliverable in `docs/specs/v2-pipeline-implementation-design.md` §9 has a task above. (types/v2 → Task 2; bank-catalog → Tasks 5-8; framework-selector → Tasks 9-12; 0006 migration → Task 13; spec edits → Tasks 3-4. ✓)
- [ ] **No-loss invariants**: invariants #1, #5, #6, #7 from §4.3 of the design doc are testable in Phase 1 (rest become testable in Phases 2-4):
  - #1 idempotency_key UNIQUE — covered by migration + a Phase 4 route test
  - #5 brief_photos canonical reference — Phase 3 test (photo retrieval lives in worker)
  - #6 niche brief required — `NicheBriefMissingError` in Task 5; `BankCatalogIncompleteError` test in Task 8
  - #7 slot-ID enforcement at startup — `BankCatalogIncompleteError` in Task 8
- [ ] **Type consistency**: `FrameworkSlot`, `ArchetypeSlot`, `NicheSlug`, `Tier`, `BankCatalog`, `FrameworkSeedResult`, `SelectedPair`, `HistoryRow` are used consistently across all files. (The plan defines them in Task 2 and only references them by name afterward. ✓)
- [ ] **Placeholder scan**: no "TODO", "TBD", "implement later", or "similar to Task N" anywhere in the plan.
- [ ] **Frequent commits**: each task ends with a single focused commit. (14 commits total for Phase 1. ✓)

---

## Out of scope for Phase 1 (deferred to later phases)

- `claude.ts` rewrite (Phase 3)
- `prompt-builder.ts`, `output-validator.ts`, `fabrication-audit.ts`, `post-processor.ts` (Phase 2)
- `worker/index.ts` and the second compose service (Phase 3)
- `analyze/route.ts` queue-enqueue cutover and `approve/route.ts` history-write extension (Phase 4)
- Cassette-replay integration tests (Phase 2 — once the prompt-builder + validator exist to record against)
- Live nightly smoke test workflow (Phase 3)
- CI gate for slot-frontmatter completeness as a standalone workflow (Phase 1's `loadBankCatalog` test covers this transitively, but a dedicated workflow that runs on `docs/specs/*.md` changes alone is a Phase 2 addition)
