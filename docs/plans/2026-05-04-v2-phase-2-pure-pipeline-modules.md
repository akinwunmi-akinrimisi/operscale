# V2 Pipeline Phase 2 — Pure Pipeline Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the four pure-logic modules (`prompt-builder`, `output-validator`, `fabrication-audit`, `post-processor`) plus the first L2 cassette-replay integration test, completing §9 Phase 2 of `docs/specs/v2-pipeline-implementation-design.md` without touching live request paths.

**Architecture:** All four modules are pure (no I/O, no Claude calls in production paths). They consume the Phase 1 surfaces (`BankCatalog`, `FrameworkSeedResult`, `AiOutput` types) unchanged. A cassette-replay harness lets a single integration test exercise the full Phase-1 + Phase-2 pipeline against a recorded Claude response committed to the repo, while a `pnpm test:claude:live` script re-records cassettes on demand using the master `.env` at the repo's parent dir.

**Tech Stack:** TypeScript (strict), Vitest 1.6.x, zod 3.23 (already a dep), `@anthropic-ai/sdk` 0.32.x (already a dep), Node 20 `--env-file` for live mode.

---

## File structure (Phase 2)

| Path | Status | Responsibility |
|---|---|---|
| `apps/agent/src/lib/types/v2.ts` | Modify | Add `PhotoBlock`, `BriefAnalyzerInput`, `PriorRunContext`, `AnalysisEdit`, `BuiltPrompt`, `ValidationFailure` |
| `apps/agent/src/lib/types/v2.test.ts` | Modify | Add type-shape sanity tests for the new types |
| `apps/agent/src/lib/prompt-builder.ts` | Create | Renders Layer 1/2/3/4 of the prompt per `ai-brief-analysis.md` §3 |
| `apps/agent/src/lib/prompt-builder.test.ts` | Create | Per-layer + integration unit tests |
| `apps/agent/src/lib/output-validator.ts` | Create | zod schema + slot-count + selection-membership checks |
| `apps/agent/src/lib/output-validator.test.ts` | Create | Schema, count, membership unit tests |
| `apps/agent/src/lib/fabrication-audit.ts` | Create | App-side regex sweep per `ai-brief-analysis.md` §8 |
| `apps/agent/src/lib/fabrication-audit.test.ts` | Create | Forbidden-phrase regression tests |
| `apps/agent/src/lib/post-processor.ts` | Create | Derives `brief_summary`, `upsell_recommendation`, `estimated_brief_quality_score` |
| `apps/agent/src/lib/post-processor.test.ts` | Create | Derivation rule tests |
| `apps/agent/test/helpers/cassette-client.ts` | Create | Anthropic-shaped fake client; replay/record modes |
| `apps/agent/test/helpers/cassette-client.test.ts` | Create | Cassette replay/record harness tests |
| `apps/agent/test/fixtures/briefs/initial-fashion-tier-2.ts` | Create | Fixture `BriefAnalyzerInput` for the L2 test |
| `apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json` | Create (post-record) | Recorded Claude response (committed) |
| `apps/agent/test/integration/initial-fashion-tier-2.test.ts` | Create | First L2 cassette-replay end-to-end test |
| `apps/agent/scripts/run-live-tests.mjs` | Create | Cross-platform `--env-file` runner for `pnpm test:claude:live` |
| `apps/agent/vitest.config.ts` | Modify | Include `test/**/*.test.ts` and `test/integration/**/*.test.ts` patterns |
| `apps/agent/package.json` | Modify | Add `test:claude:live` script; pin no new prod deps |

## Module surface contracts

These interfaces are the binding contract between Phase 2 modules and the Phase 3 orchestrator. They are referenced by tasks below.

```ts
// prompt-builder.ts
import type {
  BankCatalog, FrameworkSeedResult, NicheSlug, Tier,
  PhotoBlock, BriefAnalyzerInput, PriorRunContext, BuiltPrompt,
} from './types/v2';

export function renderLayer1(): string;
export function renderLayer2Text(input: BriefAnalyzerInput, nicheBriefMarkdown: string): string;
export function renderLayer3(input: BriefAnalyzerInput, seed: FrameworkSeedResult, catalog: BankCatalog, prior?: PriorRunContext): string;
export function renderReanalysisContextBlock(prior?: PriorRunContext): string;
export function renderLayer4(): string;
export function buildPromptMessages(args: {
  brief: BriefAnalyzerInput;
  seed: FrameworkSeedResult;
  catalog: BankCatalog;
  photos: PhotoBlock[];
  logo?: PhotoBlock;
  prior?: PriorRunContext;
}): BuiltPrompt;

// output-validator.ts
import type {
  AiOutput,
  FrameworkSeedResult,
  Tier,
  ValidationFailure,    // canonical shape lives in types/v2.ts (Phase 2 Task 2)
} from './types/v2';
export function validateAiOutput(
  raw: unknown,
  seed: FrameworkSeedResult,
  tier: Tier,
): { ok: true; value: AiOutput } | { ok: false; failure: ValidationFailure };

// fabrication-audit.ts
import type { AiOutput, Violation } from './types/v2';
export function auditFabrication(aiOutput: AiOutput, customerBackstory: string): Violation[];

// post-processor.ts
import type { AiOutput, SupersetOutput, NicheSlug, Tier } from './types/v2';
export function postProcess(args: {
  aiOutput: AiOutput;
  niche: NicheSlug;
  tier: Tier;
  hasPhotos: boolean;
  reanalyzed: boolean;
  postHocViolations: number;
}): SupersetOutput;
```

---

## Task 1 — Phase 2 setup: live-mode runner + vitest config

**Files:**
- Create: `apps/agent/scripts/run-live-tests.mjs`
- Modify: `apps/agent/package.json` (add `test:claude:live` script)
- Modify: `apps/agent/vitest.config.ts` (include `test/` paths)

The goal is a cross-platform script that spawns vitest with Node's native `--env-file` flag pointed at `../../../../.env` (the master env at the repo parent — four levels up from `apps/agent/scripts/`), sets `CLAUDE_LIVE=1`, and routes vitest at the integration tests only. No new dependencies.

- [ ] **Step 1: Create the live-mode runner**

Write `apps/agent/scripts/run-live-tests.mjs`:

```js
#!/usr/bin/env node
// Cross-platform runner for cassette-recording mode.
// Usage:  pnpm test:claude:live           — runs all integration tests in record mode
//         pnpm test:claude:live <pattern> — runs only matching test names
// Loads master .env from repo parent dir via Node 20 --env-file flag.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// agent/scripts/ → agent/ → apps/ → operscale-calendar-platform/ → operscale-calender/.env
const masterEnvPath = path.resolve(__dirname, '../../../../.env');

if (!existsSync(masterEnvPath)) {
  console.error(`[run-live-tests] master .env not found at ${masterEnvPath}`);
  console.error('[run-live-tests] this script is for local cassette recording only;');
  console.error('[run-live-tests] CI runs `pnpm test` (replay mode) and never needs it.');
  process.exit(1);
}

const vitestArgs = ['exec', 'vitest', 'run', 'test/integration', ...process.argv.slice(2)];
const child = spawn('pnpm', vitestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CLAUDE_LIVE: '1',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --env-file=${masterEnvPath}`.trim(),
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
```

- [ ] **Step 2: Wire the npm script**

In `apps/agent/package.json`, replace the `"scripts"` block to add `test:claude:live`:

```json
"scripts": {
  "dev": "next dev --port 3002",
  "build": "next build",
  "start": "next start --port 3002 --hostname 0.0.0.0",
  "typecheck": "tsc --noEmit",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:claude:live": "node scripts/run-live-tests.mjs"
}
```

- [ ] **Step 3: Extend vitest config to pick up `test/**`**

Replace `apps/agent/vitest.config.ts` with:

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globals: false,
    testTimeout: 180_000, // L2 record-mode calls Anthropic; replay mode finishes in ms.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/__sanity__/**', 'src/lib/__fixtures__/**'],
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Sanity-run the existing suite**

Run from repo root:

```bash
pnpm --filter @operscale-calendar/agent test
```

Expected: 46 passing tests, 0 failures (no behaviour change yet — the new include path is additive and `test/` doesn't exist).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/scripts/run-live-tests.mjs apps/agent/package.json apps/agent/vitest.config.ts
git commit -m "$(cat <<'EOF'
chore(agent): add test:claude:live runner + vitest test/ path

Cross-platform Node 20 --env-file runner spawns vitest in CLAUDE_LIVE=1
mode pointed at the master .env at the repo parent dir. Vitest now also
includes test/**/*.test.ts so Phase 2's integration tests can live there.
No prod-dep changes; no behaviour change for `pnpm test`.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Add Phase 2 types to `v2.ts`

**Files:**
- Modify: `apps/agent/src/lib/types/v2.ts`
- Modify: `apps/agent/src/lib/types/v2.test.ts`

These types are the contract between the worker (Phase 3), the prompt-builder, the output-validator, and the cassette test. They live in `v2.ts` because they are referenced by more than one module.

- [ ] **Step 1: Write the failing test**

Append to `apps/agent/src/lib/types/v2.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type {
  PhotoBlock,
  BriefAnalyzerInput,
  PriorRunContext,
  AnalysisEdit,
  BuiltPrompt,
  ValidationFailure,
} from './v2';

describe('Phase 2 types', () => {
  it('PhotoBlock has base64 + mediaType + role', () => {
    const p: PhotoBlock = {
      role: 'reference',
      mediaType: 'image/jpeg',
      base64: 'AAAA',
    };
    expectTypeOf(p.role).toEqualTypeOf<'reference' | 'logo'>();
  });

  it('BriefAnalyzerInput carries the seven form steps + meta', () => {
    const b: BriefAnalyzerInput = {
      brief_id: '00000000-0000-0000-0000-000000000000',
      customer_id: '11111111-1111-1111-1111-111111111111',
      submitted_at_iso: '2026-05-04T09:00:00Z',
      submission_week_iso: '2026-W18',
      order_index: 1,
      tier: 'standard',
      niche_slug: 'fashion',
      niche_label: 'Fashion e-commerce',
      brand_name: 'Acme Ankara',
      owner_name: 'Akinwunmi',
      phone_e164: '+2348165799032',
      email: 'owner@example.com',
      one_line_description: 'Custom ankara dresses for Lagos professionals.',
      offer_description: 'Bespoke ankara womenswear, three-week turnaround.',
      price_point_band: 'NGN 80k–250k per piece',
      primary_audience_description: 'Lagos women, 28–45, established professionals.',
      audience_age_range: '28–45',
      audience_location: 'Lagos, Abuja',
      audience_belief: 'Custom takes too long and is unreliable.',
      audience_belief_target: 'Three-week guaranteed turnaround on bespoke is real.',
      logo_uploaded_yes_no: 'yes',
      brand_colours: 'rust, ivory, navy',
      instagram_handle: '@acmeankara',
      photo_count: 3,
      photo_consent_yes_no: 'yes',
      stated_voice: 'crafted, direct, no-nonsense',
      reference_posts_block: '',
      customer_backstory_verbatim: '',
      video_count: 14,
      carousel_count: 7,
    };
    expectTypeOf(b.tier).toEqualTypeOf<'starter' | 'standard' | 'calendar'>();
  });

  it('PriorRunContext links prior run + edits + founder note', () => {
    const p: PriorRunContext = {
      prior_run_id: '22222222-2222-2222-2222-222222222222',
      prior_run_index: 1,
      mode: 'new_frameworks',
      founder_note: 'The hooks were too generic — push for craft specifics.',
      edits: [
        {
          field_path: 'calendar_plan[0].hook',
          before: 'Five reasons our pieces last',
          after: '14 hours of hand-finishing — this is what that looks like',
        },
      ],
    };
    expectTypeOf(p.mode).toEqualTypeOf<'same_frameworks' | 'new_frameworks'>();
  });

  it('AnalysisEdit has field_path / before / after', () => {
    const e: AnalysisEdit = {
      field_path: 'brand_voice.voice_phrases[0]',
      before: 'timeless',
      after: 'crafted',
    };
    expectTypeOf(e.field_path).toEqualTypeOf<string>();
  });

  it('BuiltPrompt holds system + Anthropic-shaped messages', () => {
    const out: BuiltPrompt = {
      system: 'system text',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
    };
    expectTypeOf(out.system).toEqualTypeOf<string>();
    expectTypeOf(out.messages).toEqualTypeOf<import('./v2').PromptUserMessage[]>();
  });

  it('ValidationFailure has all four reason variants', () => {
    // The const annotations below are the type test — TS rejects an unknown
    // reason literal or a missing reason-specific field at compile time.
    const a: ValidationFailure = { reason: 'malformed_json', detail: 'unexpected token' };
    const b: ValidationFailure = { reason: 'schema_mismatch', detail: 'shape', zodIssues: [] };
    const c: ValidationFailure = { reason: 'slot_count_mismatch', detail: '21 vs 10', expected: 10, actual: 21 };
    const d: ValidationFailure = { reason: 'unauthorized_slot', detail: 'AIDA used', offenders: ['framework:AIDA'] };
    expect([a, b, c, d].map((f) => f.reason)).toEqual([
      'malformed_json',
      'schema_mismatch',
      'slot_count_mismatch',
      'unauthorized_slot',
    ]);
  });
});
```

NOTE: Vitest 1.6.1 types `.toBeString()` / `.toBeArray()` as non-callable for
some actual types; we use `.toEqualTypeOf<...>()` which is strictly stronger
(compile-time vs runtime).

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: type errors on the missing exports `PhotoBlock`, `BriefAnalyzerInput`, `PriorRunContext`, `AnalysisEdit`, `BuiltPrompt`.

- [ ] **Step 3: Add the types to `v2.ts`**

Append to `apps/agent/src/lib/types/v2.ts`:

