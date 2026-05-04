# V2 brief-analysis pipeline — implementation design

**Status:** Authoritative for the V2 code-implementation cycle (Phase 1).
**Owner:** Akinwunmi.
**Last updated:** 2026-05-04.
**Supersedes:** the original `apps/agent/src/lib/claude.ts` stub schema and the inline implementation hints in `prompt.md`.
**Pairs with:** `docs/specs/ai-brief-analysis.md` (the prompt itself), `docs/specs/non-duplication-system.md` (deterministic seeding), `docs/specs/research-methodology.md` (the four lenses), `docs/specs/script-frameworks.md`, `docs/specs/angle-archetypes.md`, `docs/specs/content-types-allowed.md`.

This document specifies how the V2 brief-analysis pipeline is **built** — service topology, queue mechanism, schema additions, code units, data flow, failure handling, and the phased rollout. It is the bridge between the per-component specs (which describe **what** the system does) and the implementation plan (which describes **the order of work**).

The driving constraint is: **nothing breaks and no intelligence/data/info is lost across the stages/steps.** Every design decision here is in service of that invariant.

## 1. Goal and scope

**Goal.** Replace the typed-signature stub at `apps/agent/src/lib/claude.ts` with a working V2 brief-analysis pipeline that:

- Computes a deterministic per-customer framework × archetype selection per `non-duplication-system.md`.
- Renders the four-layer prompt per `ai-brief-analysis.md` §3.
- Calls Claude Opus 4.7 with vision blocks for customer photos.
- Validates the structured JSON output against the spec's schema.
- Runs an application-side fabrication-risk audit on top of the model's self-audit.
- Writes the results to `analysis_runs` (with `framework_seed` JSONB) and `customer_framework_history` (on founder approval).

**In scope.** All eleven code units listed in §4, the new `0006_ai_analysis_jobs.sql` migration, the worker container, and the wiring of `analyze`/`approve` routes.

**Out of scope.** Phase 2 production (script generation, video render, carousel image generation, FFmpeg stitching). Customer-facing approval gates. Subscription billing. Manual carry-forward UI for re-analysis edits.

## 2. Locked decisions

These were resolved in the brainstorming pass; the rest of this document depends on them.

| # | Decision | Rationale |
|---|---|---|
| Q1 | **Output schema is a superset.** Model output stays §3.4-shaped; application post-processes `brief_summary`, `upsell_recommendation`, `estimated_brief_quality_score`. | `ai-brief-analysis.md` §3.4 is the authoritative model-facing schema, but the CRM already reads three fields the spec drops. Post-processing preserves those without polluting the prompt. |
| Q2 | **Single spec, four implementation phases.** | The pipeline is one tightly coupled flow; splitting introduces seams where partial state could ship. Phase gating gives incremental verification without merge-boundary risk. |
| Q3 | **Postgres-backed queue.** | Durable across container restarts; clean separation of HTTP serving from background processing; `FOR UPDATE SKIP LOCKED` enables future horizontal scaling. |
| Q4 | **Separate `ai_analysis_jobs` table** (not a status column on `analysis_runs`). | Keeps `analysis_runs.is_current = true` meaningful only for completed runs; avoids coupling job lifecycle to run lifecycle; idempotency-key uniqueness is natural. |
| Q5 | **Parse-on-startup bank catalog with comment-frontmatter slot IDs.** Niche briefs + framework + archetype docs ship in the Docker image; parsed once on worker boot into an in-memory map keyed by slot ID; CI test enforces completeness. | One source of truth (the markdown spec docs); no JSON-drift risk; explicit slot-ID anchors survive heading reorganisation. |
| Q6 | **Separate worker container** in docker-compose. Same image, different CMD. | Clean process separation; independent monitoring; horizontal scaling via `replicas:` in compose; no Next.js detached-promise gotcha. |
| Q7 | **Re-analysis context = note + edit-diff, both modes.** Edits stay tied to their source `analysis_run_id`; never auto-applied to new runs; carry-forward UI deferred to Phase 2. | Strict no-loss: founder hand-tuning visible to next iteration as evidence of intent. No silent merges keep the founder review honest. |
| Q8 | **Worker fetches photos on job pickup**, holds in memory across Claude retries. | Worker is the single boundary between Storage and Claude; HTTP analyze route stays pure enqueue. Service-role key isolated to worker container. |
| Q9 | **Three-layer testing pyramid:** L1 unit (mocked, every push), L2 cassette-replay integration (recorded Claude, every push), L3 live smoke (nightly cron, ~$12/month). | No-loss verification at every code path; cost discipline through cassettes; model-drift detection via nightly smoke. |

