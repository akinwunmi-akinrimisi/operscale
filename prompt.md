# Continuation prompt — Operscale Calendar V2 Phase 4.5 (Paystack + Resend on approve)

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
  Contains: server_password (paramiko SSH), ANTHROPIC_API_KEY, Paystack
  test keys (PAYSTACK_SECRET_KEY=sk_test_..., PAYSTACK_PUBLIC_KEY=pk_test_...),
  RESEND_API_KEY + RESEND_SENDER, JWT_SECRET (HS256 founder JWT mint),
  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, EVOLUTION_*.
- When code/scripts need keys, they READ from process.env (loaded from the
  master .env at the parent dir at runtime, never bundled). Never inline,
  never echo, never log.

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\
contains: user profile, current project state (V2 Phases 1-4 ✅ COMPLETE
2026-05-05; next is Phase 4.5), infra connection points (VPS, Supabase,
Evolution, container names + working SSH/psql patterns), collaboration
style (execute over discuss), no-shortcut discipline (never disable/mock/
fallback — verify with real calls), progress cadence (minute-by-minute
updates on long-running work; Monitor filter covers failure signatures
not just success), and "plan keeps pace with code" (fix plan file in the
same commit as the code when reviews catch bugs that originated in the
plan). Read MEMORY.md first.

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

CRITICAL build-discipline carry-forwards from prior sessions:
- All relative imports inside apps/agent/src/lib/ and apps/agent/src/worker/
  that the build:worker (tsc NodeNext emit) compiles MUST include explicit
  .js extensions. The @/ path alias does NOT survive tsc emit. Use
  relative paths like '../lib/supabase-admin.js'. Routes (next build) can
  use the @/ alias — only worker code is restricted.
- tsconfig.worker.json uses module: NodeNext / moduleResolution: NodeNext
  — do NOT switch to bundler/ESNext, runtime requires NodeNext.
- briefs schema is form_payload jsonb (NOT flat columns). Reads project
  via row.tier_intent + row.form_payload.* (see process-job's
  projectBriefRowToAnalyzerInput).
- analysis_runs.model is NOT NULL — every INSERT must include
  model: CLAUDE_MODEL.
- writeLlmCall and writeActivityLog are best-effort (swallow + stderr
  log; never throw on telemetry failure) — preserve in any new helper.

PHASE 4 IS LIVE (2026-05-05):
- /v1/brief/analyze → 202 + {job_id, status, idempotency_key}. Worker
  picks up the job, analyzes via real Claude, writes analysis_runs.
- /v1/brief/approve → 200 + {framework_history_rows_written}. Writes N
  customer_framework_history rows + flips orders.status to 'founder_approved'.
- Migration 0007 added 'founder_approved' + 'brief_email_failed' to the
  orders.status CHECK constraint.
- Smoke verified end-to-end: 7 pairs analyzed, 7 history rows, order
  founder_approved, zero leftovers after cleanup. Cost ~$0.86 per run.
