# Continuation prompt — Operscale Calendar V2 Phase 3 (Tasks 12–17)

Paste the **system context** + **first message** into a fresh Claude Code session. Memory auto-loads from `C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\MEMORY.md`.

---

## System context (paste once at the start)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

This is the Operscale Calendar Platform V2 build. Read CLAUDE.md and AGENT.md
before doing anything substantial. The repo is a PUBLIC GitHub repo at
github.com/akinwunmi-akinrimisi/operscale.git — secrets must never be
committed. Pre-commit hook + CI workflow already enforce this; read
scripts/git-hooks/pre-commit and .github/workflows/ to confirm if needed.

NON-NEGOTIABLE: NO API KEYS OR SECRETS COMMITTED OR PUSHED, EVER.
- .env files are gitignored. NEVER add them to the repo.
- Pre-commit hook blocks .env files + secret-shaped strings + files >5MB.
- The master .env is at the PARENT dir (one level above the repo):
  C:\Users\DELL\Documents\Antigravity\operscale-calender\.env
  It contains the SSH password for the VPS, ANTHROPIC_API_KEY, Paystack test
  keys, Resend, Evolution, and the server_password used for paramiko SSH.
- When code/scripts need keys, they READ from process.env (loaded from the
  master .env at the parent dir at runtime, never bundled). Never inline,
  never echo, never log.

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\
contains: user profile, current project state (with Phase 3 Tasks 1-11
shipped + Tasks 12-17 still pending — read project_state.md first), infra
connection points, collaboration style, no-shortcut discipline, minute-cadence
progress preference, and the "plan keeps pace with code" feedback pattern.
Read MEMORY.md first.

For any SSH/paramiko operation, use Python paramiko with PYTHONIOENCODING=utf-8.
Container postgres user is 'postgres'; ALTER DATABASE-level commands need
'supabase_admin'.

Working pattern from prior sessions:
- Direct commits to main (no feature branches).
- Subagent-driven development for plan execution (writing-plans →
  subagent-driven-development).
- Each task: implementer subagent → spec reviewer → code-quality reviewer
  → fix loop. Inline reviews acceptable for small mechanical tasks; full
  two-stage review required for non-trivial ones.
- When reviews catch plan-level bugs, fix the code AND the plan file in
  the same commit (memory feedback_plan_keeps_pace_with_code).
- Push to GitHub after each task or every few tasks (don't wait for the
  whole phase) — every commit on main is a recovery point.
- Minute-cadence updates on long-running work, ALWAYS — failure
  signatures must be in any monitor filter, not just success.

Phase 3 plan file: docs/plans/2026-05-04-v2-phase-3-orchestrator-and-worker.md
Decisions baked into the plan:
  A — VPS deploy via paramiko, narrated commands, stop points before
      destructive steps. /srv/operscale-calendar/docker-compose.yml lives
      ON the VPS not in the repo.
  B — DB tests stay mocked. Real DB exercised by Task 16 manual smoke +
      Task 14 nightly cron + Phase 4 routes.

CRITICAL build-discipline carry-forwards from prior sessions:
  - All relative imports inside apps/agent/src/lib/ and apps/agent/src/worker/
    that the build:worker (tsc NodeNext emit) compiles MUST include explicit
    .js extensions. The @/ path alias does NOT survive tsc emit. Use
    relative paths like '../lib/supabase-admin.js'. Existing lib files were
    fixed during Task 7's CRITICAL bundle (commit c37adc7).
  - tsconfig.worker.json uses module: NodeNext / moduleResolution: NodeNext
    — do NOT switch to bundler/ESNext, runtime requires NodeNext.
  - Worker's main() detection uses pathToFileURL(process.argv[1]).href — do
    NOT replace with hand-rolled URL strings (Linux slash-counting bug).
  - briefs table uses form_payload jsonb (NOT flat columns). The Task 11
    projector reads row.tier_intent + row.form_payload.* — Task 12 inherits
    this pattern.
  - analysis_runs.model is NOT NULL — every INSERT must include
    model: CLAUDE_MODEL.
  - briefs.logo_storage_path / logo_mime_type columns do NOT exist; logo
    fetch is currently skipped (path a). When migration 0007 adds those
    columns, restore the briefs query in fetchBriefPhotos.