## 3. Architecture

### 3.1 Service topology

Two services share one Docker image:

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ operscale-calendar-agent    │         │ operscale-calendar-worker   │
│ (HTTP, Next.js 15)          │         │ (Node, no HTTP listener)    │
│                             │         │                             │
│  POST /v1/brief/analyze ────┼──┐  ┌──▶│ poll loop (every 5s)        │
│   ↳ INSERT ai_analysis_jobs │  │  │   │  ↳ claim 1 row              │
│      (status=queued)        │  │  │   │     FOR UPDATE SKIP LOCKED  │
│   ↳ return 202              │  │  │   │  ↳ run BriefAnalyzer        │
│                             │  │  │   │  ↳ INSERT analysis_runs     │
│  POST /v1/brief/approve     │  │  │   │  ↳ UPDATE job status        │
│   ↳ materialise edits       │  │  │   │                             │
│   ↳ INSERT customer_        │  │  │   └─────────────────────────────┘
│      framework_history      │  │  │              │
│      (transactional)        │  │  │              │
└─────────────────────────────┘  │  │              ▼
            │                    │  │      ┌──────────────────┐
            ▼                    ▼  │      │  Anthropic API   │
   ┌────────────────────┐  ┌────────┴──┐   │  Claude Opus 4.7 │
   │ Supabase Postgres  │◀─┤Postgres   │   └──────────────────┘
   │  briefs            │  │queue table│   ┌──────────────────┐
   │  brief_photos      │  └───────────┘   │ Supabase Storage │
   │  ai_analysis_jobs  │                  │  customer-photos │
   │  analysis_runs     │                  │  (private bucket)│
   │  analysis_edits    │                  └──────────────────┘
   │  customer_framework│
   │   _history         │
   │  llm_calls         │
   │  activity_log      │
   └────────────────────┘
```

### 3.2 Trust boundaries

- **Web → agent (HTTP)**: existing route surface. JWT-authed for approve. Submit handler triggers analyze.
- **Agent → worker (Postgres queue)**: indirect. No direct network call between containers. Decoupled via `ai_analysis_jobs`.
- **Worker → Anthropic + Storage**: direct outbound. Worker holds `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Agent does NOT hold service-role key (CLAUDE.md secrets rule 3).

### 3.3 Two services, one image

`apps/agent/` compiles to one Docker image. The compose file declares two services with the same image and different CMDs:

```yaml
services:
  agent:
    image: operscale-calendar-agent:latest
    command: ["node", "apps/agent/server.js"]
    env_file: /etc/operscale-calendar/agent.env
    # NEXT_PUBLIC_*, ANTHROPIC_API_KEY (read-only routes), no SERVICE_ROLE
  worker:
    image: operscale-calendar-agent:latest
    command: ["node", "apps/agent/dist/worker.js"]
    env_file: /etc/operscale-calendar/worker.env
    # ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, no NEXT_PUBLIC_*
    deploy:
      replicas: 1   # scale by raising this if Anthropic latency demands
```

Three env files on the VPS at `/etc/operscale-calendar/`, all `chmod 600`:
- `web.env` — existing, for the marketing/customer-facing Next.js web container
- `agent.env` — existing, for the Next.js HTTP API container; **does NOT** contain `SUPABASE_SERVICE_ROLE_KEY`
- `worker.env` — **new, added by Phase 3**; contains `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; no `NEXT_PUBLIC_*` keys

## 4. Data model

### 4.1 Migration `0006_ai_analysis_jobs.sql`

```sql
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

-- Constraint trigger: founder_note + prior_run_id required for re_analyze_*
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

alter table ai_analysis_jobs enable row level security;

create policy ai_analysis_jobs_anon_deny
  on ai_analysis_jobs as restrictive for all to anon using (false);