```ts
// ─── Phase 2 types: prompt-builder + cassette test ──────────────────────────

// Vision blocks for the Anthropic call. Worker fetches photo bytes per job
// claim (design §6.1) and base64-encodes them in memory; prompt-builder is
// pure and only reads.
export interface PhotoBlock {
  role: 'reference' | 'logo';
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
}

// The prompt-builder's input contract. Worker projects briefs.form_payload
// JSONB into this shape (Phase 3); cassette tests pass a fixture directly.
// Field names mirror ai-brief-analysis.md §3.2 Layer 2 substitution markers.
export interface BriefAnalyzerInput {
  brief_id: string;
  customer_id: string;
  submitted_at_iso: string;
  submission_week_iso: string;
  order_index: number;
  tier: Tier;

  niche_slug: NicheSlug;   // matches the {{niche_slug}} marker in ai-brief-analysis.md §3.2
  niche_label: string;

  // Step 1
  brand_name: string;
  owner_name: string;
  phone_e164: string;
  email: string;

  // Step 2
  one_line_description: string;
  offer_description: string;
  price_point_band: string;

  // Step 3
  primary_audience_description: string;
  audience_age_range: string;
  audience_location: string;
  audience_belief: string;
  audience_belief_target: string;

  // Step 4
  logo_uploaded_yes_no: 'yes' | 'no';
  brand_colours: string;
  instagram_handle: string;

  // Step 5
  photo_count: number;
  photo_consent_yes_no: 'yes' | 'no';

  // Step 6
  stated_voice: string;
  reference_posts_block: string;            // pre-rendered text+URL bodies, may be empty
  customer_backstory_verbatim: string;      // empty string when not provided

  // Step 7 — sourced from TIER_COUNTS but echoed here for prompt fidelity
  video_count: number;
  carousel_count: number;
}

// Re-analysis context. Carries the founder's note + the diff of edits the
// founder applied to the prior run. prompt-builder renders these into Layer 3.
export interface AnalysisEdit {
  field_path: string;   // e.g. "calendar_plan[3].hook"
  before: string;       // value emitted by Claude in the prior run
  after: string;        // value the founder substituted
}

export interface PriorRunContext {
  prior_run_id: string;
  prior_run_index: number;
  mode: ReanalyzeMode;
  founder_note: string;
  edits: AnalysisEdit[];
}

// Anthropic-shaped output of buildPromptMessages.
// Imported as `MessageParam` shape from @anthropic-ai/sdk; we keep our own
// minimal mirror so tests don't pull SDK types into pure modules.
export interface PromptTextBlock { type: 'text'; text: string; }
export interface PromptImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: PhotoBlock['mediaType']; data: string };
}
export type PromptUserContentBlock = PromptTextBlock | PromptImageBlock;

// role is always 'user'; Phase 2 prompts have no pre-seeded assistant turns
// (see ai-brief-analysis.md §4 — three user messages, single Claude response).
export interface PromptUserMessage {
  role: 'user';
  content: PromptUserContentBlock[];
}

export interface BuiltPrompt {
  system: string;
  messages: PromptUserMessage[];
}

// Output-validator failure variants per ai-brief-analysis.md §6. Lives in v2.ts
// because the Phase 3 worker (orchestrator) consumes these to populate
// activity_log.payload.reason on ai_analysis_failed events.
export type ValidationFailure =
  | { reason: 'malformed_json'; detail: string }
  | { reason: 'schema_mismatch'; detail: string; zodIssues: import('zod').ZodIssue[] }
  | { reason: 'slot_count_mismatch'; detail: string; expected: number; actual: number }
  | { reason: 'unauthorized_slot'; detail: string; offenders: string[] };
```

- [ ] **Step 4: Verify the type tests pass**

```bash
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent test src/lib/types/v2.test.ts
```

Expected: typecheck clean; v2.test.ts passes (existing 9 + new 6 = 15).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/types/v2.ts apps/agent/src/lib/types/v2.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): V2 types for prompt-builder + reanalysis context

Adds PhotoBlock, BriefAnalyzerInput, PriorRunContext, AnalysisEdit,
BuiltPrompt (with PromptTextBlock/PromptImageBlock) to v2.ts. These
are the contract the Phase 2 pure modules and the Phase 3 worker share.
Field names mirror ai-brief-analysis.md §3.2 substitution markers so the
worker's row-projection step is mechanical.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — `prompt-builder.ts`: Layer 1 (system framing)

**Files:**
- Create: `apps/agent/src/lib/prompt-builder.ts`
- Create: `apps/agent/src/lib/prompt-builder.test.ts`

Layer 1 is the Claude `system` parameter. It is verbatim from `ai-brief-analysis.md` §3.1 with no substitutions. The function returns a static string.

- [ ] **Step 1: Write the failing test**

Create `apps/agent/src/lib/prompt-builder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderLayer1 } from './prompt-builder';

describe('renderLayer1', () => {
  it('returns the system framing as a non-empty string', () => {
    const out = renderLayer1();
    expect(out.length).toBeGreaterThan(500);
  });

  it('opens with the role definition from ai-brief-analysis.md §3.1', () => {
    const out = renderLayer1();
    expect(out).toMatch(/^You are a senior content strategist at a Lagos-based SMB content agency\./);
  });

  it('encodes the three rules in order', () => {
    const out = renderLayer1();
    const r1 = out.indexOf('RULE 1 — NO FABRICATION.');
    const r2 = out.indexOf('RULE 2 — FRAMEWORKS BY NAME OF FRAMEWORK, NOT BY NAME OF MARKETER.');
    const r3 = out.indexOf('RULE 3 — DETERMINISTIC SELECTION.');
    expect(r1).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });

  it('forbids prose preamble around the JSON', () => {
    const out = renderLayer1();
    expect(out).toContain('No prose outside the JSON');
    expect(out).toContain('No preamble');
    expect(out).toContain('Just the JSON object.');
  });

  it('is stable across calls (pure function)', () => {
    expect(renderLayer1()).toEqual(renderLayer1());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: FAIL — `prompt-builder` module not found.

- [ ] **Step 3: Implement `renderLayer1`**

Create `apps/agent/src/lib/prompt-builder.ts`:

```ts
// Renders the four-layer V2 prompt verbatim from
// docs/specs/ai-brief-analysis.md §3.
// Pure: no I/O, no Claude calls. Phase 3 worker calls buildPromptMessages and
// passes the result to the Anthropic SDK.

import type {
  BankCatalog,
  BriefAnalyzerInput,
  BuiltPrompt,
  FrameworkSeedResult,
  PhotoBlock,
  PriorRunContext,
  PromptUserContentBlock,
  PromptUserMessage,
} from './types/v2';

// ─── Layer 1 — System framing (ai-brief-analysis.md §3.1) ───────────────────
const LAYER_1 = `You are a senior content strategist at a Lagos-based SMB content agency. You have eight years
of experience producing short-form social-video calendars for African and global SMBs across
beauty, real-estate, fashion, fintech, health, food, and education. You are technically literate
in copywriting frameworks, you read brand voice as a researcher rather than a fan, and you write
briefs that another senior producer could shoot from without you.

Your job in this conversation is to produce a structured brief analysis for ONE customer's
content calendar. The output is reviewed by the agency founder before anything is sent to the
customer; you are the analyst, not the final approver.

Three rules govern everything you produce. Internalise them; they override every other instinct.

RULE 1 — NO FABRICATION.
You produce content ABOUT the customer's business — never invented content FROM the customer's
biography. Specifically:
  - You do NOT invent founder origin stories. If the customer typed "I started this business in
    2019 because I couldn't find good products" in form step 6, you may use that. If the customer
    did not write a backstory, you do not produce one.
  - You do NOT invent customer testimonials, transformations, or named-customer narratives.
    Outcomes are spoken at the category level ("clients commonly see X"), never with invented
    individual names.
  - You do NOT invent family or cultural background ("my grandmother taught me", "my mum's
    recipe") unless the customer explicitly stated it.
  - First-person opinion IS allowed ("In my experience X..."). Generic authority numbers ARE
    allowed ("After hundreds of inspections..."). The line is between opinion the customer
    plausibly holds and biographical claims that would be lies if challenged.
  - Full taxonomy: see docs/specs/content-types-allowed.md.

RULE 2 — FRAMEWORKS BY NAME OF FRAMEWORK, NOT BY NAME OF MARKETER.
You reference structural patterns by their canonical names (DR Formula, PAS, AIDA, Value
Equation, Hook Stack, Open Loop, Pattern Interrupt, Myth-Buster, etc.). You do NOT write "in the
style of [marketer's name]". The frameworks are tools; the names of the people who taught them
are not part of the customer's deliverable.

RULE 3 — DETERMINISTIC SELECTION.
The frameworks and archetypes you may use have already been selected by a deterministic seed
(passed to you in Layer 3). You do NOT pick from outside that selection. If a framework or
archetype is not in the selection list, it is not available for this customer for this order.

You produce output in valid JSON matching the schema in Layer 4. No prose outside the JSON. No
preamble. No "here is the analysis" line. Just the JSON object.`;

export function renderLayer1(): string {
  return LAYER_1;
}
```

- [ ] **Step 4: Verify the test passes**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/prompt-builder.ts apps/agent/src/lib/prompt-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): prompt-builder Layer 1 system framing

Renders ai-brief-analysis.md §3.1 verbatim as the Claude system parameter.
Pure function, stable across calls. Five unit tests cover ordering of the
three rules and the no-prose-around-JSON instruction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `prompt-builder.ts`: Layer 2 (customer corpus + niche brief)

**Files:**
- Modify: `apps/agent/src/lib/prompt-builder.ts`
- Modify: `apps/agent/src/lib/prompt-builder.test.ts`

Layer 2 is the first user message text. Photos are added as image blocks at the message-assembly step (Task 7); this function returns ONLY the text portion. Substitutions follow `ai-brief-analysis.md` §3.2.

- [ ] **Step 1: Write the failing tests**

Append to `apps/agent/src/lib/prompt-builder.test.ts`:

```ts
import { renderLayer2Text } from './prompt-builder';
import type { BriefAnalyzerInput } from './types/v2';

const SAMPLE_BRIEF: BriefAnalyzerInput = {
  brief_id: '00000000-0000-0000-0000-000000000000',
  customer_id: '11111111-1111-1111-1111-111111111111',
  submitted_at_iso: '2026-05-04T09:00:00Z',
  submission_week_iso: '2026-W18',
  order_index: 1,
  tier: 'standard',
  niche_slug: 'fashion',
  niche_label: 'Fashion e-commerce',
  brand_name: 'Acme Ankara',
  owner_name: 'Akinwunmi',
  phone_e164: '+2348165799032',
  email: 'owner@example.com',
  one_line_description: 'Custom ankara dresses for Lagos professionals.',
  offer_description: 'Bespoke ankara womenswear, three-week turnaround.',
  price_point_band: 'NGN 80k–250k per piece',
  primary_audience_description: 'Lagos women, 28–45, established professionals.',
  audience_age_range: '28–45',
  audience_location: 'Lagos, Abuja',
  audience_belief: 'Custom takes too long and is unreliable.',
  audience_belief_target: 'Three-week guaranteed turnaround on bespoke is real.',
  logo_uploaded_yes_no: 'yes',
  brand_colours: 'rust, ivory, navy',
  instagram_handle: '@acmeankara',
  photo_count: 3,
  photo_consent_yes_no: 'yes',
  stated_voice: 'crafted, direct, no-nonsense',
  reference_posts_block: '— Post 1: "14 hours of hand-finishing per piece..."',
  customer_backstory_verbatim: '',
  video_count: 14,
  carousel_count: 7,
};

const SAMPLE_NICHE_BRIEF = '# Niche brief: Fashion (test)\n\nFashion is craft-substantiated.';

describe('renderLayer2Text', () => {
  it('starts with the # CUSTOMER CORPUS header', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('# CUSTOMER CORPUS');
  });

  it('substitutes step 1 fields (brand, owner, phone, email)', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Brand name: Acme Ankara');
    expect(out).toContain('- Owner name: Akinwunmi');
    expect(out).toContain('- WhatsApp: +2348165799032');
    expect(out).toContain('- Email: owner@example.com');
  });

  it('substitutes step 2 fields (niche slug + label, offer, price band)', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Niche: fashion (Fashion e-commerce)');
    expect(out).toContain('- One-line description: Custom ankara dresses for Lagos professionals.');
    expect(out).toContain('- What they sell: Bespoke ankara womenswear, three-week turnaround.');
    expect(out).toContain('- Price point band: NGN 80k–250k per piece');
  });

  it('substitutes step 3 audience fields', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Primary audience: Lagos women, 28–45, established professionals.');
    expect(out).toContain('- Audience age range: 28–45');
    expect(out).toContain('- Audience location: Lagos, Abuja');
    expect(out).toContain('- What audience already believes: Custom takes too long and is unreliable.');
    expect(out).toContain('- What audience needs to believe to buy: Three-week guaranteed turnaround on bespoke is real.');
  });

  it('substitutes step 4 brand asset fields', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Logo uploaded: yes');
    expect(out).toContain('- Brand colours (if stated): rust, ivory, navy');
    expect(out).toContain('- Existing IG handle: @acmeankara');
  });

  it('substitutes step 5 photo fields with the count', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Photos uploaded: 3 (see vision blocks above)');
    expect(out).toContain('- Photo consent: yes');
  });

  it('substitutes step 6 voice + reference posts + backstory verbatim', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Stated brand voice: crafted, direct, no-nonsense');
    expect(out).toContain('— Post 1: "14 hours of hand-finishing per piece..."');
  });

  it('renders empty backstory verbatim as a literal empty marker, not the string "undefined"', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).not.toContain('undefined');
    expect(out).toContain('What customer wrote about their backstory (verbatim, may be empty):');
  });

  it('substitutes step 7 calendar choice (tier, video_count, carousel_count)', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Tier: standard');
    expect(out).toContain('- Number of videos: 14');
    expect(out).toContain('- Number of carousels: 7');
  });

  it('appends the niche brief verbatim under ## Niche brief', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('## Niche brief');
    expect(out).toContain('# Niche brief: Fashion (test)');
    expect(out).toContain('Fashion is craft-substantiated.');
  });

  it('mentions vision blocks above the text portion', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    // The text refers to "see vision blocks above" — the vision blocks themselves are added
    // by buildPromptMessages, not by renderLayer2Text.
    expect(out).toContain('see vision blocks above');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: FAIL — `renderLayer2Text` not exported.

- [ ] **Step 3: Implement `renderLayer2Text`**

Append to `apps/agent/src/lib/prompt-builder.ts`:

```ts
// ─── Layer 2 — Customer corpus (ai-brief-analysis.md §3.2) ──────────────────
// Photos and brand logo enter as image blocks at message-assembly time
// (buildPromptMessages). This function returns only the text portion.
export function renderLayer2Text(input: BriefAnalyzerInput, nicheBriefMarkdown: string): string {
  return `# CUSTOMER CORPUS

## Form payload

The customer submitted this form on ${input.submitted_at_iso} (WAT).

### Step 1 — Who they are
- Brand name: ${input.brand_name}
- Owner name: ${input.owner_name}
- WhatsApp: ${input.phone_e164}
- Email: ${input.email}

### Step 2 — Niche and offer
- Niche: ${input.niche_slug} (${input.niche_label})
- One-line description: ${input.one_line_description}
- What they sell: ${input.offer_description}
- Price point band: ${input.price_point_band}

### Step 3 — Audience
- Primary audience: ${input.primary_audience_description}
- Audience age range: ${input.audience_age_range}
- Audience location: ${input.audience_location}
- What audience already believes: ${input.audience_belief}
- What audience needs to believe to buy: ${input.audience_belief_target}

### Step 4 — Brand assets
- Logo uploaded: ${input.logo_uploaded_yes_no}
- Brand colours (if stated): ${input.brand_colours}
- Existing IG handle: ${input.instagram_handle}

### Step 5 — Photos
- Photos uploaded: ${input.photo_count} (see vision blocks above)
- Photo consent: ${input.photo_consent_yes_no}

### Step 6 — Voice and references
- Stated brand voice: ${input.stated_voice}
- Reference posts (verbatim text and URL-fetched bodies):
  ${input.reference_posts_block || '(none provided)'}
- What customer wrote about their backstory (verbatim, may be empty):
  ${input.customer_backstory_verbatim || '(empty)'}

### Step 7 — Calendar choice
- Tier: ${input.tier}
- Number of videos: ${input.video_count}
- Number of carousels: ${input.carousel_count}

## Niche brief

The following is the agency's niche brief for ${input.niche_slug}. Use it as authoritative context on
audience, voice, restricted claims, and topic library — but never substitute it for the customer's
own stated voice or facts.

${nicheBriefMarkdown}`;
}
```

- [ ] **Step 4: Verify tests pass**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: 16 passing (5 from Layer 1 + 11 new).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/prompt-builder.ts apps/agent/src/lib/prompt-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): prompt-builder Layer 2 customer corpus