```

---

## Catch-up section — where the build stands

```
Phase 1 INFRASTRUCTURE: ✅ DEPLOYED LIVE (operscale.cloud, www, api/v1/health
all 200 with Let's Encrypt R13 certs). Brand locked Operscale.

V2 PHASE 1 (selection + bank catalog + 0006 migration): ✅ SHIPPED 2026-05-04
V2 PHASE 2 (4 pure-logic modules + first L2 cassette test): ✅ SHIPPED 2026-05-04
V2 PHASE 3 (orchestrator + worker): ⏸️ IN PROGRESS — 11 of 17 tasks shipped.

  Pushed range this session: 82fda0b..e11bd2f. Suite at 183/183 passing
  tests, typecheck clean, build:worker clean. All commits on main, all
  pushed to origin/main.

  ✅ Task 3 — orchestrator skeleton (createBriefAnalyzer factory)
     [82fda0b + review fix 223e091]
  ✅ Task 4 — re-analysis branches + photo + niche guards [7953e21]
  ✅ Task 5 — retry policy (5x exp backoff + 1x validation retry)
     [e81e4fe + review fix da2d160]
  ✅ Task 6 — llm_calls telemetry try/finally per attempt [0e6af0c]
  ✅ Task 7 — worker entrypoint + tsconfig.worker.json + 3 timers
     [7ca44df + CRITICAL fix c37adc7 (.js extensions across 7 lib files
     + pathToFileURL + NodeNext)]
  ✅ Task 8 — stuck-job sweep [7010b34]
  ✅ Task 9 — claim loop (race-safe two-step UPDATE) [ddaba9f]
  ✅ Task 10 — photo fetch (logo skipped — schema columns missing) [a88fd5e]
  ✅ Task 11 — process-job INITIAL trigger [e11bd2f]

  Plan-vs-code drifts caught and fixed in lockstep this session:
   - History-fetch swallow → throw on error (no-shortcut, Task 3 fix bundle).
   - _validated mutation stash → proper validatedAi var (Task 5 fix bundle).
   - Terminal-failure logger.error calls (Task 5 fix bundle).
   - Worker NodeNext/.js-extension/pathToFileURL CRITICAL (Task 7 fix bundle).
   - Sweep + claim throw-on-error (Tasks 8 + 9, plan in sync).
   - Logo schema decision (path a) recorded in plan + code (Task 10).
   - briefs form_payload + tier_intent + analysis_runs.model schema note
     (Task 11, plan SCHEMA NOTE added).

  ❌ Tasks 12-17 — STILL TO DO. Per the plan:
    12. process-job RE-ANALYSIS trigger flow — re-uses the form_payload
        projector + photo fetch + analyzer.analyze pattern from Task 11.
        UPDATE prior analysis_runs WHERE brief_id=X AND is_current=true
        SET is_current=false. INSERT new run with run_index=prior+1,
        trigger_type=re_analyze_*, is_current=true. Then UPDATE
        ai_analysis_jobs status=completed + resulting_run_id. Tests cover
        both same_frameworks (priorSeed reuse) and new_frameworks (priorSeed
        exclusion) branches.
    13. L2 cassette test extension — assert the orchestrator's mocked
        Supabase calls (llm_calls insert + customer_framework_history
        select). Modify test/integration/initial-fashion-tier-2.test.ts.
    14. L3 nightly smoke — .github/workflows/nightly-smoke.yml +
        test/smoke/nightly.test.ts. **Manual prereq**: ANTHROPIC_API_KEY
        repo secret must be added in GitHub UI before first cron firing.
        Workflow exits 1 + opens a noisy issue on missing key — document
        this in the Task 14 commit body.
    15. Dockerfile update — emit dist/worker/index.js in runner stage so the
        compose service from Task 1 actually finds the binary. Verify
        node dist/worker/index.js boots and errors gracefully on missing
        env (already verified locally during Task 7 fix bundle, but the
        Docker image stage may need adjusting).
    16. VPS staging deploy via paramiko — SCP compose snippet, append
        to /srv/operscale-calendar/docker-compose.yml, create
        /etc/operscale-calendar/worker.env (chmod 600), rebuild image,
        compose up worker, INSERT a test job, verify analysis_runs row.
        Master .env at parent dir provides server_password.
    17. Close-out — full tests/typecheck/lint/docker, push, memory.
```

---

## First message (paste after the system context)

```
Resume V2 Phase 3 execution from Task 12.

Read MEMORY.md and the latest "V2 Phase 3 — IN PROGRESS, paused after
Task 11 of 17 — 2026-05-05" section in project_state.md to confirm
Tasks 1-11 are already shipped at commits b06fa83..e11bd2f on origin/main.

Then read docs/plans/2026-05-04-v2-phase-3-orchestrator-and-worker.md
from "## Task 12" onwards. The plan has full TDD code blocks for every
task. Note Task 11's SCHEMA NOTE near its top — Task 12 inherits the
form_payload + tier_intent + model: CLAUDE_MODEL pattern from Task 11.

Sanity-check before starting Task 12:
1. `git log --oneline 0e6af0c..HEAD` — should show 6 commits ending with
   e11bd2f (Tasks 7-fix + 8 + 9 + 10 + 11 + plan-update for Task 11).
2. `git status --short` — should be clean.
3. `pnpm --filter @operscale-calendar/agent test` — should be 183/183.
4. `pnpm --filter @operscale-calendar/agent typecheck` — clean.
5. `pnpm --filter @operscale-calendar/agent build:worker` — clean.
6. `node apps/agent/dist/worker/index.js` — should error with
   "SUPABASE_URL not set" (env guard; NOT ERR_MODULE_NOT_FOUND).

If any sanity check fails, STOP and report — do not proceed.

Then execute Tasks 12-17 in order via subagent-driven-development:
- Each task: implementer subagent → spec reviewer → code-quality reviewer
  → fix loop. Inline reviews acceptable for small mechanical tasks (12 is
  medium, 13/15 small, 14 medium, 16 LARGE).
- For Task 12: form_payload pattern carries from Task 11.
  apps/agent/src/worker/process-job.ts already exists — modify to add
  re-analysis branches inside processJob. The trigger_type is already
  on ClaimedJob; switch on it to choose initial vs re-analysis flow.
- For Task 14: ANTHROPIC_API_KEY repo secret is a manual GitHub UI step
  the user does — document prominently in commit body.
- For Task 16: VPS deploy — narrate every paramiko command, ALWAYS back
  up before editing docker-compose.yml on the VPS, never echo secret
  values, INSERT test job + verify analysis_runs row + DELETE test rows
  before declaring success.
- "Plan keeps pace with code" — fix the plan file in the same commit
  as the code fix when reviews catch plan-level bugs.
- Push to origin/main every 2-3 tasks instead of waiting for Task 17.
- Minute-cadence status updates between every dispatch.

CARRY-FORWARD discipline (DO NOT VIOLATE):
- All new relative imports in apps/agent/src/lib/ and apps/agent/src/worker/
  must include .js extensions. Run `pnpm build:worker` after every task
  to confirm runtime compatibility.
- briefs schema is form_payload jsonb (NOT flat). Use row.tier_intent +
  row.form_payload.* — see Task 11's projectBriefRowToAnalyzerInput.
- analysis_runs.model is NOT NULL — INSERT must include model:CLAUDE_MODEL.
- writeLlmCall and writeActivityLog use stderr console.error on swallowed
  errors (Task 2 + Task 6 pattern) — preserve in any new helper.
- Logger.error on terminal failure paths (Task 5 review fix pattern) —
  preserve in any new failure return.

NEVER:
- Commit or push any .env file or secret-shaped string.
- Use git --no-verify (pre-commit hook is the safety net).
- Inline a key in any code/config/docs/workflow file.
- Skip the master .env's parent-dir location convention.
- Echo or log any secret value during paramiko sessions.
- Switch tsconfig.worker.json away from NodeNext.
- Use the @/ path alias in worker code.

When stopping (context limit, user pause, or after Task 17), update
memory's project_state.md with the shipped commit range and rewrite
prompt.md for the next session — same pattern as this handoff.
```

---

## Useful one-liners

```bash
# Live stack health (external)
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/

# Local test + typecheck + worker build
pnpm --filter @operscale-calendar/agent test
pnpm --filter @operscale-calendar/agent typecheck
pnpm --filter @operscale-calendar/agent build:worker
node apps/agent/dist/worker/index.js   # should error on env, NOT ERR_MODULE_NOT_FOUND

# Re-record the L2 cassette (only if a Phase 2 module changes)
pnpm --filter @operscale-calendar/agent test:claude:live initial-fashion-tier-2

# This session's commits
git log --oneline e266c7e..HEAD

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

# Current branch state
git log --oneline -5
git status --short
```

---

## Don'ts (carry-forward, REINFORCED)

- DON'T commit or push secrets — the repo is public, one mistake is permanent.
- DON'T use `git --no-verify` to bypass the pre-commit hook.
- DON'T add `.env` files to the repo — they live at the parent dir only.
- DON'T inline keys in code, config, docs, or GitHub Actions workflows.
- DON'T echo or log secret values (paramiko session output, npm script output, test output) — sanitize before printing.
- DON'T switch tsconfig.worker.json from NodeNext to bundler/ESNext — runtime requires NodeNext.
- DON'T introduce relative imports without `.js` extensions inside `apps/agent/src/lib/` or `apps/agent/src/worker/`.
- DON'T use the `@/` path alias in worker code — tsc emit doesn't rewrite it.
- DON'T treat `briefs` as a flat-column table — form_payload jsonb is the source of truth.
- DON'T omit `model: CLAUDE_MODEL` from any analysis_runs INSERT — column is NOT NULL.
- DON'T put GET handlers on webhook URLs (405 is correct REST).
- DON'T add Cloudflare proxy to api.operscale.cloud (DNS-only required for raw-body HMAC).
- DON'T skip brainstorming/writing-plans before non-trivial code work.
- DON'T fix code-review findings without also updating the plan file in the same commit.
- DON'T go silent on long-running work — minute-cadence updates, every dispatch, every commit.
- DON'T run ALTER DATABASE as 'postgres' user — switch to 'supabase_admin'.
- DON'T re-record the L2 cassette unless a Phase 2 module's behaviour actually changed (cassette stability is the test's value).
- DON'T pause mid-task without committing — every commit on main is a recovery point.
