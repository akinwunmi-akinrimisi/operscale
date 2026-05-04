# Continuation prompt — Operscale Calendar V2 Phase 3 (Tasks 3–17)

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
contains: user profile, current project state (with Phase 3 Tasks 1-2
shipped + Tasks 3-17 still pending — read project_state.md first), infra
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
  → fix loop. Inline fixes for small surgical edits acceptable when they
  preserve the same review evidence.
- When reviews catch plan-level bugs, fix the code AND the plan file in
  the same commit (memory feedback_plan_keeps_pace_with_code).
- Push to GitHub after each task or every few tasks (don't wait for the
  whole phase) — the prior session pushed Tasks 1-2 incrementally before
  context wall, which kept work safe.
- Minute-cadence updates on long-running work, ALWAYS — failure
  signatures must be in any monitor filter, not just success.

Phase 3 plan file: docs/plans/2026-05-04-v2-phase-3-orchestrator-and-worker.md
Decisions baked into the plan:
  A — VPS deploy via paramiko, narrated commands, stop points before
      destructive steps. /srv/operscale-calendar/docker-compose.yml lives
      ON the VPS not in the repo.
  B — DB tests stay mocked. Real DB exercised by Task 16 manual smoke +
      Task 14 nightly cron + Phase 4 routes.