Renders ai-brief-analysis.md §3.2 — the form payload's seven steps + niche
brief — as the text portion of the first user message. Vision blocks are
added by buildPromptMessages at message assembly. Empty backstory and
empty reference_posts collapse to literal markers, never the string
"undefined".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — `prompt-builder.ts`: Layer 3 (selection inputs)

**Files:**
- Modify: `apps/agent/src/lib/prompt-builder.ts`
- Modify: `apps/agent/src/lib/prompt-builder.test.ts`

Layer 3 carries the deterministic selection (seed, frameworks, archetypes, pairs), the customer history exclusion list, and the bank-exhaustion flag. The re-analysis context block is rendered separately in Task 6 and appended.

- [ ] **Step 1: Write the failing tests**

Append to `apps/agent/src/lib/prompt-builder.test.ts`:

```ts
import { renderLayer3 } from './prompt-builder';
import type { BankCatalog, FrameworkSeedResult } from './types/v2';

function makeCatalogStub(): BankCatalog {
  // Minimal catalog with only the two slots used by SAMPLE_SEED below.
  return {
    frameworks: {
      DR_FORMULA: {
        slot: 'DR_FORMULA',
        name: 'DR Formula',
        family: 'Family A — Direct response',
        markdown: '### 3.1 DR Formula\n\nProblem → Promise → Proof → CTA.\n\nHook style: blunt promise opener.',
        affinity: { beauty: 'Med', real_estate: 'High', fashion: 'Med', fintech: 'High', health: 'Med', food: 'Med', education: 'Med' },
      },
      PAS: {
        slot: 'PAS',
        name: 'PAS',
        family: 'Family A — Direct response',
        markdown: '### 3.2 PAS\n\nProblem → Agitate → Solution.\n\nHook style: pain-naming opener.',
        affinity: { beauty: 'Low', real_estate: 'Med', fashion: 'Low', fintech: 'High', health: 'High', food: 'Med', education: 'Low' },
      },
    } as BankCatalog['frameworks'],
    archetypes: {
      PRICING_BREAKDOWN: {
        slot: 'PRICING_BREAKDOWN',
        name: 'Pricing Breakdown',
        family: 'Family A — Customer-stated facts',
        markdown: '### 3.1 Pricing Breakdown\n\nWhat goes into the price.',
        affinity: { beauty: 'Med', real_estate: 'High', fashion: 'High', fintech: 'High', health: 'Med', food: 'Med', education: 'Low' },
      },
      PROCESS_TOUR: {
        slot: 'PROCESS_TOUR',
        name: 'Process Tour',
        family: 'Family B — Customer expertise',
        markdown: '### 4.4 Process Tour\n\nThe steps inside how a thing is made.',
        affinity: { beauty: 'High', real_estate: 'Med', fashion: 'High', fintech: 'Low', health: 'Med', food: 'High', education: 'Med' },
      },
    } as BankCatalog['archetypes'],
    niches: { fashion: '# fashion', beauty: '# beauty', real_estate: '# re', fintech: '# ft', health: '# h', food: '# f', education: '# e' } as BankCatalog['niches'],
  };
}

const SAMPLE_SEED: FrameworkSeedResult = {
  seed_hash: 'a3f9e2d18c4b7a05',
  seed_inputs: {
    customer_id: '11111111-1111-1111-1111-111111111111',
    niche: 'fashion',
    order_index: 1,
    submission_week_iso: '2026-W18',
  },
  selected_frameworks: ['DR_FORMULA', 'PAS'],
  selected_archetypes: ['PRICING_BREAKDOWN', 'PROCESS_TOUR'],
  selected_pairs: [
    { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
    { framework: 'PAS', archetype: 'PROCESS_TOUR', affinity: 4 },
  ],
  exhaustion_warning: false,
  lru_fallback_used: false,
};

describe('renderLayer3', () => {
  const catalog = makeCatalogStub();

  it('starts with # SELECTION INPUTS', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('# SELECTION INPUTS');
  });

  it('renders seed_inputs and seed_hash from §3.3', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('customer_id: 11111111-1111-1111-1111-111111111111');
    expect(out).toContain('niche: fashion');
    expect(out).toContain('order_index: 1');
    expect(out).toContain('submission_week_iso: 2026-W18');
    expect(out).toContain('seed_hash: a3f9e2d18c4b7a05');
  });

  it('emits N selected frameworks under "Selected frameworks (for this <tier> order)"', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Selected frameworks (for this standard order)');
    expect(out).toContain('You will use these 2 frameworks, no others:');
    expect(out).toContain('### DR_FORMULA — DR Formula');
    expect(out).toContain('Problem → Promise → Proof → CTA.');
    expect(out).toContain('### PAS — PAS');
  });

  it('emits N selected archetypes under "Selected archetypes (for this <tier> order)"', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Selected archetypes (for this standard order)');
    expect(out).toContain('You will use these 2 archetypes, no others:');
    expect(out).toContain('### PRICING_BREAKDOWN — Pricing Breakdown');
    expect(out).toContain('### PROCESS_TOUR — Process Tour');
  });

  it('renders the pair-assignments table with all selected_pairs', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Selected pairs');
    expect(out).toContain('| slot | framework | archetype | affinity |');
    expect(out).toContain('|------|-----------|-----------|----------|');
    expect(out).toContain('|    1 | DR_FORMULA | PRICING_BREAKDOWN | 9 |');
    expect(out).toContain('|    2 | PAS | PROCESS_TOUR | 4 |');
  });

  it('renders the customer-history excluded-pairs block (empty when no LRU fallback)', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Customer history (repeat customers only)');
    expect(out).toContain('(no historical pairs to exclude — first-time customer or fresh bank)');
  });

  it('lists LRU-reused pairs when lru_fallback_used is true', () => {
    const seedWithLru: FrameworkSeedResult = {
      ...SAMPLE_SEED,
      lru_fallback_used: true,
      lru_pairs_reused: [
        { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', last_used_at: '2026-02-10T00:00:00Z' },
      ],
    };
    const out = renderLayer3(SAMPLE_BRIEF, seedWithLru, catalog);
    expect(out).toContain('## Customer history (repeat customers only)');
    expect(out).toContain('DR_FORMULA × PRICING_BREAKDOWN (last used 2026-02-10');
  });

  it('renders the not-exhausted bank exhaustion message when exhaustion_warning=false', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Bank exhaustion flag');
    expect(out).toContain('Not exhausted. Selection drew from the unused bank for this customer.');
  });

  it('renders the exhausted-bank instructions when exhaustion_warning=true', () => {
    const exhaustedSeed: FrameworkSeedResult = { ...SAMPLE_SEED, exhaustion_warning: true, lru_fallback_used: true };
    const out = renderLayer3(SAMPLE_BRIEF, exhaustedSeed, catalog);
    expect(out).toContain('EXHAUSTED — this customer has run through the unused bank.');
    expect(out).toContain("'bank_exhausted_lru_fallback'");
  });

  it('omits the re-analysis context block when no prior context', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    // Section header still appears, with empty marker
    expect(out).toContain('## Re-analysis context');
    expect(out).toContain('(none — this is the initial analysis for this brief)');
  });

  it('throws when a selected slot is missing from the catalog', () => {
    const seedWithUnknownSlot: FrameworkSeedResult = {
      ...SAMPLE_SEED,
      selected_frameworks: ['DR_FORMULA', 'AIDA'],
      selected_pairs: [
        { framework: 'AIDA', archetype: 'PROCESS_TOUR', affinity: 4 },
      ],
    };
    expect(() => renderLayer3(SAMPLE_BRIEF, seedWithUnknownSlot, catalog)).toThrow(/AIDA/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: FAIL — `renderLayer3` not exported.

- [ ] **Step 3: Implement `renderLayer3`**

Append to `apps/agent/src/lib/prompt-builder.ts`:

```ts
// ─── Layer 3 — Selection inputs (ai-brief-analysis.md §3.3) ─────────────────
function renderHistoryBlock(seed: FrameworkSeedResult): string {
  if (!seed.lru_fallback_used || !seed.lru_pairs_reused || seed.lru_pairs_reused.length === 0) {
    return '(no historical pairs to exclude — first-time customer or fresh bank)';
  }
  return seed.lru_pairs_reused
    .map((p) => `- ${p.framework} × ${p.archetype} (last used ${p.last_used_at})`)
    .join('\n');
}

function renderExhaustionBlock(seed: FrameworkSeedResult): string {
  if (!seed.exhaustion_warning) {
    return 'Not exhausted. Selection drew from the unused bank for this customer.';
  }
  return [
    "EXHAUSTED — this customer has run through the unused bank. The selection above",
    "used least-recently-used pairs as fallback. Flag this for the founder in your",
    "output's `flags_for_review` field with reason 'bank_exhausted_lru_fallback'.",
  ].join('\n');
}

function renderFrameworkExcerpt(slot: string, catalog: BankCatalog): string {
  const entry = catalog.frameworks[slot as keyof typeof catalog.frameworks];
  if (!entry) {
    throw new Error(`renderLayer3: framework slot ${slot} not found in catalog`);
  }
  return `### ${entry.slot} — ${entry.name}\n\n${entry.markdown.trim()}`;
}

function renderArchetypeExcerpt(slot: string, catalog: BankCatalog): string {
  const entry = catalog.archetypes[slot as keyof typeof catalog.archetypes];
  if (!entry) {
    throw new Error(`renderLayer3: archetype slot ${slot} not found in catalog`);
  }
  return `### ${entry.slot} — ${entry.name}\n\n${entry.markdown.trim()}`;
}

function renderPairTable(seed: FrameworkSeedResult): string {
  const header = '| slot | framework | archetype | affinity |\n|------|-----------|-----------|----------|';
  const rows = seed.selected_pairs.map(
    (p, idx) => `| ${String(idx + 1).padStart(4, ' ')} | ${p.framework} | ${p.archetype} | ${p.affinity} |`,
  );
  return [header, ...rows].join('\n');
}

export function renderLayer3(
  input: BriefAnalyzerInput,
  seed: FrameworkSeedResult,
  catalog: BankCatalog,
  prior?: PriorRunContext,
): string {
  const frameworkExcerpts = seed.selected_frameworks
    .map((slot) => renderFrameworkExcerpt(slot, catalog))
    .join('\n\n');
  const archetypeExcerpts = seed.selected_archetypes
    .map((slot) => renderArchetypeExcerpt(slot, catalog))
    .join('\n\n');

  return `# SELECTION INPUTS

## Framework seed

The deterministic seed for this analysis was computed as:

  seed_inputs:
    customer_id: ${seed.seed_inputs.customer_id}
    niche: ${seed.seed_inputs.niche}
    order_index: ${seed.seed_inputs.order_index}
    submission_week_iso: ${seed.seed_inputs.submission_week_iso}
  seed_hash: ${seed.seed_hash}

## Selected frameworks (for this ${input.tier} order)

You will use these ${seed.selected_frameworks.length} frameworks, no others:

${frameworkExcerpts}

## Selected archetypes (for this ${input.tier} order)

You will use these ${seed.selected_archetypes.length} archetypes, no others:

${archetypeExcerpts}

## Selected pairs

The deterministic pairing assigns each video slot a (framework, archetype) pair as follows:

${renderPairTable(seed)}

## Customer history (repeat customers only)

The following (framework, archetype) pairs have been delivered to this customer in prior orders
and are excluded from re-use unless the bank is exhausted:

${renderHistoryBlock(seed)}

## Bank exhaustion flag

${renderExhaustionBlock(seed)}

## Re-analysis context

${renderReanalysisContextBlock(prior)}`;
}

// Defined here as a forward declaration; full body lands in Task 6.
export function renderReanalysisContextBlock(prior?: PriorRunContext): string {
  if (!prior) {
    return '(none — this is the initial analysis for this brief)';
  }
  return '(re-analysis context — implemented in Task 6)';
}
```

- [ ] **Step 4: Verify tests pass**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: 26 passing (16 prior + 10 new).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/prompt-builder.ts apps/agent/src/lib/prompt-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): prompt-builder Layer 3 selection inputs

Renders ai-brief-analysis.md §3.3 — seed, selected frameworks/archetypes
with bank-corpus excerpts, the pair-assignments table, customer-history
exclusion list, and the bank-exhaustion flag. Throws when a selected slot
is missing from the catalog (catches Phase-1 selector/catalog drift).
Re-analysis context is a forward-declared stub; Task 6 fills it in.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — `prompt-builder.ts`: re-analysis context block (Layer 3 extension)

**Files:**
- Modify: `apps/agent/src/lib/prompt-builder.ts`
- Modify: `apps/agent/src/lib/prompt-builder.test.ts`

Re-analysis context appears at the foot of Layer 3 when `prior` is supplied. It contains the founder's note verbatim and a structured "from / to" rendering of every founder edit applied to the prior run. Per `docs/specs/v2-pipeline-implementation-design.md` Q7 the edits are evidence of intent — they are NEVER auto-applied to the new run; they only enter the prompt as context.

- [ ] **Step 1: Write the failing tests**

Append to `apps/agent/src/lib/prompt-builder.test.ts`:

```ts
import { renderReanalysisContextBlock as renderReanalysis } from './prompt-builder';
import type { PriorRunContext } from './types/v2';

const SAMPLE_PRIOR: PriorRunContext = {
  prior_run_id: '22222222-2222-2222-2222-222222222222',
  prior_run_index: 1,
  mode: 'new_frameworks',
  founder_note: "The hooks were too generic — push for craft specifics like '14 hours of hand-finishing'.",
  edits: [
    {
      field_path: 'calendar_plan[0].hook',
      before: 'Five reasons our pieces last',
      after: '14 hours of hand-finishing — this is what that looks like',
    },
    {
      field_path: 'brand_voice.voice_phrases[1]',
      before: 'timeless',
      after: 'crafted',
    },
  ],
};

