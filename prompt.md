# Continuation prompt — Operscale Calendar V2 Phase 2

Paste the **system context** + **first message** into a fresh Claude Code session. Memory auto-loads from `C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\MEMORY.md`.

---

## System context (paste once at the start)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

This is the Operscale Calendar Platform V2 build. Read CLAUDE.md and AGENT.md
before doing anything substantial. The repo is a public GitHub repo at
github.com/akinwunmi-akinrimisi/operscale.git — secrets must never be committed.
Pre-commit hook + CI workflow already enforce this.

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\
contains: user profile, current project state, infra connection points,
collaboration style, no-shortcut discipline, minute-cadence progress
preference, and the "plan keeps pace with code" feedback pattern. Read
MEMORY.md first.

Master .env (gitignored) is at the parent dir:
C:\Users\DELL\Documents\Antigravity\operscale-calender\.env
It contains the SSH password for the VPS, all API keys (Anthropic, Paystack
test, Resend, Evolution), and the locked brand values.

For any SSH operation, use Python paramiko with PYTHONIOENCODING=utf-8.
The container postgres user is 'postgres' but ALTER DATABASE-level commands
need 'supabase_admin' (the actual superuser).

Working pattern from prior sessions:
- Direct commits to main (no feature branches)
- Subagent-driven development for plan execution (writing-plans → subagent-driven-development)
- Each task: implementer subagent → spec reviewer → code quality reviewer → fix loop
- When reviews catch plan-level bugs, fix the code AND the plan file in the same commit
- Push to GitHub after each task; deploy to VPS only when phase work is complete
```

---

## Catch-up section — where the build stands as of 2026-05-04

```
Phase 1 INFRASTRUCTURE: ✅ DEPLOYED LIVE
  - https://operscale.cloud/, www.operscale.cloud/, api.operscale.cloud/v1/health
    all return 200 with valid Let's Encrypt R13 certs
  - Brand locked to Operscale / operscale.cloud (Day 1 of build)
  - Schema migrations 0001-0006 applied to staging Supabase
  - Evolution WhatsApp instance "operscale-calendar" paired (+2348165799032)
  - Two operscale-calendar-{web,agent} containers live on srv1297445

V2 PHASE 1 (selection + bank catalog + 0006 migration): ✅ SHIPPED 2026-05-04
  16 commits 005b373 → 80b2851, all on main, all pushed.
  Deliverables:
    - apps/agent/vitest.config.ts (Vitest harness, cross-platform alias)
    - apps/agent/src/lib/types/v2.ts (FRAMEWORK_SLOTS, ARCHETYPE_SLOTS,
      NICHE_SLUGS, TIER_COUNTS with carousel_count 3/7/14, AFFINITY_SCORES,
      AiOutput, SupersetOutput, Violation, plus 13 nested type aliases)
    - HTML-comment slot frontmatter on all 25 frameworks + 25 archetypes
      in docs/specs/script-frameworks.md and docs/specs/angle-archetypes.md
    - apps/agent/src/lib/bank-catalog.ts (loadNicheBrief, parseFrameworksFile,
      parseArchetypesFile, loadBankCatalog, BankCatalogIncompleteError;
      handles CRLF spec files, parenthetical headings, niche filename map)
    - apps/agent/src/lib/framework-selector.ts (computeSeedHash,
      computeReanalyzeSeedHash, sortPairsByAffinityAndSeed,
      selectPairsFromSorted with LRU fallback, selectFrameworksForBrief
      top-level entry with re-analyze same/new branches)
    - supabase/migrations/0006_ai_analysis_jobs.sql (applied + verified;
      constraint trigger correctly rejects re_analyze_* without founder_note)
    - 46 unit + integration tests pass; typecheck clean

  Plan file at docs/plans/2026-05-04-v2-phase-1-selection-and-bank-catalog.md
  is updated to reflect every fix that went into Phase 1, so it stays
  consistent for re-execution.

V2 PHASE 2 (pure pipeline modules): ❌ NOT STARTED
  Per docs/specs/v2-pipeline-implementation-design.md §9 Phase 2:
    - apps/agent/src/lib/prompt-builder.ts (renders Layer 1/2/3/4 templates
      verbatim from ai-brief-analysis.md §3, vision blocks, edit-diff for
      re-analysis, niche brief + bank excerpts via the Phase-1 catalog)
    - apps/agent/src/lib/output-validator.ts (zod schema for AiOutput,
      slot-count check, selection-list-membership check)
    - apps/agent/src/lib/fabrication-audit.ts (regex sweep over calendar_plan
      strings per ai-brief-analysis.md §8 forbidden phrases)
    - apps/agent/src/lib/post-processor.ts (derives brief_summary,
      upsell_recommendation, estimated_brief_quality_score for the CRM)
    - First L2 cassette-replay integration tests (record one real Claude
      response with `pnpm test:claude:live` and commit cassette JSON)

  All Phase 2 modules are PURE LOGIC — no live route changes, no Claude
  integration in production code paths yet. Phase 3 wires the orchestrator
  + worker container; Phase 4 wires the routes.