create policy ai_analysis_jobs_founder_read
  on ai_analysis_jobs as permissive for select to authenticated
  using ((auth.jwt() ->> 'role') = 'founder');
-- service_role bypasses RLS — used by both agent and worker.
```

### 4.2 Tables touched (no schema change)

| Table | How V2 uses it |
|---|---|
| `briefs` | Read-only for analysis. `form_payload` JSONB is the customer corpus. |
| `brief_photos` | Read-only. Worker dereferences photo IDs to Storage paths. |
| `analysis_runs` | INSERT on Claude success only (NOT at queue time). `framework_seed` JSONB populated per `non-duplication-system.md`. `is_current = true` only on success. Re-analysis sets prior `is_current = false` in the same transaction. |
| `analysis_edits` | INSERTed by CRM when founder edits. Read by prompt-builder during re-analysis to render edit-diff. Read by approve route to materialise the final email body. |
| `customer_framework_history` | INSERTed by approve route in same transaction as `orders.status='founder_approved'`. Never written by analysis worker. |
| `llm_calls` | INSERTed by worker on every Claude call (including failed retries). Source of truth for cost telemetry. |
| `activity_log` | INSERTed by worker on every state transition. |

### 4.3 No-loss invariants

These are the implementation contract. Each becomes a test in L1 (§7).

1. `ai_analysis_jobs.idempotency_key UNIQUE` — duplicate enqueue returns existing job, no double-INSERT. Idempotency key format: `{brief_id}::{trigger_type}::{prior_run_index|0}`.
2. **Stuck-job sweep**: jobs with `status='running'` and `started_at < now() - 5min` get reclaimed (status→queued, attempt_count++) until `attempt_count = 3`, then status→failed with `error_detail.reason='orphaned_by_restart'`.
3. **Atomic re-analysis transition**: prior `analysis_runs.is_current = false` and new `analysis_runs.is_current = true` happen in the same transaction.
4. **Atomic approval write**: `orders.status='founder_approved'` and N `customer_framework_history` rows happen in the same transaction. Either both succeed or both rollback.
5. **`brief_photos` lookup is the canonical reference** — worker fetches bytes per job claim, holds in memory for retries within that job.
6. **Niche brief is required** — missing `niche-briefs/<niche>.md` for a known-niche brief throws `niche_brief_missing` error and writes `ai_analysis_failed` activity log.
7. **Slot-ID mapping is enforced at startup** — bank catalog parser fails container boot if a slot in the affinity matrix lacks a `<!-- slot: ID -->` comment.
8. **Service-role isolation**: worker container holds `SUPABASE_SERVICE_ROLE_KEY`; agent container does not. CI grep test asserts the env var doesn't appear in the agent compose service.
9. **Cost telemetry is best-effort never lost**: `llm_calls` INSERT happens in a `try { ... } finally { writeLLMCall(); }` block.
10. **Activity log is best-effort never lost**: same `try/finally` pattern around state transitions.

## 5. Component breakdown

Eleven code units. Eight are pure-logic modules; three are entry points.

| # | File | Pure / IO | Responsibility | Key interface |
|---|---|---|---|---|
| 1 | `apps/agent/src/lib/types/v2.ts` | Types only | Canonical types: `FrameworkSlot`, `ArchetypeSlot`, `NicheSlug`, `Tier`, `AiOutput` (matches §3.4 schema), `SupersetOutput`, `FrameworkSeedResult`, `Violation`. | exports |
| 2 | `apps/agent/src/lib/bank-catalog.ts` | IO at boot | Parse `niche-briefs/*.md` + `script-frameworks.md` + `angle-archetypes.md`. Validate slot frontmatter. Build affinity matrices. | `loadBankCatalog(): Promise<BankCatalog>` |
| 3 | `apps/agent/src/lib/framework-selector.ts` | Pure compute + DB read | `seed = sha256(...)`. Read `customer_framework_history`. Score affinity. Apply seed. Pick `(N_frameworks, N_archetypes)`. Detect exhaustion → LRU fallback. | `selectFrameworksForBrief(input, tier, mode?, priorRun?): Promise<FrameworkSeedResult>` |
| 4 | `apps/agent/src/lib/prompt-builder.ts` | Pure | Render Layer 1/2/3/4 verbatim from spec. Vision blocks for photos. Edit-diff for re-analysis. Pull excerpts from BankCatalog by slot. | `buildPromptMessages(input, seed, photos, priorRun?, edits?): {system, messages}` |
| 5 | `apps/agent/src/lib/output-validator.ts` | Pure | zod schema. Slot-count check. Selection-list-membership check. | `validateAiOutput(raw, seed, tier): Result<AiOutput, ValidationFailure>` |
| 6 | `apps/agent/src/lib/fabrication-audit.ts` | Pure | App-side regex sweep over `calendar_plan` strings. Forbidden phrases per `ai-brief-analysis.md` §8. | `auditFabrication(aiOutput, customerBackstory): Violation[]` |
| 7 | `apps/agent/src/lib/post-processor.ts` | Pure | Derive `brief_summary` (1-2 sentences), `upsell_recommendation`, `estimated_brief_quality_score`. | `postProcess(aiOutput, niche, tier, flags): SupersetOutput` |
| 8 | `apps/agent/src/lib/claude.ts` | IO orchestrator | The pipeline. Replaces stub. Factory pattern: `createBriefAnalyzer({client, supabase, catalog, logger})`. Steps: select → build → call (with retry) → validate → audit → merge → post-process → return. Writes `llm_calls` in `try/finally`. | `analyzeBrief(input): Promise<AnalyzeBriefResult>` |
| 9 | `apps/agent/src/worker/index.ts` | IO entry point | Worker process. Bootstrap loads BankCatalog + Supabase service-role client + BriefAnalyzer. Loop claims 1 job via `FOR UPDATE SKIP LOCKED`, runs analyzer, writes results, updates job status. SIGTERM handler finishes current job, no new claim. Bootstrap-sweep reclaims stuck jobs. | `node apps/agent/dist/worker.js` |
| 10 | `apps/agent/src/app/v1/brief/analyze/route.ts` | Thin HTTP | Replaces stub. POST `{brief_id, trigger_type?, founder_note?, prior_run_id?}`. Validate, compute idempotency_key, INSERT `ai_analysis_jobs`, return `202 {job_id, status: 'queued'}`. Doesn't call Claude. | `POST /v1/brief/analyze` |
| 11 | `apps/agent/src/app/v1/brief/approve/route.ts` | Thin HTTP + transactional DB write | Extends current stub. Adds: read `analysis_runs.framework_seed.selected_pairs`, INSERT N `customer_framework_history` rows in same transaction as `orders.status='founder_approved'`. | `POST /v1/brief/approve` |

### 5.1 Module dependency direction (no cycles)

```
types/v2.ts ────────────────────────────┐
                                        ▼
bank-catalog.ts ◀── prompt-builder.ts ──┐
                            ▲           │
framework-selector.ts ──────┘           │
                                        ▼
output-validator.ts ──────────────► claude.ts ──► worker/index.ts
fabrication-audit.ts ─────────────────► ▲
post-processor.ts ────────────────────► │
                            analyze/route.ts (no claude.ts dep, just job INSERT)
                            approve/route.ts (no claude.ts dep, just history INSERT)
```

### 5.2 Refactors of existing code

- **`lib/claude.ts` factory pattern**: existing singleton `getAnthropicClient()` becomes `createAnthropicClient(apiKey)` + a `createBriefAnalyzer({client, supabase, catalog, logger})` factory. Singleton instantiation moves to `worker/index.ts` bootstrap.
- **`lib/supabase-admin.ts`**: confirm it uses service-role key only on server-side. Add a runtime assertion at module load: throws if imported from a `'use client'` file.
- **`analyze/route.ts`**: stub's old "synchronous Claude call" steps 1-10 replaced with the queue-enqueue path (~30 lines).
- **`approve/route.ts`**: existing logic stays; we add steps 4.5 + 4.7 for the history insert (within the same transaction as 4).

## 6. Data flow

### 6.1 Initial analysis

```
1. Customer submits form → web → POST /v1/brief/analyze { brief_id }
2. analyze/route.ts:
   a. idempotency_key = "{brief_id}::initial::0"
   b. INSERT ai_analysis_jobs (trigger_type='initial', status='queued', …)
   c. Return 202 { job_id, status: 'queued' }
3. Worker poll loop (every 5s):
   a. Claim 1 job:
        UPDATE ai_analysis_jobs
           SET status='running', started_at=now(), attempt_count = attempt_count + 1
         WHERE id = (SELECT id FROM ai_analysis_jobs
                      WHERE status='queued'
                      ORDER BY enqueued_at
                      FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING *;
   b. Write activity_log: ai_analysis_started
4. BriefAnalyzer.analyze(input, deps):
   a. framework-selector → seed + selected_pairs
   b. Worker fetches photos from customer-photos bucket → in-memory base64
   c. prompt-builder → {system, messages} (4 layers, vision blocks)
   d. anthropic.messages.create(...) with 5x retry, exp backoff on 5xx/timeout
   e. Each call → INSERT llm_calls (cost, tokens, duration, http_status)
   f. output-validator → zod parse + slot-count + selection-list checks
   g. fabrication-audit → merge violations into ai_output.fabrication_audit
   h. post-processor → derive brief_summary / upsell / quality_score
5. Worker writes results in single transaction:
   a. INSERT analysis_runs (run_index=1, trigger_type='initial', is_current=true,
      framework_seed=…, ai_output=…)
   b. UPDATE ai_analysis_jobs SET status='completed', resulting_run_id=…
   c. INSERT activity_log: ai_analysis_completed
```

### 6.2 Re-analysis

Two modes diverge at framework-selector and at prompt context. Otherwise identical.

```
1. CRM POST /v1/brief/analyze { brief_id, trigger_type, founder_note, prior_run_id }
2. analyze/route.ts:
   a. idempotency_key = "{brief_id}::{trigger_type}::{prior_run.run_index}"
   b. INSERT ai_analysis_jobs (founder_note, prior_run_id, …)
3. Worker claims, runs BriefAnalyzer with reanalysis context:
   a. framework-selector:
      - same_frameworks: REUSE prior_run.framework_seed verbatim
      - new_frameworks: seed = sha256("…::reanalyze::{run_index}");
                        exclude prior pairs from this brief AND
                        customer_framework_history pairs
   b. prompt-builder Layer 3 includes reanalysis_context_block:
        * founder_note (verbatim)
        * Edit-diff from analysis_edits where analysis_run_id = prior_run_id
          (rendered as structured "from / to" entries)
   c. Rest of pipeline identical to 6.1
4. Worker writes results in single transaction:
   a. UPDATE prior analysis_runs SET is_current = false WHERE id = prior_run_id
   b. INSERT analysis_runs (run_index = prior + 1,
      trigger_type='re_analyze_with_note', is_current=true, …)
   c. UPDATE ai_analysis_jobs SET status='completed', resulting_run_id=…
   d. INSERT activity_log: ai_reanalyze_requested + ai_analysis_completed
```

`analysis_edits` rows from prior_run remain in DB tied to prior_run_id. They are NOT auto-applied to the new run.

### 6.3 Approval

```
1. CRM POST /v1/brief/approve { order_id }
   (founder JWT validated)
2. approve/route.ts in single DB transaction:
   a. SELECT analysis_runs WHERE order_id=$1 AND is_current=true
   b. Materialise edits: deep-merge analysis_edits onto ai_output
   c. UPDATE orders SET status='founder_approved', approved_analysis_run_id=…,
      founder_approved_at=now()
   d. INSERT customer_framework_history (one row per pair in
      framework_seed.selected_pairs)
        ON CONFLICT (customer_id, framework_slot, archetype_slot) DO NOTHING
   e. INSERT activity_log: founder_approved (payload: pairs_burned)
3. Outside the transaction:
   f. Render brief email body
   g. Initialize Paystack transaction
   h. Send brief email via Resend with Paystack link
   i. UPDATE orders SET status='brief_sent', brief_email_sent_at=now()
   j. INSERT activity_log: email_brief_sent + email_log row
```

### 6.4 Stuck-job sweep

```
On worker bootstrap AND every 60s:
  SELECT * FROM ai_analysis_jobs
   WHERE status='running' AND started_at < now() - interval '5 minutes'

  For each stuck job:
    if attempt_count < 3:
      UPDATE … SET status='queued', started_at=NULL
      INSERT activity_log: ai_analysis_orphan_reclaimed
    else:
      UPDATE … SET status='failed', completed_at=now(),
             error_detail='{"reason":"orphaned_by_restart","attempts":3}'
      INSERT activity_log: ai_analysis_failed
```

## 7. Failure handling

| Failure | Worker behaviour | Founder visibility |
|---|---|---|
| Anthropic 5xx / timeout | retry up to 5x with exp backoff. Each attempt → llm_calls row. | None unless all 5 fail → ai_analysis_failed |
| Anthropic 4xx (non-retryable) | one llm_calls row, status='failed', error_detail.reason='claude_4xx' | CRM shows failed run with detail |
| `output-validator` fails | one retry with "previous output was malformed because X" prompt addendum. If second attempt also fails → status='failed', error_detail.reason='validation_failed' | CRM shows failed; founder may re-trigger manually |
| `fabrication-audit` finds violations | NOT a failure. Violations merged into ai_output.fabrication_audit, run completes, founder sees flagged slots in CRM | Flagged in CRM with rewrite suggestions |
| Photo missing in Storage | status='failed', error_detail.reason='photo_missing'; aborts before Claude call (saves cost) | CRM shows failed; founder asks customer to re-upload |
| Niche brief file missing | container fails to boot (bank-catalog parse fails). CI test catches before deploy. | N/A — caught pre-deploy |
| Container restart mid-call | job stays 'running' until 5min sweep → reclaim → retry | None unless attempt_count hits 3 |

## 8. Testing strategy

### 8.1 Pyramid

| Layer | When | Cost | Targets |
|---|---|---|---|
| **L1 — Unit (mocked)** | every push/PR | $0 | framework-selector, prompt-builder, output-validator, fabrication-audit, post-processor, bank-catalog parsers, all 10 invariants from §4.3 |
| **L2 — Cassette-replay integration** | every push/PR | $0 after recording | end-to-end pipeline: happy path, both re-analyze modes, exhaustion+LRU, validation-fail recovery, photo-missing failure |
| **L3 — Live smoke** | nightly cron 02:00 UTC | ~$12/month | one real Opus call against frozen canonical brief; opens issue on failure; non-blocking |

Plus manual `pnpm test:claude:live` for re-recording cassettes or pre-release confidence.

### 8.2 Cassette mechanism

Real Claude responses captured in `apps/agent/test/fixtures/cassettes/*.json`, committed to repo. Test harness intercepts Anthropic SDK calls via DI: tests pass a fake client backed by cassette JSON; production passes the real client. Re-record when:

- `ai-brief-analysis.md` schema changes
- `non-duplication-system.md` selection algorithm changes
- Quarterly model-drift check

### 8.3 Test-side seams

- **`createBriefAnalyzer({client, supabase, catalog, logger})`** factory accepts injected dependencies. Tests pass fakes; production passes real ones.
- **Migrations applied to a test schema** via `supabase db push` against a local Supabase docker-compose stack OR a dedicated test database on staging.
- **Frozen `submission_week_iso` and `customer_id`** in fixtures keep seed deterministic.

## 9. Implementation phases

Each phase is one PR with green tests before the next merges. Production is unaffected until Phase 4 lands.

### Phase 1 — Selection + bank catalog (no Claude)

- New: `lib/types/v2.ts`, `lib/bank-catalog.ts`, `lib/framework-selector.ts`, `0006_ai_analysis_jobs.sql`
- Spec edits: add `<!-- slot: ID -->` frontmatter to all 25 framework + 25 archetype sections in `script-frameworks.md` and `angle-archetypes.md` (mechanical, regex-able)
- Tests: L1 only (12-15 unit tests covering deterministic seed, history exclusion, LRU fallback, affinity scoring, bank-catalog completeness)
- Production wiring: none. Migration applied; the table sits empty.
- **Done when**: `pnpm test` green + migration applied to staging Supabase + container boots cleanly with bank-catalog loaded

### Phase 2 — Pure pipeline modules (no orchestrator)

- New: `lib/prompt-builder.ts`, `lib/output-validator.ts`, `lib/fabrication-audit.ts`, `lib/post-processor.ts`
- Tests: L1 + first L2 cassette tests (record using `pnpm test:claude:live` on a fixture brief, commit cassette)
- Production wiring: none. Modules exist but nothing calls them yet.
- **Done when**: cassette tests green; cassette JSON committed; `pnpm test` green

### Phase 3 — Orchestrator + worker entrypoint

- New: `lib/claude.ts` (rewrite, factory pattern), `worker/index.ts`, refactor of `lib/supabase-admin.ts`
- Compose: add `operscale-calendar-worker` service. Same image, different CMD. New env file `/etc/operscale-calendar/worker.env`.
- Deploy: worker container running but **analyze route still returns 501** — worker has no jobs to claim yet
- Tests: L2 cassette tests now exercise full BriefAnalyzer + DB writes against test schema; L3 nightly smoke added
- Production wiring: worker container live but idle. No customer impact.
- **Done when**: worker boots cleanly on staging VPS, picks up a manually-INSERTed test job, processes it end-to-end, writes analysis_runs row correctly

### Phase 4 — Route wiring (the cutover)

- Modified: `analyze/route.ts` (replaces 501 stub with enqueue), `approve/route.ts` (extension for `customer_framework_history` write)
- Production wiring: live. Form's submit path now triggers actual analysis.
- Tests: L1 + L2 + L3 all green; manual end-to-end on staging with a real test brief
- **Rollback plan**: `git revert <phase-4-merge>` + redeploy. Phases 1-3 stay (no harm). Old 501 stub returns; worker idles; no data corruption.
- **Done when**: end-to-end test on staging passes; founder review screen renders new ai_output shape; CRM realtime updates fire; production deploy verified by a real customer brief flowing through the full pipeline

## 10. Observability

- **Sentry**: error tracking on every catch in worker + routes. Both services initialise Sentry in their respective entrypoints. SDK captures `ai_analysis_failed` events with `error_detail` payload as breadcrumbs.
- **Loki**: existing per CLAUDE.md locked stack. Worker logs to stdout in JSON format; collected via Docker logging driver.
- **UptimeRobot**: probes `/v1/health` (agent only). Worker has no HTTP listener; its liveness is observable via `activity_log` entries with `event_type='worker_heartbeat'` written every 30s by the poll loop. CRM dashboard alerts if no `worker_heartbeat` row in the last 90s.
- **CRM dashboards**: existing CRM views read `ai_analysis_jobs` directly. Added: a "Pipeline health" panel showing job counts by status, average duration, recent failures.

## 11. Out of scope

- Manual carry-forward UI for re-analysis edits (Phase 2 UX nicety; Q7 referenced)
- Horizontal scaling of worker beyond 1 replica
- Cassette-rerecord automation in CI (developer runs `pnpm test:claude:live` manually + commits)
- LISTEN/NOTIFY upgrade to push-based queue pickup (start with poll; upgrade if pickup latency complained about)
- Phase 2 production (script generation, video render, carousel image generation, FFmpeg stitching, customer delivery)

## 12. Cross-references

- `docs/specs/ai-brief-analysis.md` — the prompt itself.
- `docs/specs/non-duplication-system.md` — deterministic seeding + LRU fallback.
- `docs/specs/research-methodology.md` — the four lenses (rendered inside the prompt, not separate code).
- `docs/specs/script-frameworks.md` — bank of 25 frameworks.
- `docs/specs/angle-archetypes.md` — bank of 25 archetypes.
- `docs/specs/content-types-allowed.md` — the no-fabrication rule.
- `docs/specs/founder-review-flow.md` — the CRM flow that consumes this pipeline's output.
- `docs/data-model.md` — schema reference.
- `docs/adr/0010-no-fabrication-content-rule.md` through `0013-trending-deferred-to-phase-2.md` — architectural decisions encoded here.
- `supabase/migrations/0005_framework_seed_and_history.sql` — V2 schema (already shipped).
- `supabase/migrations/0006_ai_analysis_jobs.sql` — added by this design (Phase 1).