```

---

## Catch-up section — where the build stands

```
Phase 1 INFRASTRUCTURE: ✅ DEPLOYED LIVE (operscale.cloud, www, api/v1/health
all 200 with Let's Encrypt R13 certs). Brand locked Operscale.

V2 PHASE 1 (selection + bank catalog + 0006 migration): ✅ SHIPPED 2026-05-04
V2 PHASE 2 (4 pure-logic modules + first L2 cassette test): ✅ SHIPPED 2026-05-04
V2 PHASE 3 (orchestrator + worker container LIVE): ✅ COMPLETE 2026-05-05
V2 PHASE 4 (route wiring — analyze + approve): ✅ COMPLETE 2026-05-05

  Phase 4 commits range: 175f8f3 → 6bb4bc0 + close-out commit.
  Suite at 212/212 passing tests, typecheck + build:worker clean. All
  commits on main, all pushed to origin/main.

  ✅ Task 1 — verify-jwt helper (header parser, no sig check) [175f8f3]
  ✅ Task 2 — idempotency-key helper [037285f]
  ✅ Task 3 — /v1/brief/analyze cutover from 501 stub [1766be9]
  ✅ Task 4 — /v1/brief/approve framework-history + status flip [6bb4bc0]
     + migration 0007_orders_founder_approved_status.sql
  ✅ Task 5 — live staging smoke (7 pairs, 7 history rows, zero leftovers)
  ✅ Task 6 — close-out (plan + memory + prompt.md updated)

  Plan-vs-code drifts caught and fixed in lockstep this session:
   - customer_framework_history PK is (customer_id, framework_slot, archetype_slot),
     NOT (customer_id, order_id, framework_slot, archetype_slot) per Decision C.
     Plan Step 1 of Task 4 corrected; route INSERT shape unchanged.
   - orders.status CHECK in 0001 lacked 'founder_approved' / 'brief_email_failed';
     migration 0007 added them. Forward-only.
   - APPROVABLE_STATUSES uses singular 'brief_email_failed' (AGENT.md §244),
     not 'briefs_email_failed' (plan typo).

  ❌ Phase 4.5 — STILL TO DO. Carry-forwards:
    - Paystack /v1/payment/initialize integration on approve. Currently
      /approve stops at status='founder_approved', no payment URL is
      generated. Phase 4.5 must: (a) call Paystack /transaction/initialize
      with NGN amount + customer email + metadata{order_id, brief_id},
      (b) store paystack_tx_ref on the order, (c) email the customer the
      brief + payment link via Resend, (d) flip status to 'brief_sent'
      (or 'brief_email_failed' on Resend error).
    - Resend brief email render + send. Email template TBD — likely
      apps/agent/src/lib/email-templates/brief-approved.tsx using React
      Email (Resend's recommended pattern). Brand placeholders <brand-name>
      no longer needed (brand locked Operscale).
    - Paystack webhook handler — /v1/webhook/paystack route (separate from
      Phase 4 scope). HMAC-SHA512 signature verification on raw body.
      Idempotency on paystack_event_id (already a unique column on
      payments table per 0001).
    - Realtime CRM "pipeline health" panel data wiring (post-Resend, the
      founder needs to see send status update live via Supabase Realtime).
    - Worker container scaling (replicas > 1). Currently 1 replica;
      two-step UPDATE claim is YAGNI for replicas=1. FOR UPDATE SKIP
      LOCKED RPC migration would be needed at replicas≥2.
    - LISTEN/NOTIFY upgrade to push-based queue pickup (currently 5s
      poll interval).
```

---

## First message (paste after the system context)

```
Begin V2 Phase 4.5 with brainstorming.

Read MEMORY.md and the latest "V2 Phase 4 — ✅ COMPLETE 2026-05-05" section
in project_state.md to confirm Phase 4 routes are live and what carry-forwards
exist for Phase 4.5.

Sanity-check before starting Phase 4.5:
1. `git log --oneline 175f8f3..HEAD` — should show ~5 commits ending with
   the Task 6 close-out (whatever it ended up being titled).
2. `git status --short` — should be clean.
3. `npm --prefix apps/agent test` — should be 212/212 passing (3 nightly
   skipped).
4. `npm --prefix apps/agent run typecheck` — clean.
5. `npm --prefix apps/agent run build:worker` — clean.
6. POST a bogus body to https://api.operscale.cloud/v1/brief/analyze with
   no Authorization header → should get 401, NOT 501. Same for /approve.

If any sanity check fails, STOP and report — do not proceed.

Then run brainstorming for Phase 4.5 to settle these decision points
BEFORE writing the plan:
- A — Email template engine: React Email (Resend native) vs MJML vs raw
  HTML strings. React Email is the obvious default; the question is
  whether to add @react-email/components as a dep.
- B — Paystack callback strategy: webhook-only vs callback URL + webhook
  fallback. Webhook-only is simpler; callback URL adds UX (browser
  redirect on success) but doubles the integration points.
- C — Failure ordering inside /approve: Paystack initialize first then
  Resend send, OR Resend first then Paystack. Decision affects rollback:
  if Paystack succeeds and Resend fails, the customer gets a payment
  link but no brief — bad. So Resend first, Paystack second. But what
  if the order is to be marked as paystack_init_failed, do we send the
  email anyway?
- D — Synchronous vs queued email: Send Resend email synchronously inside
  /approve, OR enqueue an email_jobs row that a worker processes (mirrors
  ai_analysis_jobs pattern). Synchronous is simpler for Phase 4.5; queue
  is a future-proofing call.
- E — Schema additions: New columns on orders for paystack_tx_ref (already
  there + unique), paystack_authorization (already there). Probably nothing
  net-new. Confirm by re-reading 0001 + 0007.
- F — Webhook handler timing: Phase 4.5 vs Phase 4.6 (separate plan).
  Webhook is what flips status from 'payment_initiated' → 'paid' on
  successful charge. If Phase 4.5 ships /approve without a webhook, the
  CRM has no way to see paid status. Recommend: include webhook in 4.5.

After brainstorming, write a Phase 4.5 plan (writing-plans skill) at
docs/plans/2026-05-XX-v2-phase-4-5-paystack-resend.md, then execute task
by task via subagent-driven-development.

CARRY-FORWARD discipline (DO NOT VIOLATE):
- All NEW relative imports in apps/agent/src/lib/ and apps/agent/src/worker/
  must include .js extensions. Routes under apps/agent/src/app/ can use
  @/ — Next.js handles that. Run `npm run build:worker` after every task
  to confirm runtime compatibility.
- briefs schema is form_payload jsonb (NOT flat). Use row.tier_intent +
  row.form_payload.* — see worker/process-job's projectBriefRowToAnalyzerInput.
- analysis_runs.model is NOT NULL — every INSERT includes model:CLAUDE_MODEL.
- writeLlmCall and writeActivityLog use stderr console.error on swallowed
  errors — preserve in any new telemetry helper.
- Logger.error on terminal failure paths (Task 5 review fix pattern from
  Phase 3) — preserve in any new failure return.
- verifyJwt does NOT verify signature — that's deliberate. Real auth
  happens at the Supabase service-role layer downstream. Don't add
  signature checks unless an adversary model emerges that requires it.
- Paystack webhook signature is HMAC-SHA512 on the RAW body (not parsed).
  Next.js route handlers must read req.text() not req.json() before HMAC.

NEVER:
- Commit or push any .env file or secret-shaped string.
- Use git --no-verify (pre-commit hook is the safety net).
- Inline a key in any code/config/docs/workflow file.
- Skip the master .env's parent-dir location convention.
- Echo or log any secret value during paramiko sessions.
- Switch tsconfig.worker.json away from NodeNext.
- Use the @/ path alias in worker code.
- Hit Paystack live mode — test mode keys are in the master .env
  (PAYSTACK_SECRET_KEY=sk_test_..., PAYSTACK_PUBLIC_KEY=pk_test_...).

When stopping (context limit, user pause, or after Phase 4.5 ships),
update memory's project_state.md with the shipped commit range and rewrite
prompt.md for the next session — same pattern as this handoff.
```

---

## Useful one-liners

```bash
# Live stack health (external)
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/

# Verify Phase 4 routes are live (should return 401 not 501)
curl -X POST https://api.operscale.cloud/v1/brief/analyze \
  -H 'content-type: application/json' -d '{}'

# Local test + typecheck + worker build (run from apps/agent)
npm test
npm run typecheck
npm run build:worker

# Re-run the Phase 4 staging smoke (paramiko + python urllib)
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-smoke.py

# Re-record the L2 cassette (only if a Phase 2 module changes)
npm run --prefix apps/agent test:claude:live initial-fashion-tier-2

# Tail the agent + worker on VPS (paramiko)
PYTHONIOENCODING=utf-8 python -c "
import paramiko
with open(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
_, out, _ = c.exec_command('docker logs --tail=50 operscale-calendar-agent 2>&1 | tail -50', timeout=30)
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
- DON'T hit Paystack live mode in any Phase 4.5 work — test keys only.
- DON'T parse the Paystack webhook body before HMAC verification — HMAC is on the raw bytes.