describe('renderReanalysisContextBlock', () => {
  it('returns the empty marker when prior is undefined', () => {
    expect(renderReanalysis(undefined)).toBe('(none — this is the initial analysis for this brief)');
  });

  it('emits the prior run reference and re-analysis mode', () => {
    const out = renderReanalysis(SAMPLE_PRIOR);
    expect(out).toContain('Prior run id: 22222222-2222-2222-2222-222222222222');
    expect(out).toContain('Prior run index: 1');
    expect(out).toContain('Re-analysis mode: new_frameworks');
  });

  it('includes the founder note verbatim under a labelled section', () => {
    const out = renderReanalysis(SAMPLE_PRIOR);
    expect(out).toContain('### Founder note (verbatim)');
    expect(out).toContain("The hooks were too generic — push for craft specifics like '14 hours of hand-finishing'.");
  });

  it('renders each edit as a from/to entry tied to its field_path', () => {
    const out = renderReanalysis(SAMPLE_PRIOR);
    expect(out).toContain('### Edits the founder applied to the prior run');
    expect(out).toContain('Field: calendar_plan[0].hook');
    expect(out).toContain('  from: "Five reasons our pieces last"');
    expect(out).toContain('  to:   "14 hours of hand-finishing — this is what that looks like"');
    expect(out).toContain('Field: brand_voice.voice_phrases[1]');
    expect(out).toContain('  from: "timeless"');
    expect(out).toContain('  to:   "crafted"');
  });

  it('explicitly tells the model the edits are evidence, not to be copied verbatim', () => {
    const out = renderReanalysis(SAMPLE_PRIOR);
    expect(out).toContain('These edits are evidence of founder intent');
    expect(out).toContain('NOT auto-applied');
  });

  it('renders an empty edits list with a marker (founder-note-only re-analysis)', () => {
    const noteOnly: PriorRunContext = { ...SAMPLE_PRIOR, edits: [] };
    const out = renderReanalysis(noteOnly);
    expect(out).toContain('### Edits the founder applied to the prior run');
    expect(out).toContain('(no edits — note-only re-analysis)');
  });

  it('escapes embedded double quotes in before/after values', () => {
    const withQuotes: PriorRunContext = {
      ...SAMPLE_PRIOR,
      edits: [
        { field_path: 'hook', before: 'She said "no thanks"', after: 'They said "yes"' },
      ],
    };
    const out = renderReanalysis(withQuotes);
    // Outer quotes wrap the value; embedded double quotes are escaped.
    expect(out).toContain('  from: "She said \\"no thanks\\""');
    expect(out).toContain('  to:   "They said \\"yes\\""');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: FAIL — current `renderReanalysisContextBlock` returns the stub string when `prior` is defined.

- [ ] **Step 3: Replace the stub with the real implementation**

In `apps/agent/src/lib/prompt-builder.ts`, replace the existing `renderReanalysisContextBlock` body with:

```ts
function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

export function renderReanalysisContextBlock(prior?: PriorRunContext): string {
  if (!prior) {
    return '(none — this is the initial analysis for this brief)';
  }

  const editsBlock =
    prior.edits.length === 0
      ? '(no edits — note-only re-analysis)'
      : prior.edits
          .map(
            (e) =>
              `Field: ${e.field_path}\n  from: "${escapeQuotes(e.before)}"\n  to:   "${escapeQuotes(e.after)}"`,
          )
          .join('\n\n');

  return `Prior run id: ${prior.prior_run_id}
Prior run index: ${prior.prior_run_index}
Re-analysis mode: ${prior.mode}

### Founder note (verbatim)

${prior.founder_note}

### Edits the founder applied to the prior run

These edits are evidence of founder intent. They are NOT auto-applied to your new output —
treat them as a guide to where the prior run missed the mark, then re-derive the affected
fields from the customer corpus and the lenses.

${editsBlock}`;
}
```

- [ ] **Step 4: Verify tests pass**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: 33 passing (26 prior + 7 new).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/prompt-builder.ts apps/agent/src/lib/prompt-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): prompt-builder re-analysis context block

Renders the prior-run id, mode, founder note (verbatim), and a from/to
rendering of every analysis_edits row tied to the prior run. Embedded
double-quotes are escaped so the model sees structurally valid lines.
The block explicitly states edits are evidence-of-intent, NOT to be
copied verbatim — per design doc Q7's no-auto-merge rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — `prompt-builder.ts`: Layer 4 + top-level `buildPromptMessages`

**Files:**
- Modify: `apps/agent/src/lib/prompt-builder.ts`
- Modify: `apps/agent/src/lib/prompt-builder.test.ts`

Layer 4 is verbatim from `ai-brief-analysis.md` §3.4 — the lens instructions, the JSON schema description, the fabrication audit step, and the "emit only JSON" constraint. The top-level `buildPromptMessages` composes the system parameter (Layer 1) + three user messages (Layer 2 with vision blocks, Layer 3, Layer 4).

- [ ] **Step 1: Write the failing tests**

Append to `apps/agent/src/lib/prompt-builder.test.ts`:

```ts
import { renderLayer4, buildPromptMessages } from './prompt-builder';
import type { PhotoBlock } from './types/v2';

describe('renderLayer4', () => {
  it('opens with # GENERATION INSTRUCTIONS', () => {
    expect(renderLayer4()).toContain('# GENERATION INSTRUCTIONS');
  });

  it('lists all four lenses in order', () => {
    const out = renderLayer4();
    const l1 = out.indexOf('## Lens 1 — Voice extraction');
    const l2 = out.indexOf('## Lens 2 — Specificity inventory');
    const l3 = out.indexOf('## Lens 3 — Expertise mapping');
    const l4 = out.indexOf('## Lens 4 — Visual aesthetic');
    expect(l1).toBeGreaterThan(0);
    expect(l2).toBeGreaterThan(l1);
    expect(l3).toBeGreaterThan(l2);
    expect(l4).toBeGreaterThan(l3);
  });

  it('contains the JSON schema fragment for calendar_plan', () => {
    const out = renderLayer4();
    expect(out).toContain('"calendar_plan":');
    expect(out).toContain('"slot_index": 1');
    expect(out).toContain('"format": "ugc_30s | ugc_60s | t2v_quality | t2v_budget | carousel"');
    expect(out).toContain('"fabrication_risk_check": "passed | escalate"');
  });

  it('contains the fabrication audit instructions', () => {
    const out = renderLayer4();
    expect(out).toContain('## Run the fabrication audit');
    expect(out).toContain('Does this line claim a biographical fact about the customer?');
  });

  it('ends with the "Emit ONLY the JSON object" instruction', () => {
    const out = renderLayer4();
    expect(out).toContain('Emit ONLY the JSON object. No prose. No code fence. No preamble.');
  });
});

describe('buildPromptMessages', () => {
  const catalog = makeCatalogStub();

  it('returns BuiltPrompt with system + 3 user messages', () => {
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog, photos: [] });
    expect(out.system).toEqual(renderLayer1());
    expect(out.messages).toHaveLength(3);
    expect(out.messages.every((m) => m.role === 'user')).toBe(true);
  });

  it('first user message contains the Layer 2 text', () => {
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog, photos: [] });
    const first = out.messages[0];
    const textBlock = first.content.find((b) => b.type === 'text');
    expect(textBlock).toBeDefined();
    expect((textBlock as { type: 'text'; text: string }).text).toContain('# CUSTOMER CORPUS');
  });

  it('first user message has zero image blocks when no photos and no logo', () => {
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog, photos: [] });
    const imageBlocks = out.messages[0].content.filter((b) => b.type === 'image');
    expect(imageBlocks).toHaveLength(0);
  });

  it('first user message has logo block first, then photo blocks, then text — when both supplied', () => {
    const photos: PhotoBlock[] = [
      { role: 'reference', mediaType: 'image/jpeg', base64: 'PHOTO1' },
      { role: 'reference', mediaType: 'image/jpeg', base64: 'PHOTO2' },
    ];
    const logo: PhotoBlock = { role: 'logo', mediaType: 'image/png', base64: 'LOGO' };
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog, photos, logo });
    const blocks = out.messages[0].content;
    expect(blocks[0].type).toBe('image');
    expect((blocks[0] as { source: { data: string } }).source.data).toBe('LOGO');
    expect(blocks[1].type).toBe('image');
    expect((blocks[1] as { source: { data: string } }).source.data).toBe('PHOTO1');
    expect(blocks[2].type).toBe('image');
    expect((blocks[2] as { source: { data: string } }).source.data).toBe('PHOTO2');
    expect(blocks[3].type).toBe('text');
  });

  it('second user message is the Layer 3 text', () => {
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog, photos: [] });
    expect(out.messages[1].content[0].type).toBe('text');
    expect((out.messages[1].content[0] as { text: string }).text).toContain('# SELECTION INPUTS');
  });

  it('third user message is the Layer 4 text', () => {
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog, photos: [] });
    expect((out.messages[2].content[0] as { text: string }).text).toContain('# GENERATION INSTRUCTIONS');
  });

  it('passes prior context through to Layer 3 when supplied', () => {
    const out = buildPromptMessages({
      brief: SAMPLE_BRIEF,
      seed: SAMPLE_SEED,
      catalog,
      photos: [],
      prior: SAMPLE_PRIOR,
    });
    const layer3 = (out.messages[1].content[0] as { text: string }).text;
    expect(layer3).toContain('### Founder note (verbatim)');
    expect(layer3).toContain("The hooks were too generic");
  });

  it('uses the niche markdown from the catalog for the brief\'s niche', () => {
    const richCatalog = {
      ...catalog,
      niches: { ...catalog.niches, fashion: '# fashion brief\n\nFashion is craft-substantiated.' },
    };
    const out = buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog: richCatalog, photos: [] });
    const layer2 = (out.messages[0].content.find((b) => b.type === 'text') as { text: string }).text;
    expect(layer2).toContain('Fashion is craft-substantiated.');
  });

  it('throws when the catalog is missing the brief\'s niche', () => {
    const brokenCatalog = { ...catalog, niches: {} as BankCatalog['niches'] };
    expect(() =>
      buildPromptMessages({ brief: SAMPLE_BRIEF, seed: SAMPLE_SEED, catalog: brokenCatalog, photos: [] }),
    ).toThrow(/niche.*fashion/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
```

Expected: FAIL — `renderLayer4` and `buildPromptMessages` not exported.

- [ ] **Step 3: Implement `renderLayer4` + `buildPromptMessages`**

Append to `apps/agent/src/lib/prompt-builder.ts`:

```ts
// ─── Layer 4 — Generation instructions (ai-brief-analysis.md §3.4) ──────────
const LAYER_4 = `# GENERATION INSTRUCTIONS

Run the following process in order. Do not skip steps. Each lens informs the next.

## Lens 1 — Voice extraction

Read the customer's reference posts (Layer 2 step 6) and stated voice. Identify:
  - Two to four phrases the customer uses repeatedly that are theirs (not generic).
  - The customer's typical sentence rhythm (short and punchy / mid-length / dense).
  - Words the customer would NOT use (terms that would feel out of register).
  - Energy register (calm, urgent, playful, authoritative, irreverent, warm).

If reference posts are absent or thin, fall back to the niche brief defaults but flag the
thinness in \`flags_for_review\` with reason 'thin_voice_corpus'.

## Lens 2 — Specificity inventory

Read the customer's offer description, audience description, and any URL-fetched bodies. Extract:
  - Concrete numbers (price points, time-to-result, quantities).
  - Concrete proper nouns (brand names, neighbourhood names, product line names).
  - Concrete process steps the customer described (do not invent — only extract).

These specifics will be re-used across scripts so the calendar reads as informed, not generic.
If the corpus is empty of specifics, flag 'thin_specificity_corpus'.

## Lens 3 — Expertise mapping

Read the offer description and identify what the customer KNOWS that their audience does not.
Phrase each expertise nugget as: "Customers in this niche often don't realise that {{X}}."
These nuggets seed Educational / Myth-Buster / Decoded-Jargon scripts.

## Lens 4 — Visual aesthetic

If photos are present (vision blocks in Layer 2), describe:
  - Lighting register (warm/cool/neutral; soft/harsh).
  - Setting type (studio, home, retail, outdoor).
  - Wardrobe and prop register.
  - Photo quality and confidence (do NOT critique — describe).

If no photos, infer from the niche brief's photo-aesthetic notes and the customer's stated voice;
flag 'no_photos_uploaded' so the founder knows to set Phase 2 production toward stock-presenter.

## Compose the analysis

Produce a single JSON object with this exact shape:

{
  "brand_voice": {
    "voice_phrases": ["string", ...],
    "sentence_rhythm": "short_punchy | mid_length | dense",
    "avoid_words": ["string", ...],
    "energy_register": "calm | urgent | playful | authoritative | irreverent | warm",
    "voice_corpus_quality": "thick | thin | absent"
  },
  "specificity_inventory": {
    "numbers": ["string", ...],
    "proper_nouns": ["string", ...],
    "process_steps": ["string", ...],
    "specificity_corpus_quality": "thick | thin | absent"
  },
  "expertise_map": [
    {"nugget": "string", "framework_affinity": ["framework_slot", ...]}
  ],
  "visual_aesthetic": {
    "lighting": "string",
    "setting": "string",
    "wardrobe_props": "string",
    "photo_quality_summary": "string",
    "photos_present": true | false
  },
  "calendar_plan": [
    {
      "slot_index": 1,
      "day": 1,
      "format": "ugc_30s | ugc_60s | t2v_quality | t2v_budget | carousel",
      "framework_slot": "string (must be in selected_frameworks)",
      "archetype_slot": "string (must be in selected_archetypes)",
      "topic": "string (the angle this slot covers, derived from the lenses above)",
      "hook": "string (one-line opener that obeys the framework's hook style)",
      "core_beats": ["string", ...],
      "cta": "string",
      "fabrication_risk_check": "passed | escalate"
    }
  ],
  "fabrication_audit": {
    "lines_checked": "integer",
    "violations_found": [
      {"slot_index": "integer", "line": "string", "violation": "string"}
    ],
    "audit_passed": true | false
  },
  "flags_for_review": [
    {"reason": "string (e.g. 'bank_exhausted_lru_fallback', 'thin_voice_corpus')", "detail": "string"}
  ]
}

## Run the fabrication audit

After composing \`calendar_plan\`, walk every \`hook\`, every entry in \`core_beats\`, and every \`cta\`.
For each line, ask:
  - Does this line claim a biographical fact about the customer? If yes, is that fact in
    \`customer_backstory_verbatim\` from Layer 2? If not, the line FAILS.
  - Does this line attribute a story to a named individual customer? If yes, the line FAILS.
  - Does this line use a phrase like "in the style of [marketer]"? If yes, the line FAILS.

Set \`fabrication_risk_check\` per slot. If any slot fails, populate \`fabrication_audit.violations_found\`
and set \`audit_passed = false\`. Re-write the offending slots BEFORE finalising the JSON. Do not
emit a JSON with \`audit_passed = false\` unless you have rewritten and the violations persist —
in which case the founder review will catch it.

## Output

Emit ONLY the JSON object. No prose. No code fence. No preamble.`;

export function renderLayer4(): string {
  return LAYER_4;
}

// ─── Top-level: buildPromptMessages ─────────────────────────────────────────
export function buildPromptMessages(args: {
  brief: BriefAnalyzerInput;
  seed: FrameworkSeedResult;
  catalog: BankCatalog;
  photos: PhotoBlock[];
  logo?: PhotoBlock;
  prior?: PriorRunContext;
}): BuiltPrompt {
  const { brief, seed, catalog, photos, logo, prior } = args;

  const nicheBrief = catalog.niches[brief.niche_slug];
  if (typeof nicheBrief !== 'string' || nicheBrief.length === 0) {
    throw new Error(`buildPromptMessages: niche brief for "${brief.niche_slug}" missing from catalog`);
  }

  const layer2Text = renderLayer2Text(brief, nicheBrief);
  const layer3Text = renderLayer3(brief, seed, catalog, prior);
  const layer4Text = renderLayer4();

  // First user message: logo (if any) + photos + Layer 2 text.
  const firstContent: PromptUserContentBlock[] = [];
  if (logo) {
    firstContent.push({
      type: 'image',
      source: { type: 'base64', media_type: logo.mediaType, data: logo.base64 },
    });
  }
  for (const p of photos) {
    firstContent.push({
      type: 'image',
      source: { type: 'base64', media_type: p.mediaType, data: p.base64 },
    });
  }
  firstContent.push({ type: 'text', text: layer2Text });

  const messages: PromptUserMessage[] = [
    { role: 'user', content: firstContent },
    { role: 'user', content: [{ type: 'text', text: layer3Text }] },
    { role: 'user', content: [{ type: 'text', text: layer4Text }] },
  ];

  return { system: renderLayer1(), messages };
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/prompt-builder.test.ts
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: 47 passing prompt-builder tests (33 prior + 5 Layer 4 + 9 buildPromptMessages); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/prompt-builder.ts apps/agent/src/lib/prompt-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): prompt-builder Layer 4 + buildPromptMessages

Renders ai-brief-analysis.md §3.4 — the four lens instructions, the JSON
schema description, the fabrication audit step, and the "emit only JSON"
constraint. Top-level buildPromptMessages composes the system parameter
(Layer 1) plus three user messages: logo + photos + Layer 2 text first,
then Layer 3, then Layer 4. Throws if the brief's niche is not present
in the catalog.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — `output-validator.ts`: zod schema mirroring `AiOutput`

**Files:**
- Create: `apps/agent/src/lib/output-validator.ts`
- Create: `apps/agent/src/lib/output-validator.test.ts`

This task lands the zod schema only. Slot-count and selection-membership checks come in Task 9. The schema mirrors `AiOutput` from `types/v2.ts`; if the two ever drift, the type check at the schema-to-AiOutput boundary catches it.

- [ ] **Step 1: Write the failing tests**

Create `apps/agent/src/lib/output-validator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aiOutputSchema } from './output-validator';
import type { AiOutput } from './types/v2';

const VALID_OUTPUT: AiOutput = {
  brand_voice: {
    voice_phrases: ['hand-finished', '14 hours of work'],
    sentence_rhythm: 'mid_length',
    avoid_words: ['timeless', 'iconic'],
    energy_register: 'authoritative',
    voice_corpus_quality: 'thick',
  },
  specificity_inventory: {
    numbers: ['14 hours', 'NGN 80k'],
    proper_nouns: ['Lagos', 'ankara'],
    process_steps: ['cutting', 'construction', 'finishing'],
    specificity_corpus_quality: 'thick',
  },
  expertise_map: [
    { nugget: "Customers don't realise that good ankara takes 14h hand-finishing.", framework_affinity: ['EDUCATIONAL_BREAKDOWN', 'MYTH_BUSTER'] },
  ],
  visual_aesthetic: {
    lighting: 'warm, soft',
    setting: 'studio',
    wardrobe_props: 'finished garments on wooden hangers',
    photo_quality_summary: 'consistent, high-quality',
    photos_present: true,
  },
  calendar_plan: [
    {
      slot_index: 1,
      day: 1,
      format: 'ugc_30s',
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
      topic: 'why custom ankara costs what it does',
      hook: '14 hours of hand-finishing — this is what that gets you.',
      core_beats: ['fabric cost', 'cutting time', 'construction time', 'finishing time'],
      cta: 'DM "ankara" for our current intake.',
      fabrication_risk_check: 'passed',
    },
  ],
  fabrication_audit: {
    lines_checked: 6,
    violations_found: [],
    audit_passed: true,
  },
  flags_for_review: [],
};

describe('aiOutputSchema', () => {
  it('parses a fully valid AiOutput', () => {
    const result = aiOutputSchema.safeParse(VALID_OUTPUT);
    expect(result.success).toBe(true);
  });

  it('rejects when a top-level key is missing', () => {
    const { calendar_plan, ...rest } = VALID_OUTPUT;
    const result = aiOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid sentence_rhythm enum value', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, sentence_rhythm: 'medium' } };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid energy_register enum value', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, energy_register: 'angsty' } };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid voice_corpus_quality value', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, voice_corpus_quality: 'bountiful' } };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a calendar_plan entry with an invalid format', () => {
    const bad = {
      ...VALID_OUTPUT,
      calendar_plan: [{ ...VALID_OUTPUT.calendar_plan[0], format: 'video' }],
    };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a calendar_plan entry where slot_index is not an integer', () => {
    const bad = {
      ...VALID_OUTPUT,
      calendar_plan: [{ ...VALID_OUTPUT.calendar_plan[0], slot_index: 1.5 }],
    };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects when fabrication_audit.audit_passed is not boolean', () => {
    const bad = {
      ...VALID_OUTPUT,
      fabrication_audit: { ...VALID_OUTPUT.fabrication_audit, audit_passed: 'true' },
    };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts an empty expertise_map array', () => {
    const ok = { ...VALID_OUTPUT, expertise_map: [] };
    expect(aiOutputSchema.safeParse(ok).success).toBe(true);
  });

  it('accepts a flags_for_review entry with reason + detail', () => {
    const ok = {
      ...VALID_OUTPUT,
      flags_for_review: [{ reason: 'thin_voice_corpus', detail: 'Reference posts were sparse.' }],
    };
    expect(aiOutputSchema.safeParse(ok).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/output-validator.test.ts
```

Expected: FAIL — `output-validator` module not found.

- [ ] **Step 3: Implement the zod schema**

Create `apps/agent/src/lib/output-validator.ts`:

```ts
// Validates the model's structured output against ai-brief-analysis.md §3.4.
// Pure: only depends on zod + the AiOutput type.

import { z } from 'zod';
import { FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, type AiOutput } from './types/v2';

const sentenceRhythm = z.enum(['short_punchy', 'mid_length', 'dense']);
const corpusQuality = z.enum(['thick', 'thin', 'absent']);
const energyRegister = z.enum(['calm', 'urgent', 'playful', 'authoritative', 'irreverent', 'warm']);
const slotFormat = z.enum(['ugc_30s', 'ugc_60s', 't2v_quality', 't2v_budget', 'carousel']);
const fabricationRiskCheck = z.enum(['passed', 'escalate']);

const frameworkSlotEnum = z.enum(FRAMEWORK_SLOTS);
const archetypeSlotEnum = z.enum(ARCHETYPE_SLOTS);

const brandVoice = z.object({
  voice_phrases: z.array(z.string()),
  sentence_rhythm: sentenceRhythm,
  avoid_words: z.array(z.string()),
  energy_register: energyRegister,
  voice_corpus_quality: corpusQuality,
});

const specificityInventory = z.object({
  numbers: z.array(z.string()),
  proper_nouns: z.array(z.string()),
  process_steps: z.array(z.string()),
  specificity_corpus_quality: corpusQuality,
});

const expertiseNugget = z.object({
  nugget: z.string(),
  framework_affinity: z.array(z.string()),
});

const visualAesthetic = z.object({
  lighting: z.string(),
  setting: z.string(),
  wardrobe_props: z.string(),
  photo_quality_summary: z.string(),
  photos_present: z.boolean(),
});

const calendarSlot = z.object({
  slot_index: z.number().int(),
  day: z.number().int(),
  format: slotFormat,
  framework_slot: frameworkSlotEnum,
  archetype_slot: archetypeSlotEnum,
  topic: z.string(),
  hook: z.string(),
  core_beats: z.array(z.string()),
  cta: z.string(),
  fabrication_risk_check: fabricationRiskCheck,
});

const violation = z.object({
  slot_index: z.number().int(),
  line: z.string(),
  violation: z.string(),
});

const fabricationAudit = z.object({
  lines_checked: z.number().int(),
  violations_found: z.array(violation),
  audit_passed: z.boolean(),
});

const reviewFlag = z.object({
  reason: z.string(),
  detail: z.string(),
});

export const aiOutputSchema = z.object({
  brand_voice: brandVoice,
  specificity_inventory: specificityInventory,
  expertise_map: z.array(expertiseNugget),
  visual_aesthetic: visualAesthetic,
  calendar_plan: z.array(calendarSlot),
  fabrication_audit: fabricationAudit,
  flags_for_review: z.array(reviewFlag),
}) satisfies z.ZodType<AiOutput>;
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/output-validator.test.ts
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: 10 passing tests; typecheck clean (the `satisfies z.ZodType<AiOutput>` proves zod schema and TypeScript interface stay aligned).

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/output-validator.ts apps/agent/src/lib/output-validator.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): output-validator zod schema mirroring AiOutput

zod schema for the model-facing output shape per ai-brief-analysis.md §3.4.
The framework/archetype slot enums are derived from the canonical V2
FRAMEWORK_SLOTS / ARCHETYPE_SLOTS arrays so they stay in lockstep with
the bank. A `satisfies z.ZodType<AiOutput>` clause catches drift between
the runtime schema and the TS interface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — `output-validator.ts`: top-level `validateAiOutput` with count + membership checks

**Files:**
- Modify: `apps/agent/src/lib/output-validator.ts`
- Modify: `apps/agent/src/lib/output-validator.test.ts`

The top-level function performs four ordered checks per `ai-brief-analysis.md` §6:
1. JSON parse + zod shape (returns `malformed_json` or `schema_mismatch`)
2. `calendar_plan.length === video_count + carousel_count` (returns `slot_count_mismatch`)
3. Every `framework_slot` and `archetype_slot` in `calendar_plan` is in the seed's selection lists (returns `unauthorized_slot`)

Per §6 #4 the audit-passed=false case is NOT a validation failure — the run is written and flagged for the founder. So `validateAiOutput` does NOT reject on audit failure; it returns ok. Caller decides downstream.

- [ ] **Step 1: Write the failing tests**

Append to `apps/agent/src/lib/output-validator.test.ts`:

```ts
import { validateAiOutput } from './output-validator';
import type { FrameworkSeedResult } from './types/v2';

const SAMPLE_SEED: FrameworkSeedResult = {
  seed_hash: 'a3f9e2d18c4b7a05',
  seed_inputs: {
    customer_id: '11111111-1111-1111-1111-111111111111',
    niche: 'fashion',
    order_index: 1,
    submission_week_iso: '2026-W18',
  },
  selected_frameworks: ['DR_FORMULA', 'PAS'],
  selected_archetypes: ['PRICING_BREAKDOWN', 'PROCESS_TOUR'],
  selected_pairs: [
    { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
    { framework: 'PAS', archetype: 'PROCESS_TOUR', affinity: 4 },
  ],
  exhaustion_warning: false,
  lru_fallback_used: false,
};

describe('validateAiOutput', () => {
  it('returns ok=true for a valid output that matches seed + tier', () => {
    // Tier "starter" wants 7 videos + 3 carousels = 10 calendar slots.
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx % 2 === 0 ? 'DR_FORMULA' : 'PAS',
      archetype_slot: idx % 2 === 0 ? 'PRICING_BREAKDOWN' : 'PROCESS_TOUR',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(true);
  });

  it('returns ok=false reason=malformed_json on a non-JSON-parseable string input', () => {
    const result = validateAiOutput('this is not json', SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('malformed_json');
    }
  });

  it('parses a JSON-string input on the happy path', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx % 2 === 0 ? 'DR_FORMULA' : 'PAS',
      archetype_slot: idx % 2 === 0 ? 'PRICING_BREAKDOWN' : 'PROCESS_TOUR',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(JSON.stringify(out), SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(true);
  });

  it('returns ok=false reason=schema_mismatch when shape is wrong', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, energy_register: 'angsty' } };
    const result = validateAiOutput(bad, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('schema_mismatch');
      // @ts-expect-error narrowed by reason
      expect(result.failure.zodIssues.length).toBeGreaterThan(0);
    }
  });

  it('returns ok=false reason=slot_count_mismatch when calendar_plan length != video+carousel', () => {
    // Tier "starter" wants 7 + 3 = 10. We supply 9.
    const calendarPlan = Array.from({ length: 9 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('slot_count_mismatch');
      // @ts-expect-error narrowed by reason
      expect(result.failure.expected).toBe(10);
      // @ts-expect-error narrowed
      expect(result.failure.actual).toBe(9);
    }
  });

  it('returns ok=false reason=unauthorized_slot when a calendar slot uses a framework outside the seed', () => {
    // Tier "starter" wants 10 slots. Use AIDA which is NOT in selected_frameworks.
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx === 5 ? 'AIDA' : 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('unauthorized_slot');
      // @ts-expect-error narrowed
      expect(result.failure.offenders).toEqual(expect.arrayContaining(['framework:AIDA']));
    }
  });

  it('returns ok=false reason=unauthorized_slot when an archetype is outside the seed', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: 'DR_FORMULA',
      archetype_slot: idx === 4 ? 'INSIDER_CHECKLIST' : 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('unauthorized_slot');
      // @ts-expect-error narrowed
      expect(result.failure.offenders).toEqual(expect.arrayContaining(['archetype:INSIDER_CHECKLIST']));
    }
  });

  it('does NOT reject when fabrication_audit.audit_passed is false (per §6 #4)', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx % 2 === 0 ? 'DR_FORMULA' : 'PAS',
      archetype_slot: idx % 2 === 0 ? 'PRICING_BREAKDOWN' : 'PROCESS_TOUR',
    }));
    const out = {
      ...VALID_OUTPUT,
      calendar_plan: calendarPlan,
      fabrication_audit: {
        lines_checked: 30,
        violations_found: [{ slot_index: 1, line: 'something', violation: 'biographical' }],
        audit_passed: false,
      },
    };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(true);
  });

  it('reports multiple offenders when more than one slot is unauthorized', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx === 0 ? 'AIDA' : idx === 1 ? 'PAIPS' : 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // @ts-expect-error narrowed
      expect(result.failure.offenders).toEqual(expect.arrayContaining(['framework:AIDA', 'framework:PAIPS']));
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/output-validator.test.ts
```

Expected: FAIL — `validateAiOutput` not exported.

- [ ] **Step 3: Implement `validateAiOutput`**

Append to `apps/agent/src/lib/output-validator.ts`:

```ts
import {
  TIER_COUNTS,
  type AiOutput,
  type FrameworkSeedResult,
  type Tier,
  type ValidationFailure,
} from './types/v2';

export type ValidationResult =
  | { ok: true; value: AiOutput }
  | { ok: false; failure: ValidationFailure };

export function validateAiOutput(
  raw: unknown,
  seed: FrameworkSeedResult,
  tier: Tier,
): ValidationResult {
  // 1. JSON parse if input is a string.
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch (err) {
      return {
        ok: false,
        failure: {
          reason: 'malformed_json',
          detail: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  // 2. zod shape validation.
  const parsed = aiOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        reason: 'schema_mismatch',
        detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        zodIssues: parsed.error.issues,
      },
    };
  }
  const value = parsed.data;

  // 3. Slot count check (video_count + carousel_count must equal calendar_plan.length).
  const counts = TIER_COUNTS[tier];
  const expectedSlots = counts.video_count + counts.carousel_count;
  if (value.calendar_plan.length !== expectedSlots) {
    return {
      ok: false,
      failure: {
        reason: 'slot_count_mismatch',
        detail: `tier ${tier} requires ${expectedSlots} slots; got ${value.calendar_plan.length}`,
        expected: expectedSlots,
        actual: value.calendar_plan.length,
      },
    };
  }

  // 4. Selection-list membership check.
  const allowedFrameworks = new Set<string>(seed.selected_frameworks);
  const allowedArchetypes = new Set<string>(seed.selected_archetypes);
  const offenders: string[] = [];
  for (const slot of value.calendar_plan) {
    if (!allowedFrameworks.has(slot.framework_slot)) {
      offenders.push(`framework:${slot.framework_slot}`);
    }
    if (!allowedArchetypes.has(slot.archetype_slot)) {
      offenders.push(`archetype:${slot.archetype_slot}`);
    }
  }
  if (offenders.length > 0) {
    const unique = Array.from(new Set(offenders));
    return {
      ok: false,
      failure: {
        reason: 'unauthorized_slot',
        detail: `slots used outside the seed selection: ${unique.join(', ')}`,
        offenders: unique,
      },
    };
  }

  // Audit-passed=false is a flag for the founder, not a validation failure.
  return { ok: true, value };
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/output-validator.test.ts
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: 19 passing tests (10 schema + 9 top-level); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/output-validator.ts apps/agent/src/lib/output-validator.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): output-validator top-level with count + membership checks

validateAiOutput runs four ordered checks per ai-brief-analysis.md §6:
JSON parse, zod shape, slot count vs TIER_COUNTS, and selection-list
membership against the seed's selected_frameworks/archetypes. Audit
failure is intentionally NOT a validation failure — per §6 #4 the run
is still written and the founder review catches it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 — `fabrication-audit.ts`: app-side regex sweep

**Files:**
- Create: `apps/agent/src/lib/fabrication-audit.ts`
- Create: `apps/agent/src/lib/fabrication-audit.test.ts`

This is the second-layer audit per `ai-brief-analysis.md` §8: the application sweeps every `hook`, every `core_beats` entry, and every `cta` for forbidden lexical patterns. A match never blocks the run — it returns a `Violation[]` that the orchestrator merges into `ai_output.fabrication_audit.violations_found` post-hoc.

The four canonical regexes from §8:
1. `/my (mum|grandmother|mother|grandma)/i`
2. `/i started this (business|brand|company) because/i`
3. `/customer transformation/i`
4. `/in the style of [A-Z][a-z]+ [A-Z][a-z]+/`

Plus the customer-backstory backstop: any line that uses first-person backstory verbs (`started`, `learned from`, `taught me`, `inherited`) should be flagged for founder review **unless** the lexical content of that line is present (case-insensitive substring match) in `customer_backstory_verbatim`. This second pass is per §8 "founder review" intent — the application surfaces the line; founder confirms it's grounded.

- [ ] **Step 1: Write the failing tests**

Create `apps/agent/src/lib/fabrication-audit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { auditFabrication } from './fabrication-audit';
import type { AiOutput } from './types/v2';

const BASE_AI_OUTPUT: AiOutput = {
  brand_voice: {
    voice_phrases: [],
    sentence_rhythm: 'mid_length',
    avoid_words: [],
    energy_register: 'authoritative',
    voice_corpus_quality: 'thick',
  },
  specificity_inventory: { numbers: [], proper_nouns: [], process_steps: [], specificity_corpus_quality: 'thick' },
  expertise_map: [],
  visual_aesthetic: { lighting: '', setting: '', wardrobe_props: '', photo_quality_summary: '', photos_present: false },
  calendar_plan: [],
  fabrication_audit: { lines_checked: 0, violations_found: [], audit_passed: true },
  flags_for_review: [],
};

function withSlot(idx: number, hook: string, beats: string[] = [], cta = ''): AiOutput['calendar_plan'][number] {
  return {
    slot_index: idx,
    day: idx,
    format: 'ugc_30s',
    framework_slot: 'DR_FORMULA',
    archetype_slot: 'PRICING_BREAKDOWN',
    topic: 'topic',
    hook,
    core_beats: beats,
    cta,
    fabrication_risk_check: 'passed',
  };
}

describe('auditFabrication', () => {
  it('returns no violations for a clean calendar_plan', () => {
    const out: AiOutput = {
      ...BASE_AI_OUTPUT,
      calendar_plan: [withSlot(1, '14 hours of hand-finishing — what that buys you')],
    };
    const v = auditFabrication(out, '');
    expect(v).toEqual([]);
  });

  it('flags "my grandmother taught me" via §8 regex 1', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(2, 'My grandmother taught me to sew.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ slot_index: 2, line: 'My grandmother taught me to sew.' });
    expect(v[0].violation).toMatch(/grandmother|family heritage/i);
  });

  it('flags "I started this business because" via §8 regex 2', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(3, 'I started this business because customers deserved better.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
    expect(v[0].slot_index).toBe(3);
  });

  it('does NOT flag "I started this business because" when present in customer_backstory_verbatim', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(3, 'I started this business because customers deserved better.')] };
    const backstory = 'I started this business because customers deserved better. That was 2019.';
    const v = auditFabrication(out, backstory);
    expect(v).toEqual([]);
  });

  it('flags "customer transformation" via §8 regex 3', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(4, 'Watch a real customer transformation in 30 seconds.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
  });

  it('flags "in the style of First Last" via §8 regex 4', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(5, 'Bestseller copy in the style of David Ogilvy lands harder.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
  });

  it('flags violations from core_beats and cta, not just hook', () => {
    const slot = withSlot(
      6,
      'fine hook',
      ['my mum used to run the shop', 'second clean beat'],
      'in the style of Gary Halbert — get yours.',
    );
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [slot] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.line)).toEqual(
      expect.arrayContaining([
        'my mum used to run the shop',
        'in the style of Gary Halbert — get yours.',
      ]),
    );
  });

  it('flags backstory-verb lines that are NOT in customer_backstory_verbatim', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(7, 'I learned from my old tailor that fabric weight matters.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
    expect(v[0].violation).toMatch(/backstory verb/i);
  });

  it('does NOT flag backstory-verb lines that ARE present in customer_backstory_verbatim (case-insensitive)', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(7, 'I LEARNED from my old tailor that fabric weight matters.')] };
    const backstory = 'i learned from my old tailor that fabric weight matters.';
    const v = auditFabrication(out, backstory);
    expect(v).toEqual([]);
  });

  it('returns violations for multiple slots without short-circuiting', () => {
    const out: AiOutput = {
      ...BASE_AI_OUTPUT,
      calendar_plan: [
        withSlot(1, 'My mum told me'),
        withSlot(2, 'fine hook'),
        withSlot(3, 'customer transformation'),
      ],
    };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.slot_index)).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/fabrication-audit.test.ts
```

Expected: FAIL — `fabrication-audit` module not found.

- [ ] **Step 3: Implement `auditFabrication`**

Create `apps/agent/src/lib/fabrication-audit.ts`:

```ts
// App-side fabrication-risk regex sweep per ai-brief-analysis.md §8.
// Pure: takes AiOutput + customer_backstory_verbatim, returns Violation[].
// Caller (Phase 3 orchestrator) merges these into
// fabrication_audit.violations_found post-hoc.

import type { AiOutput, Violation } from './types/v2';

const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /my (mum|grandmother|mother|grandma)/i, label: 'family heritage claim' },
  { regex: /i started this (business|brand|company) because/i, label: 'founder origin claim' },
  { regex: /customer transformation/i, label: 'invented customer testimonial framing' },
  { regex: /in the style of [A-Z][a-z]+ [A-Z][a-z]+/, label: 'marketer-name attribution' },
];

const BACKSTORY_VERB_PATTERN = /\b(started|learned from|taught me|inherited)\b/i;

function lineFlaggedByForbiddenPatterns(line: string): string | null {
  for (const { regex, label } of FORBIDDEN_PATTERNS) {
    if (regex.test(line)) return label;
  }
  return null;
}

function isLineInBackstory(line: string, backstory: string): boolean {
  if (!backstory.trim()) return false;
  return backstory.toLowerCase().includes(line.toLowerCase());
}

export function auditFabrication(aiOutput: AiOutput, customerBackstory: string): Violation[] {
  const violations: Violation[] = [];

  for (const slot of aiOutput.calendar_plan) {
    const lines = [
      slot.hook,
      ...slot.core_beats,
      slot.cta,
    ].filter((s) => typeof s === 'string' && s.length > 0);

    for (const line of lines) {
      const inBackstory = isLineInBackstory(line, customerBackstory);

      // Forbidden patterns: bypassed only when the EXACT line is present in backstory.
      const forbiddenLabel = lineFlaggedByForbiddenPatterns(line);
      if (forbiddenLabel && !inBackstory) {
        violations.push({
          slot_index: slot.slot_index,
          line,
          violation: forbiddenLabel,
        });
        continue;
      }

      // Backstory-verb backstop: flag when verb is present and line not in backstory.
      if (BACKSTORY_VERB_PATTERN.test(line) && !inBackstory && !forbiddenLabel) {
        violations.push({
          slot_index: slot.slot_index,
          line,
          violation: 'first-person backstory verb without grounding in customer_backstory_verbatim',
        });
      }
    }
  }

  return violations;
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/fabrication-audit.test.ts
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: 9 passing tests; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/fabrication-audit.ts apps/agent/src/lib/fabrication-audit.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): fabrication-audit app-side regex sweep

Sweeps every hook/core_beats/cta line through the four §8 forbidden
patterns + a backstory-verb backstop, with an exception when the EXACT
line appears in customer_backstory_verbatim (case-insensitive). Pure;
returns Violation[] for the orchestrator to merge into
fabrication_audit.violations_found post-hoc per §8 operational notes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11 — `post-processor.ts`: derived superset fields

**Files:**
- Create: `apps/agent/src/lib/post-processor.ts`
- Create: `apps/agent/src/lib/post-processor.test.ts`

The post-processor derives three CRM-facing fields the model output doesn't include (per design doc Q1):

- `brief_summary`: 1–2 sentence string built from the customer's niche label + their topic from `calendar_plan[0].topic` + the dominant `expertise_map` nugget.
- `upsell_recommendation`: rule-based, deterministic. Triggered when (a) tier !== 'calendar' AND (b) corpus quality is 'thick' on both voice and specificity AND (c) `expertise_map.length >= 4`. Tier escalates one step (`starter`→`standard`→`calendar`). Price delta is the difference between recommended and current tier prices per `docs/pricing-and-packages.md`.
- `estimated_brief_quality_score`: float 0..1 = 0.5×(voice quality score) + 0.3×(specificity quality score) + 0.1×(photos_present ? 1 : 0) + 0.1×(1 - clamp01(violationCount/10)). Quality enums map: thick=1.0, thin=0.6, absent=0.2.

Tier prices (NGN, per `docs/pricing-and-packages.md`):
- starter: 80,000
- standard: 200,000
- calendar: 400,000

- [ ] **Step 1: Write the failing tests**

Create `apps/agent/src/lib/post-processor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { postProcess, TIER_PRICES_NGN } from './post-processor';
import type { AiOutput } from './types/v2';

const BASE: AiOutput = {
  brand_voice: {
    voice_phrases: ['hand-finished', '14 hours'],
    sentence_rhythm: 'mid_length',
    avoid_words: ['timeless'],
    energy_register: 'authoritative',
    voice_corpus_quality: 'thick',
  },
  specificity_inventory: {
    numbers: ['14 hours', 'NGN 80k'],
    proper_nouns: ['Lagos', 'ankara'],
    process_steps: ['cutting', 'construction', 'finishing'],
    specificity_corpus_quality: 'thick',
  },
  expertise_map: [
    { nugget: "Customers don't realise good ankara takes 14h hand-finishing.", framework_affinity: ['EDUCATIONAL_BREAKDOWN'] },
    { nugget: 'Customers underestimate the role of fabric weight.', framework_affinity: ['MYTH_BUSTER'] },
    { nugget: 'Customers think bespoke is always slower than ready-to-wear.', framework_affinity: ['COMPARISON'] },
    { nugget: 'Customers conflate price with quality of finishing.', framework_affinity: ['COST_REVEAL'] },
  ],
  visual_aesthetic: { lighting: 'warm', setting: 'studio', wardrobe_props: 'garments', photo_quality_summary: 'consistent', photos_present: true },
  calendar_plan: [
    {
      slot_index: 1,
      day: 1,
      format: 'ugc_30s',
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
      topic: 'why custom ankara is priced the way it is',
      hook: 'hook',
      core_beats: [],
      cta: 'cta',
      fabrication_risk_check: 'passed',
    },
  ],
  fabrication_audit: { lines_checked: 1, violations_found: [], audit_passed: true },
  flags_for_review: [],
};

describe('postProcess.brief_summary', () => {
  it('produces a 1-2 sentence summary mentioning the niche label and the slot-1 topic', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.brief_summary).toMatch(/fashion/i);
    expect(r.brief_summary).toMatch(/why custom ankara is priced the way it is/);
  });
});