```

---

## Catch-up section — where the build stands

```
Phase 1 INFRASTRUCTURE: ✅ DEPLOYED LIVE (operscale.cloud, www, api/v1/health
all 200 with Let's Encrypt R13 certs). Brand locked Operscale.

V2 PHASE 1 (selection + bank catalog + 0006 migration): ✅ SHIPPED 2026-05-04
V2 PHASE 2 (4 pure-logic modules + first L2 cassette test): ✅ SHIPPED 2026-05-04
  150/150 tests, $0.50 cassette recording cost, real Opus 4.7 cassette
  committed at apps/agent/test/fixtures/cassettes/initial-fashion-tier-2.json.

V2 PHASE 3 (orchestrator + worker): ⏸️ IN PROGRESS — 2 of 17 tasks shipped.
  Pushed range: b06fa83..e266c7e. Suite at 155/155 passing tests, typecheck
  clean. All commits on main, all pushed to origin/main.

  ✅ Task 1 — Worker compose snippet + deployment.md + security.md
     (incl. fix bundle 04b8400 for setup-script + secrets-inventory gaps).
  ✅ Task 2 — supabase-admin: assertServerSide() at module load (Option B,
     strongest defence-in-depth) + writeActivityLog() best-effort with
     stderr logging on swallowed errors. Three commits: ff1c672 + b775d07
     (Option B fix) + e266c7e (logging fix). 5 unit tests.

  ❌ Tasks 3-17 — STILL TO DO. Per the plan:
    3. claude.ts orchestrator skeleton — createBriefAnalyzer factory.
    4. Re-analysis branches + photo + niche guards.
    5. Retry policy (5x exp backoff on 5xx + 1x validation_failed retry).
    6. llm_calls telemetry try/finally per attempt.
       NOTE: same console.error stderr-log pattern as Task 2's
       writeActivityLog. Plan already updated with this pattern.
    7. Worker entrypoint skeleton — bootstrap, SIGTERM, heartbeat,
       sweep+claim+poll timers (with stubs for downstream tasks).
    8. Stuck-job sweep — status='running' + started_at < now()-5min.
    9. Claim loop — race-safe two-step UPDATE (Supabase JS doesn't
       expose FOR UPDATE SKIP LOCKED).
    10. Photo fetch from customer-photos + customer-logos buckets.
    11. process-job initial trigger — read brief, fetch photos, call
        analyzer, write analysis_runs + UPDATE ai_analysis_jobs.
    12. process-job re-analysis — UPDATE prior is_current=false +
        INSERT new run_index=prior+1.
    13. L2 cassette test extension — assert orchestrator's mocked
        Supabase calls (llm_calls insert + customer_framework_history
        select).
    14. L3 nightly smoke — .github/workflows/nightly-smoke.yml +
        test/smoke/nightly.test.ts. **Manual prereq**: ANTHROPIC_API_KEY
        repo secret must be added in GitHub UI before first cron firing.
    15. Dockerfile update — emit dist/worker.js in runner stage.
    16. VPS staging deploy via paramiko — SCP compose snippet, append
        to /srv/operscale-calendar/docker-compose.yml, create
        /etc/operscale-calendar/worker.env (chmod 600), rebuild image,
        compose up worker, INSERT a test job, verify analysis_runs row.
    17. Close-out — full tests/typecheck/lint/docker, push, memory.
```

---

## First message (paste after the system context)

```
Resume V2 Phase 3 execution from Task 3.

Read MEMORY.md and the latest "V2 Phase 3 — IN PROGRESS" section in
project_state.md to confirm Task 1 (docs) and Task 2 (supabase-admin) are
already shipped at commits b06fa83..e266c7e on origin/main.

Then read docs/plans/2026-05-04-v2-phase-3-orchestrator-and-worker.md from
"## Task 3" onwards. The plan has the full TDD code blocks for every task.

Sanity-check before starting Task 3:
1. `git log --oneline d868a6e..HEAD` — should show 5 commits ending with
   e266c7e.
2. `git status --short` — should be clean.
3. `pnpm --filter @operscale-calendar/agent test` — should be 155/155.
4. `pnpm --filter @operscale-calendar/agent typecheck` — should be clean.

If any sanity check fails, STOP and report — do not proceed to Task 3.

Then execute Tasks 3-17 in order via subagent-driven-development. Per
the prior session's pattern:
- Each task: implementer → spec reviewer → code-quality reviewer → fix
  loop. Use sonnet for routine tasks (Tasks 3, 8, 9, 13, 15) and opus
  for the bigger ones (Tasks 4, 5, 6, 11, 12) if available; sonnet alone
  is fine.
- Inline fixes are acceptable for small surgical edits IF you cite the
  reviewer finding in the commit message.
- "Plan keeps pace with code" — fix the plan file in the same commit
  as the code fix when reviews catch plan-level bugs.
- Push to origin/main every 2-3 tasks instead of waiting for Task 17
  close-out.
- Minute-cadence status updates between every dispatch.

CARRY-FORWARD note for Task 6: same console.error stderr-log pattern as
Task 2 must apply to writeLlmCall in claude.ts. Plan already updated.

CARRY-FORWARD note for Task 14: ANTHROPIC_API_KEY must be added as a
GitHub Actions repo secret BEFORE the first cron fires. The workflow
exits 1 + opens a noisy issue on missing key. Document in the Task 14
commit body that this is a manual one-time step the user does in the
GitHub UI.

CARRY-FORWARD note for Task 16 (VPS deploy):
- Use paramiko, master .env at parent dir reads `server_password`.
- Back up /srv/operscale-calendar/docker-compose.yml BEFORE editing.
- Create /etc/operscale-calendar/worker.env (chmod 600, owned
  docker:docker), populate from master .env keys (ANTHROPIC_API_KEY,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
- After `docker compose up -d --force-recreate worker`, INSERT a test
  job into ai_analysis_jobs targeting a fixture brief and verify the
  worker processes it (analysis_runs row, llm_calls row, ai_analysis_jobs
  status='completed'). Plan Task 16 has the full SQL.
- DELETE the test rows when done.

NEVER:
- Commit or push any .env file or secret-shaped string.
- Use git --no-verify (pre-commit hook is the safety net).
- Inline a key in any code/config/docs/workflow file.
- Skip the master .env's parent-dir location convention.
- Echo or log any secret value during paramiko sessions.

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

# Local test + typecheck
pnpm --filter @operscale-calendar/agent test
pnpm --filter @operscale-calendar/agent typecheck

# Re-record the L2 cassette (only if a Phase 2 module changes)
pnpm --filter @operscale-calendar/agent test:claude:live initial-fashion-tier-2

# Phase 3 commits so far
git log --oneline d868a6e..HEAD

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

## Don'ts (carry-forward from prior sessions, REINFORCED)

- DON'T commit or push secrets — the repo is public, one mistake is permanent.
- DON'T use `git --no-verify` to bypass the pre-commit hook.
- DON'T add `.env` files to the repo — they live at the parent dir only.
- DON'T inline keys in code, config, docs, or GitHub Actions workflows.
- DON'T echo or log secret values (paramiko session output, npm script output, test output) — sanitize before printing.
- DON'T put GET handlers on webhook URLs (405 is correct REST).
- DON'T add Cloudflare proxy to api.operscale.cloud (DNS-only required for raw-body HMAC).
- DON'T skip brainstorming/writing-plans before non-trivial code work.
- DON'T fix code-review findings without also updating the plan file in the same commit.
- DON'T go silent on long-running work — minute-cadence updates, every dispatch, every commit.
- DON'T run ALTER DATABASE as 'postgres' user — switch to 'supabase_admin'.
- DON'T re-record the L2 cassette unless a Phase 2 module's behaviour actually changed (cassette stability is the test's value).
- DON'T pause mid-task without committing — every commit on main is a recovery point.