V2 PHASES 3-4: ❌ NOT STARTED, will need their own writing-plans passes
  - Phase 3: claude.ts orchestrator (rewrites the current stub) +
    worker/index.ts entrypoint + second compose service operscale-calendar-worker
    + lib/supabase-admin.ts service-role assertion
  - Phase 4: route wiring — analyze enqueue + approve customer_framework_history
    transactional write
```

---

## First message — pick ONE continuation

### Option A — Plan + execute V2 Phase 2 via subagent-driven development

```
V2 Phase 1 is shipped and live. Time to execute Phase 2 of the V2 pipeline.

Read docs/specs/v2-pipeline-implementation-design.md §9 Phase 2 for the deliverables list, then:

1. Invoke superpowers:writing-plans to create
   docs/plans/2026-05-DD-v2-phase-2-pure-pipeline-modules.md following the
   same structure as the Phase 1 plan
   (docs/plans/2026-05-04-v2-phase-1-selection-and-bank-catalog.md).
   Each module gets its own task with TDD steps + failing test → impl → passing
   test → commit.

   Special considerations for Phase 2:
   - prompt-builder must consume the Phase 1 BankCatalog output unchanged
   - output-validator must use the Phase 1 v2.ts AiOutput type as the
     authoritative shape — write zod schemas that mirror it, don't redefine
   - fabrication-audit's regex list comes verbatim from
     docs/specs/ai-brief-analysis.md §8 (Application-side regex sweep)
   - post-processor's derivation rules per Q1 of the design doc
   - Reserve a task for the first cassette-replay integration test that
     exercises the full Phase-2 + Phase-1 wiring against a recorded
     Claude response — this is the first L2 test in the testing pyramid

2. Once the plan is approved, invoke superpowers:subagent-driven-development
   and execute task-by-task.

The subagent budget pattern from Phase 1: most tasks consumed one implementer
+ one spec reviewer + occasionally one code-quality reviewer. Cassette
recording will need a real ANTHROPIC_API_KEY — pull from the master .env at
the parent dir.

Work direct on main per project pattern. Push after each task.
Update memory's project_state.md with shipped commits at the end.
```

### Option B — Pause, audit, fix anything that drifted

```
Before starting Phase 2, audit the Phase 1 work for any drift between docs
and code:

1. Run `pnpm --filter @operscale-calendar/agent test` — all 46 should pass
2. Run `pnpm --filter @operscale-calendar/agent typecheck` — clean
3. Verify the 0006 migration is still applied on staging Supabase
4. Verify the production stack is still healthy:
     curl -sI https://api.operscale.cloud/v1/health
     curl -sI https://operscale.cloud/
5. Read the latest 16 commits to check for surprises that landed since
   Phase 1 close-out
6. Read the design doc + Phase 1 plan to spot any items the spec promised
   but the code hasn't delivered

Only after the audit, decide whether Phase 2 starts immediately or
whether a small Phase 1.5 fixup is needed first.
```

### Option C — Fresh direction, you describe the goal

```
V2 Phase 1 is done. Read MEMORY.md and prompt.md in the working
directory, then ask me what's next.
```

---

## Useful one-liners

```bash
# Live stack health (external)
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/

# Local test + typecheck
pnpm --filter @operscale-calendar/agent test
pnpm --filter @operscale-calendar/agent typecheck

# Verify 0006 migration on staging Supabase (uses paramiko + .env password)
PYTHONIOENCODING=utf-8 python -c "
import paramiko
with open(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
_, out, _ = c.exec_command(\"docker exec supabase-db-1 psql -U postgres -d postgres -c '\\\d ai_analysis_jobs'\", timeout=30)
print(out.read().decode())
c.close()
"

# Most recent Phase 1 commit range
git log --oneline 16b64d3..80b2851

# Current branch state
git log --oneline -5
git status --short
```

---

## Don'ts (carry-forward from prior sessions)

- Don't naively overwrite docs from external migrations — selective apply + brand-relock
- Don't commit `.env`, `evolution-*-qr.png`, or anything secret-shaped
- Don't run `ALTER DATABASE` as `postgres` user — switch to `supabase_admin`
- Don't put GET handlers on webhook URLs — 405 is correct REST
- Don't add Cloudflare proxy to `api.operscale.cloud` — DNS-only required for raw-body HMAC
- Don't skip brainstorming/writing-plans before non-trivial code work
- Don't fix code-review findings without also updating the plan file in the same commit
- Don't go silent on long-running work — minute-cadence updates per the memory rule