describe('postProcess.upsell_recommendation', () => {
  it('recommends standard when current tier is starter and signals are thick + ≥4 expertise nuggets', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'starter', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(true);
    expect(r.upsell_recommendation.recommended_tier).toBe('standard');
    expect(r.upsell_recommendation.upsell_price_delta).toBe(TIER_PRICES_NGN.standard - TIER_PRICES_NGN.starter);
  });

  it('recommends calendar when current tier is standard and signals are thick + ≥4 expertise', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(true);
    expect(r.upsell_recommendation.recommended_tier).toBe('calendar');
    expect(r.upsell_recommendation.upsell_price_delta).toBe(TIER_PRICES_NGN.calendar - TIER_PRICES_NGN.standard);
  });

  it('does NOT upsell when current tier is calendar (top tier)', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'calendar', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(false);
    expect(r.upsell_recommendation.recommended_tier).toBeNull();
    expect(r.upsell_recommendation.upsell_price_delta).toBe(0);
  });

  it('does NOT upsell when voice corpus is thin', () => {
    const ai = { ...BASE, brand_voice: { ...BASE.brand_voice, voice_corpus_quality: 'thin' as const } };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'starter', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(false);
  });

  it('does NOT upsell when expertise_map has fewer than 4 nuggets', () => {
    const ai = { ...BASE, expertise_map: BASE.expertise_map.slice(0, 3) };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'starter', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(false);
  });
});

describe('postProcess.estimated_brief_quality_score', () => {
  it('is 1.0 when all signals are maxed (thick voice, thick specificity, photos, no violations)', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.estimated_brief_quality_score).toBeCloseTo(1.0, 3);
  });

  it('drops when voice corpus is absent', () => {
    const ai = { ...BASE, brand_voice: { ...BASE.brand_voice, voice_corpus_quality: 'absent' as const } };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    // 0.5*0.2 + 0.3*1.0 + 0.1*1.0 + 0.1*1.0 = 0.6
    expect(r.estimated_brief_quality_score).toBeCloseTo(0.6, 3);
  });

  it('drops further when no photos', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: false, reanalyzed: false, postHocViolations: 0 });
    // 0.5*1.0 + 0.3*1.0 + 0.1*0 + 0.1*1.0 = 0.9
    expect(r.estimated_brief_quality_score).toBeCloseTo(0.9, 3);
  });

  it('clamps the violation impact at 10 violations', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 25 });
    // 0.5+0.3+0.1+0.0 = 0.9 (violation factor is 1 - 1 = 0)
    expect(r.estimated_brief_quality_score).toBeCloseTo(0.9, 3);
  });

  it('is always between 0 and 1', () => {
    const ai = { ...BASE, brand_voice: { ...BASE.brand_voice, voice_corpus_quality: 'absent' as const }, specificity_inventory: { ...BASE.specificity_inventory, specificity_corpus_quality: 'absent' as const } };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'standard', hasPhotos: false, reanalyzed: false, postHocViolations: 999 });
    expect(r.estimated_brief_quality_score).toBeGreaterThanOrEqual(0);
    expect(r.estimated_brief_quality_score).toBeLessThanOrEqual(1);
  });
});

describe('postProcess returns a SupersetOutput', () => {
  it('preserves every AiOutput field unchanged', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.brand_voice).toEqual(BASE.brand_voice);
    expect(r.calendar_plan).toEqual(BASE.calendar_plan);
    expect(r.fabrication_audit).toEqual(BASE.fabrication_audit);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/post-processor.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `postProcess`**

Create `apps/agent/src/lib/post-processor.ts`:

```ts
// Derives the three CRM-facing fields per design doc Q1:
// brief_summary, upsell_recommendation, estimated_brief_quality_score.
// Pure; deterministic given inputs.

import type { AiOutput, CorpusQuality, NicheSlug, SupersetOutput, Tier } from './types/v2';

// docs/pricing-and-packages.md tier prices in NGN.
export const TIER_PRICES_NGN: Record<Tier, number> = {
  starter: 80_000,
  standard: 200_000,
  calendar: 400_000,
};

const NICHE_LABELS: Record<NicheSlug, string> = {
  beauty: 'beauty',
  real_estate: 'real estate',
  fashion: 'fashion',
  fintech: 'fintech',
  health: 'health',
  food: 'food',
  education: 'education',
};

const QUALITY_SCORES: Record<CorpusQuality, number> = {
  thick: 1.0,
  thin: 0.6,
  absent: 0.2,
};

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function nextTier(current: Tier): Tier | null {
  if (current === 'starter') return 'standard';
  if (current === 'standard') return 'calendar';
  return null;
}

function deriveBriefSummary(aiOutput: AiOutput, niche: NicheSlug): string {
  const nicheLabel = NICHE_LABELS[niche];
  const topic = aiOutput.calendar_plan[0]?.topic ?? '(no topic derived)';
  const expertise = aiOutput.expertise_map[0]?.nugget;
  const second = expertise
    ? `Anchor expertise: ${expertise}`
    : `Voice corpus quality is ${aiOutput.brand_voice.voice_corpus_quality}.`;
  return `Customer is in ${nicheLabel}; opening slot covers: ${topic}. ${second}`;
}

function deriveUpsell(aiOutput: AiOutput, tier: Tier): SupersetOutput['upsell_recommendation'] {
  const recommended = nextTier(tier);
  if (!recommended) {
    return {
      should_upsell: false,
      recommended_tier: null,
      reasoning: 'Customer is already on the top tier (calendar).',
      upsell_price_delta: 0,
    };
  }

  const voiceThick = aiOutput.brand_voice.voice_corpus_quality === 'thick';
  const specificityThick = aiOutput.specificity_inventory.specificity_corpus_quality === 'thick';
  const expertiseRich = aiOutput.expertise_map.length >= 4;

  const should = voiceThick && specificityThick && expertiseRich;

  if (!should) {
    return {
      should_upsell: false,
      recommended_tier: null,
      reasoning:
        'Upsell signals not met: requires thick voice + thick specificity + >=4 expertise nuggets.',
      upsell_price_delta: 0,
    };
  }

  const delta = TIER_PRICES_NGN[recommended] - TIER_PRICES_NGN[tier];
  return {
    should_upsell: true,
    recommended_tier: recommended,
    reasoning: `Voice and specificity corpora are thick and ${aiOutput.expertise_map.length} expertise nuggets surfaced; the ${recommended} tier covers more of the discoverable surface area.`,
    upsell_price_delta: delta,
  };
}

function deriveQualityScore(args: {
  aiOutput: AiOutput;
  hasPhotos: boolean;
  postHocViolations: number;
}): number {
  const voiceQ = QUALITY_SCORES[args.aiOutput.brand_voice.voice_corpus_quality];
  const specQ = QUALITY_SCORES[args.aiOutput.specificity_inventory.specificity_corpus_quality];
  const photoQ = args.hasPhotos ? 1 : 0;
  const violationFactor = 1 - clamp01(args.postHocViolations / 10);
  const score = 0.5 * voiceQ + 0.3 * specQ + 0.1 * photoQ + 0.1 * violationFactor;
  return clamp01(score);
}

export function postProcess(args: {
  aiOutput: AiOutput;
  niche: NicheSlug;
  tier: Tier;
  hasPhotos: boolean;
  reanalyzed: boolean;
  postHocViolations: number;
}): SupersetOutput {
  return {
    ...args.aiOutput,
    brief_summary: deriveBriefSummary(args.aiOutput, args.niche),
    upsell_recommendation: deriveUpsell(args.aiOutput, args.tier),
    estimated_brief_quality_score: deriveQualityScore({
      aiOutput: args.aiOutput,
      hasPhotos: args.hasPhotos,
      postHocViolations: args.postHocViolations,
    }),
  };
}
```

- [ ] **Step 4: Verify tests pass + typecheck**

```bash
pnpm --filter @operscale-calendar/agent test src/lib/post-processor.test.ts
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: 11 passing tests; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/src/lib/post-processor.ts apps/agent/src/lib/post-processor.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): post-processor superset derivations

Derives brief_summary (niche + slot-1 topic + first expertise nugget),
upsell_recommendation (rule-based: thick voice + thick specificity + >=4
expertise + tier < calendar), and estimated_brief_quality_score (0.5
voice + 0.3 specificity + 0.1 photos + 0.1 violation factor, clamped
0..1). TIER_PRICES_NGN sourced from docs/pricing-and-packages.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12 — Cassette helper: `test/helpers/cassette-client.ts`

**Files:**
- Create: `apps/agent/test/helpers/cassette-client.ts`
- Create: `apps/agent/test/helpers/cassette-client.test.ts`

The cassette helper is the test-side seam per design doc §8.3. It exposes an Anthropic-shaped client whose `messages.create` either replays a committed JSON file (default) or — when `CLAUDE_LIVE=1` is set in the environment — calls the real Anthropic SDK and writes the JSON. The shipped contract is:

- Replay mode is the default. CI runs `pnpm test`, which never hits the network.
- Record mode is triggered by `CLAUDE_LIVE=1`. The runner script at `scripts/run-live-tests.mjs` (Task 1) sets it.
- A cassette is one JSON file per test path. The helper writes the request as well as the response so future test changes that alter the request shape force a re-record.
- Record mode requires a real `Anthropic` client passed by the caller; replay mode does not.

- [ ] **Step 1: Write the failing tests**

Create `apps/agent/test/helpers/cassette-client.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCassetteClient } from './cassette-client';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'cassette-test-'));
  delete process.env.CLAUDE_LIVE;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('createCassetteClient (replay mode = default)', () => {
  it('reads a committed cassette and returns its response unchanged', async () => {
    const cassettePath = path.join(tempDir, 'sample.json');
    const cassette = {
      request: { model: 'claude-opus-4-7', system: 's', messages: [] },
      response: { content: [{ type: 'text', text: '{"hello":"world"}' }], usage: { input_tokens: 100, output_tokens: 5 } },
    };
    writeFileSync(cassettePath, JSON.stringify(cassette), 'utf8');

    const client = createCassetteClient({ cassettePath });
    const out = await client.messages.create({ model: 'ignored', system: 'ignored', messages: [], max_tokens: 1 });
    expect(out).toEqual(cassette.response);
  });

  it('throws when CLAUDE_LIVE != 1 and the cassette file is missing', async () => {
    const cassettePath = path.join(tempDir, 'missing.json');
    const client = createCassetteClient({ cassettePath });
    await expect(client.messages.create({ model: 'm', system: 's', messages: [], max_tokens: 1 })).rejects.toThrow(/cassette.*missing|not found/i);
  });
});

describe('createCassetteClient (record mode = CLAUDE_LIVE=1)', () => {
  it('calls the real client, then writes request + response to disk', async () => {
    process.env.CLAUDE_LIVE = '1';
    const cassettePath = path.join(tempDir, 'recorded.json');
    const fakeRealClient = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 50, output_tokens: 2 } }),
      },
    };

    const client = createCassetteClient({ cassettePath, realClient: fakeRealClient as any });
    const req = { model: 'claude-opus-4-7', system: 'sys', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], max_tokens: 8192 };
    const out = await client.messages.create(req);

    expect(fakeRealClient.messages.create).toHaveBeenCalledOnce();
    expect(fakeRealClient.messages.create).toHaveBeenCalledWith(req);
    expect(out.content[0].type).toBe('text');

    expect(existsSync(cassettePath)).toBe(true);
    const written = JSON.parse(readFileSync(cassettePath, 'utf8'));
    expect(written.request).toEqual(req);
    expect(written.response.content[0].text).toBe('{}');
  });

  it('throws when CLAUDE_LIVE=1 but realClient is missing', async () => {
    process.env.CLAUDE_LIVE = '1';
    const cassettePath = path.join(tempDir, 'no-client.json');
    const client = createCassetteClient({ cassettePath });
    await expect(client.messages.create({ model: 'm', system: 's', messages: [], max_tokens: 1 })).rejects.toThrow(/realClient/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter @operscale-calendar/agent test test/helpers/cassette-client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cassette helper**

Create `apps/agent/test/helpers/cassette-client.ts`:

```ts
// Anthropic-shaped fake client backed by a JSON cassette.
//   - Default mode (CLAUDE_LIVE != '1'): replays the cassette JSON.
//   - Record mode (CLAUDE_LIVE === '1'): calls realClient and overwrites the JSON.
// The cassette captures BOTH request and response so a request-shape change
// forces a re-record (the next replay will differ; integration test asserts
// equivalence).

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface AnthropicLikeClient {
  messages: {
    create: (req: any) => Promise<any>;
  };
}

export interface CassetteFile {
  request: unknown;
  response: unknown;
}

export interface CassetteClientOptions {
  cassettePath: string;
  realClient?: AnthropicLikeClient;
}

function isRecordMode(): boolean {
  return process.env.CLAUDE_LIVE === '1';
}

async function readCassette(cassettePath: string): Promise<CassetteFile> {
  try {
    const raw = await fs.readFile(cassettePath, 'utf8');
    return JSON.parse(raw) as CassetteFile;
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `cassette missing at ${cassettePath} — record one with \`pnpm --filter @operscale-calendar/agent test:claude:live\``,
      );
    }
    throw err;
  }
}

async function writeCassette(cassettePath: string, file: CassetteFile): Promise<void> {
  await fs.mkdir(path.dirname(cassettePath), { recursive: true });
  await fs.writeFile(cassettePath, JSON.stringify(file, null, 2), 'utf8');
}

export function createCassetteClient(opts: CassetteClientOptions): AnthropicLikeClient {
  return {
    messages: {
      async create(req: any) {
        if (isRecordMode()) {
          if (!opts.realClient) {
            throw new Error(
              'CLAUDE_LIVE=1 record mode requires `realClient` to be passed to createCassetteClient',
            );
          }
          const response = await opts.realClient.messages.create(req);
          await writeCassette(opts.cassettePath, { request: req, response });
          return response;
        }
        const cassette = await readCassette(opts.cassettePath);
        return cassette.response;
      },
    },
  };
}
```

- [ ] **Step 4: Verify tests pass**

```bash
pnpm --filter @operscale-calendar/agent test test/helpers/cassette-client.test.ts
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/agent/test/helpers/cassette-client.ts apps/agent/test/helpers/cassette-client.test.ts
git commit -m "$(cat <<'EOF'
feat(agent): cassette client helper for L2 cassette-replay tests

Anthropic-shaped fake client. Default mode replays committed JSON;
CLAUDE_LIVE=1 record mode calls a passed-in realClient and overwrites
the JSON. Both request and response are persisted, so a request-shape
change naturally forces a re-record. Replay mode is what `pnpm test`
runs in CI — no API key required.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13 — Brief fixture + record the first cassette

**Files:**
- Create: `apps/agent/test/fixtures/briefs/initial-fashion-tier-2.ts`
- Create: `apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json` (recorded; committed)

This task does TWO things: lands a fixture `BriefAnalyzerInput` (deterministic, fashion + tier=standard, no photos for the first cassette to keep recording cost low) AND records the first cassette by running `pnpm test:claude:live` on the integration test from Task 14. We split fixture-from-test for cleanliness.

The test in Task 14 will:
1. Load the bank catalog from `niche-briefs/`, `docs/specs/script-frameworks.md`, `docs/specs/angle-archetypes.md`.
2. Call `selectFrameworksForBrief` with the fixture inputs and an empty history.
3. Call `buildPromptMessages`.
4. Call `cassetteClient.messages.create` (replay during CI, record locally with `CLAUDE_LIVE=1`).
5. Validate, audit, post-process the response.
6. Assert the SupersetOutput shape.

For Task 13 we ship the fixture only; recording happens after Task 14's test exists (the `--mode=live` invocation needs a target).

- [ ] **Step 1: Create the fixture brief**

Create `apps/agent/test/fixtures/briefs/initial-fashion-tier-2.ts`:

```ts
import type { BriefAnalyzerInput } from '@/lib/types/v2';

// Deterministic fixture for the first L2 cassette.
// Tier "standard" = 14 video + 7 carousel = 21 calendar slots.
// No photos: keeps the first cassette small + cheap.
// brief_id and customer_id are stable so seed_hash is stable across re-records.
export const initialFashionTier2: BriefAnalyzerInput = {
  brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  submitted_at_iso: '2026-05-04T09:00:00Z',
  submission_week_iso: '2026-W18',
  order_index: 1,
  tier: 'standard',

  niche_slug: 'fashion',
  niche_label: 'Fashion e-commerce',

  brand_name: 'Tola Studios',
  owner_name: 'Tola Adekunle',
  phone_e164: '+2348012345678',
  email: 'tola@example.com',

  one_line_description: 'Bespoke ankara tailoring for Lagos professionals, three-week guaranteed turnaround.',
  offer_description:
    'Womenswear bespoke pieces — fitted dresses, two-piece sets, and tailored blazers in ankara, adire, and aso-oke. Each piece is hand-finished over 14 hours by a team of three. Studio in Lekki Phase 1.',
  price_point_band: 'NGN 80k – 250k per piece',

  primary_audience_description:
    'Lagos women, 28-45, established professionals who want bespoke without bridal-tailoring delays.',
  audience_age_range: '28-45',
  audience_location: 'Lagos (primary), Abuja, UK diaspora',
  audience_belief: 'Custom tailoring in Lagos is unreliable; pieces will arrive late or be poorly finished.',
  audience_belief_target:
    'Three-week guaranteed turnaround on bespoke is real, and the finishing standard is visible in every piece.',

  logo_uploaded_yes_no: 'no',
  brand_colours: 'rust, ivory, deep navy',
  instagram_handle: '@tolastudios',

  photo_count: 0,
  photo_consent_yes_no: 'no',

  stated_voice: 'crafted, direct, no-nonsense — speaks to time and labour, not luxury cliché',
  reference_posts_block: [
    '— Post 1: "14 hours of hand-finishing per piece. We do not rush. We do not compromise the seam."',
    '— Post 2: "If you have ever had ankara shrink in the wash, the fabric is not the issue. The wash is."',
    '— Post 3: "Three-week turnaround means three weeks. Not six. Not eight. Three."',
  ].join('\n  '),
  customer_backstory_verbatim: '',

  video_count: 14,
  carousel_count: 7,
};
```

- [ ] **Step 2: Verify the fixture typechecks**

```bash
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: clean.

- [ ] **Step 3: Commit the fixture**

```bash
git add apps/agent/test/fixtures/briefs/initial-fashion-tier-2.ts
git commit -m "$(cat <<'EOF'
test(agent): fixture brief for first L2 cassette

Deterministic BriefAnalyzerInput for a fashion / tier=standard brief
without photos. brief_id and customer_id are stable so the seed_hash
stays constant across cassette re-records.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

The cassette JSON itself is recorded in Task 14 once the integration test exists.

---

## Task 14 — L2 integration test + cassette recording

**Files:**
- Create: `apps/agent/test/integration/initial-fashion-tier-2.test.ts`
- Create: `apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json` (recorded by `pnpm test:claude:live`; committed)

This is the first L2 cassette-replay integration test. It exercises Phase 1 (`selectFrameworksForBrief`, `loadBankCatalog`) + Phase 2 (`buildPromptMessages`, `validateAiOutput`, `auditFabrication`, `postProcess`) end-to-end against a recorded Claude response.

The test runs in two modes:
- **Replay (default, CI):** loads the committed cassette JSON, validates the recorded response through the Phase 2 pipeline, asserts the SupersetOutput shape.
- **Record (local, `pnpm test:claude:live`):** loads the master `.env`, instantiates the real Anthropic SDK, calls Claude Opus 4.7, writes the cassette JSON, then runs the same assertions.

- [ ] **Step 1: Write the integration test**

Create `apps/agent/test/integration/initial-fashion-tier-2.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { loadBankCatalog } from '@/lib/bank-catalog';
import { selectFrameworksForBrief } from '@/lib/framework-selector';
import { buildPromptMessages } from '@/lib/prompt-builder';
import { validateAiOutput } from '@/lib/output-validator';
import { auditFabrication } from '@/lib/fabrication-audit';
import { postProcess } from '@/lib/post-processor';
import { createCassetteClient } from '../helpers/cassette-client';
import { initialFashionTier2 } from '../fixtures/briefs/initial-fashion-tier-2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const cassettePath = path.resolve(__dirname, '../fixtures/cassettes/initial-fashion-tier-2.json');

describe('L2 integration — initial / fashion / tier-standard', () => {
  let pipelineResult: ReturnType<typeof postProcess>;
  let validateOk: boolean;

  beforeAll(async () => {
    // Phase 1 setup — load real catalog from repo paths.
    const catalog = await loadBankCatalog({
      nichesDir: path.join(REPO_ROOT, 'niche-briefs'),
      frameworksFile: path.join(REPO_ROOT, 'docs/specs/script-frameworks.md'),
      archetypesFile: path.join(REPO_ROOT, 'docs/specs/angle-archetypes.md'),
    });

    const seed = await selectFrameworksForBrief({
      inputs: {
        customer_id: initialFashionTier2.customer_id,
        niche: initialFashionTier2.niche_slug,
        order_index: initialFashionTier2.order_index,
        submission_week_iso: initialFashionTier2.submission_week_iso,
      },
      tier: initialFashionTier2.tier,
      catalog,
      fetchHistory: async () => [],
    });

    const built = buildPromptMessages({
      brief: initialFashionTier2,
      seed,
      catalog,
      photos: [],
    });

    // Cassette boundary: replay JSON in CI; record live with CLAUDE_LIVE=1.
    const realClient = process.env.CLAUDE_LIVE === '1'
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : undefined;
    const cassetteClient = createCassetteClient({ cassettePath, realClient });

    const response = await cassetteClient.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      temperature: 0.4,
      system: built.system,
      messages: built.messages,
    });

    // Phase 2 pipeline.
    const text =
      Array.isArray(response.content)
        ? response.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
        : '';
    const validation = validateAiOutput(text, seed, initialFashionTier2.tier);
    validateOk = validation.ok;
    if (!validation.ok) {
      // Surface for assertion clarity — test will fail below.
      console.error('validation.failure =', validation.failure);
      throw new Error(`validation failed: ${validation.failure.reason}`);
    }
    const postHocViolations = auditFabrication(validation.value, initialFashionTier2.customer_backstory_verbatim);
    pipelineResult = postProcess({
      aiOutput: validation.value,
      niche: initialFashionTier2.niche_slug,
      tier: initialFashionTier2.tier,
      hasPhotos: initialFashionTier2.photo_count > 0,
      reanalyzed: false,
      postHocViolations: postHocViolations.length,
    });
  }, 200_000);

  it('output passes validation', () => {
    expect(validateOk).toBe(true);
  });

  it('calendar_plan has the tier-standard slot count (14 + 7 = 21)', () => {
    expect(pipelineResult.calendar_plan).toHaveLength(21);
  });

  it('every calendar_plan slot uses a framework + archetype from the seed', () => {
    const allowedF = new Set(['DR_FORMULA', 'PAS', 'AIDA', 'PAIPS', 'VALUE_EQUATION', 'THREE_LAYER_HOOK_STACK', 'PATTERN_INTERRUPT', 'OPEN_LOOP', 'CURIOSITY_GAP', 'SPECIFICITY_STACK', 'QUICK_WIN', 'EDUCATIONAL_BREAKDOWN', 'PROCESS_DEMYSTIFICATION', 'NUMBERED_LIST', 'CHECKLIST_REVEAL', 'MYTH_BUSTER', 'COMPARISON', 'ANTI_TREND', 'INDUSTRY_INSIDER', 'COST_REVEAL', 'BEHIND_THE_WORK', 'DATASET_REVEAL', 'DECODED_JARGON', 'STEEL_MAN', 'FRAME_RE_SET']);
    for (const slot of pipelineResult.calendar_plan) {
      expect(allowedF.has(slot.framework_slot)).toBe(true);
    }
  });

  it('SupersetOutput contains brief_summary, upsell_recommendation, and a numeric quality score', () => {
    expect(typeof pipelineResult.brief_summary).toBe('string');
    expect(pipelineResult.brief_summary.length).toBeGreaterThan(20);
    expect(typeof pipelineResult.upsell_recommendation.should_upsell).toBe('boolean');
    expect(pipelineResult.estimated_brief_quality_score).toBeGreaterThanOrEqual(0);
    expect(pipelineResult.estimated_brief_quality_score).toBeLessThanOrEqual(1);
  });

  it('the model output respects no-fabrication: backstory verbatim is empty so no fabricated origin lines', () => {
    const violations = auditFabrication(pipelineResult, initialFashionTier2.customer_backstory_verbatim);
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Confirm the test fails-loudly without a cassette**

```bash
pnpm --filter @operscale-calendar/agent test test/integration/initial-fashion-tier-2.test.ts
```

Expected: FAIL — `cassette missing at apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json`. The error message should mention the `pnpm test:claude:live` command.

- [ ] **Step 3: Record the cassette (one-time, manual)**

This is the only manual step in the plan. The recording invocation reads the master `.env` at `<repo-parent>/.env` for `ANTHROPIC_API_KEY`. The runner from Task 1 handles env loading.

```bash
pnpm --filter @operscale-calendar/agent test:claude:live initial-fashion-tier-2
```

Expected:
- The script logs "[run-live-tests] master .env not found at ..." and exits 1 if the master `.env` is missing — fix by ensuring the file exists at `c:\Users\DELL\Documents\Antigravity\operscale-calender\.env` with `ANTHROPIC_API_KEY=...`.
- On success: vitest invokes the integration test in record mode; Anthropic returns a real Opus 4.7 response (~35-75 seconds, ~$0.30-0.55); the cassette is written to `apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json`; the test assertions then run and pass.

If the test assertions fail after recording (e.g. `slot_count_mismatch`), the model output didn't match the spec. **Do NOT silently massage the assertions** — that violates the no-shortcut rule. Investigate: re-read the prompt the test built (`built.system`, `built.messages`), check the spec, fix the prompt-builder, delete the bad cassette, re-record.

- [ ] **Step 4: Verify replay mode produces the same result**

```bash
pnpm --filter @operscale-calendar/agent test test/integration/initial-fashion-tier-2.test.ts
```

Expected: 5 passing assertions; ms-scale runtime (no network).

- [ ] **Step 5: Commit the test + the recorded cassette together**

```bash
git add apps/agent/test/integration/initial-fashion-tier-2.test.ts apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json
git commit -m "$(cat <<'EOF'
test(agent): first L2 cassette-replay integration test

End-to-end test that exercises Phase 1 (loadBankCatalog,
selectFrameworksForBrief) + Phase 2 (buildPromptMessages,
validateAiOutput, auditFabrication, postProcess) against a recorded
Claude Opus 4.7 response. Replay mode is the CI default; record mode
runs via `pnpm test:claude:live` and uses the master .env at the repo
parent dir.

The committed cassette captures both the request and the response so
a request-shape change naturally forces a re-record (the next replay
would diverge from the recorded request).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15 — Phase 2 close-out: full test run + push + memory update

**Files:** None new.

- [ ] **Step 1: Run the full Phase 2 test suite**

```bash
pnpm --filter @operscale-calendar/agent test -- --reporter=verbose
```

Expected: ~110 passing tests across:
- `types/v2.test.ts` — 14 (9 existing + 5 Phase 2)
- `bank-catalog.test.ts` — 16 (unchanged)
- `framework-selector.test.ts` — 21 (unchanged)
- `prompt-builder.test.ts` — 47 (Layers 1-4 + buildPromptMessages)
- `output-validator.test.ts` — 19 (10 schema + 9 top-level)
- `fabrication-audit.test.ts` — 9
- `post-processor.test.ts` — 11
- `test/helpers/cassette-client.test.ts` — 4
- `test/integration/initial-fashion-tier-2.test.ts` — 5

Zero failures, zero skipped.

- [ ] **Step 2: Run typecheck across the workspace**

```bash
pnpm --filter @operscale-calendar/agent typecheck
```

Expected: zero errors.

- [ ] **Step 3: Run lint**

```bash
pnpm --filter @operscale-calendar/agent lint
```

Expected: zero errors. Warnings tolerated.

- [ ] **Step 4: Verify the docker image still builds**

```bash
docker build -f apps/agent/Dockerfile -t operscale-calendar-agent:phase-2-test . 2>&1 | tail -20
```

Expected: build succeeds. The new `test/` directory is not part of the production image (it lives outside `src/`).

- [ ] **Step 5: Push to main**

```bash
git push origin main
```

Per project pattern (direct commits to main, push after each task; see prompt.md context).

- [ ] **Step 6: Update memory with Phase 2 completion**

Update `C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\project_state.md` to add a "V2 Phase 2 — shipped" section:

- Phase 2 commits range
- Cassette recorded at `apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json`
- Phase 3 (claude.ts orchestrator + worker container + supabase-admin assertion) is the next chunk
- Phase 2 plan file at `docs/plans/2026-05-04-v2-phase-2-pure-pipeline-modules.md`

Don't commit memory updates — memory lives outside the repo per CLAUDE.md.

---

## Self-review checklist

After all tasks above are done, before declaring Phase 2 complete:

- [ ] **Spec coverage**: every Phase 2 deliverable in `docs/specs/v2-pipeline-implementation-design.md` §9 has a task above. (prompt-builder → Tasks 3-7; output-validator → Tasks 8-9; fabrication-audit → Task 10; post-processor → Task 11; first L2 cassette tests → Tasks 12-14. ✓)
- [ ] **No-loss invariants**: invariants from §4.3 testable in Phase 2:
  - #1 idempotency_key UNIQUE — enforced by 0006 migration (Phase 1) + a Phase 4 route test
  - #5 brief_photos canonical reference — Phase 3 worker test
  - #8 service-role isolation — Phase 3 compose test
  - #9 cost telemetry never lost — Phase 3 orchestrator test
- [ ] **Module surface contracts** (top of plan) match the implementation surfaces in Tasks 3-11. Function names, parameter names, return types — all consistent.
- [ ] **No placeholders**: search the plan for `TBD`, `TODO`, `implement later`, `similar to Task N`. (None present. ✓)
- [ ] **Frequent commits**: each of the 15 tasks ends with a single focused commit. (15 commits total for Phase 2. ✓)
- [ ] **Cassette is real Claude output**: the cassette JSON committed in Task 14 is from a real Anthropic call (no synthesised fixtures, per CLAUDE.md no-shortcut rule).

---

## Out of scope for Phase 2 (deferred to later phases)

- `claude.ts` rewrite to factory + orchestrator (Phase 3)
- `worker/index.ts` and the second compose service `operscale-calendar-worker` (Phase 3)
- `supabase-admin.ts` runtime client-only-import assertion (Phase 3)
- Live nightly smoke test workflow (Phase 3)
- `analyze/route.ts` queue-enqueue cutover (Phase 4)
- `approve/route.ts` `customer_framework_history` transactional write (Phase 4)
- Additional cassettes (re-analyze same_frameworks, re-analyze new_frameworks, photos-present brief, exhaustion+LRU): a follow-up Phase 2.5 plan once the orchestrator (Phase 3) exists and the integration tests can also exercise the worker DB writes
- Cassette-rerecord automation in CI (developer runs `pnpm test:claude:live` manually + commits)
- `dotenv` package usage (avoided — Node 20 `--env-file` is sufficient and adds no dep)

---

## Plan-level notes

- **Prompt fidelity**: Layer 1 and Layer 4 are pasted verbatim from `ai-brief-analysis.md` §3.1 and §3.4. If the spec is edited, the prompt-builder must be updated in the same commit (CLAUDE.md "Plan keeps pace with code"). Tests assert structural invariants, not exact byte equality, so small spec polish doesn't break tests; substantive structural changes will.
- **Cassette is one file per test**: future re-analyze and exhaustion/LRU cassettes will be separate JSON files in `apps/agent/test/fixtures/cassettes/`. Naming convention: `<trigger>-<niche>-<tier>.json` matches the test file naming.
- **Code-review-driven plan edits**: per memory's `feedback_plan_keeps_pace_with_code`, if a code review catches a bug that originated in this plan, fix the plan in the same commit as the code fix.
- **Subagent budget**: Phase 1 used roughly one implementer + one spec reviewer per task, occasionally one code-quality reviewer. Phase 2 is similar in shape — pure modules with TDD, so the implementer agent is well-bounded.
