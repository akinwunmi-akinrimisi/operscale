# Continuation prompt — Operscale Calendar V2 Phase 4.6 (Paystack webhook + payment-confirmation email)

Paste the **system context** + **first message** into a fresh Claude Code session. Memory auto-loads from `C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-Antigravity-operscale-calender\memory\MEMORY.md`.

---

## System context (paste once at the start)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

This is the Operscale Calendar Platform V2 build. Read CLAUDE.md and AGENT.md
before doing anything substantial. The repo is a PUBLIC GitHub repo at
github.com/akinwunmi-akinrimisi/operscale.git — secrets must never be
committed. Pre-commit hook + CI workflow already enforce this.

NON-NEGOTIABLE: NO API KEYS OR SECRETS COMMITTED OR PUSHED, EVER.
- .env files are gitignored; pre-commit hook blocks .env files + secret-
  shaped strings + files >5MB.
- Master .env at parent dir: C:\Users\DELL\Documents\Antigravity\
  operscale-calender\.env. Contains: server_password, ANTHROPIC_API_KEY,
  Paystack test keys (sk_test_*, pk_test_*), RESEND_API_KEY,
  RESEND_SENDER, JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  EVOLUTION_*.
- Code reads from process.env. NEVER inline, echo, or log secret values.

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-
Antigravity-operscale-calender\memory\ contains: user profile, current
project state (V2 Phases 1-4.5 ✅ COMPLETE 2026-05-05; next is Phase 4.6),
infra connection points (VPS, Supabase, Evolution, working SSH/psql
patterns), collaboration style (execute over discuss), no-shortcut
discipline, progress cadence (minute-by-minute updates on long-running
work; Monitor filter MUST cover failure signatures, not just success),
and "plan keeps pace with code" feedback. Read MEMORY.md first.

For SSH/paramiko: PYTHONIOENCODING=utf-8. Container postgres user is
'postgres'; ALTER DATABASE-level commands need 'supabase_admin'.

Working pattern from prior sessions:
- Direct commits to main (no feature branches).
- Subagent-driven development for plan execution (writing-plans →
  subagent-driven-development).
- Each task: implementer subagent → spec reviewer → code-quality
  reviewer → fix loop. Inline reviews acceptable for small mechanical
  tasks; full two-stage review required for non-trivial ones.
- "Plan keeps pace with code" — fix plan file in the SAME commit as
  the code when reviews catch plan-level bugs.
- Push to origin every 2-3 tasks (don't wait for the whole phase).
- Minute-cadence status updates between every dispatch.
- Use `git commit -F C:\tmp\commit-msg.txt` for messages with `#` chars
  (PowerShell heredoc trips on `#` and other expansion chars).

CRITICAL build-discipline carry-forwards from Phase 4.5:
- apps/agent/src/lib/email.ts and snapshot-to-email-props.ts use plain
  relative imports (`./supabase-admin`, `./types/v2`, `./post-processor`)
  — no .js extension and NO @/ alias. They are EXCLUDED from
  tsconfig.worker.json.
- All OTHER files in apps/agent/src/lib/ and apps/agent/src/worker/
  keep .js extensions (NodeNext requirement). build:worker compiles
  these.
- apps/agent AND apps/web next.config.mjs have typescript.
  ignoreBuildErrors=true + eslint.ignoreDuringBuilds=true. CI runs
  tsc --noEmit and next lint as separate gates.
- @react-email/components + @react-email/render are deps of BOTH
  apps/agent and apps/web. Cross-package circular workspace dep is
  known structural fragility — flagged for shared-package extraction
  in Phase 4.5.1.
- VPS rebuild MUST do `git fetch + git reset --hard origin/main` before
  `docker compose build`. The vps-rebuild.py at C:\tmp\vps-rebuild.py
  bakes this in — reuse and extend it.

PHASE 4.5 IS LIVE (2026-05-05):
- /v1/brief/analyze → 202 + {job_id, status, idempotency_key}.
- /v1/brief/approve → 200 + {framework_history_rows_written,
  paystack_tx_ref, brief_email_sent, resend_message_id}. Internally
  calls Paystack initialise + renders BriefEmail.tsx + sendEmail via
  Resend. Flips orders.status to 'brief_sent' (or 'brief_email_failed'
  on Resend error).
- Smoke verified: real Paystack URL, real Resend delivery, full
  forward path. Cleanup zero leftovers.
```

---

## Catch-up section — where the build stands

```
Phase 1 INFRASTRUCTURE: ✅ DEPLOYED LIVE (operscale.cloud, www, api/v1/health)
V2 PHASE 1 (selection + bank catalog + 0006 migration): ✅ SHIPPED 2026-05-04
V2 PHASE 2 (4 pure-logic modules + L2 cassette): ✅ SHIPPED 2026-05-04
V2 PHASE 3 (orchestrator + worker container LIVE): ✅ COMPLETE 2026-05-05
V2 PHASE 4 (route wiring — analyze + approve forward to founder_approved):
  ✅ COMPLETE 2026-05-05
V2 PHASE 4.5 (Paystack init + Resend brief email + brief_sent):
  ✅ COMPLETE 2026-05-05

Phase 4.5 commits: 170e7ef → be61449. Suite at 249/252 (3 nightly
skipped). Typecheck + build:worker clean. Live on VPS:
  - operscale-calendar-agent + -web force-recreated
  - https://api.operscale.cloud/v1/brief/analyze + /approve return 401
    on bogus auth (live, not 501).

  ✅ Task 1 — snapshot-to-email-props pure mapper [170e7ef..0e2ad14]
  ✅ Task 2 — paystack.initializeTransaction [073e928..2d2dd5e]
  ✅ Task 3 — email.sendEmail (Resend) [511e6e6..83defff]
  ✅ Task 4 — apps/web/src/emails/BriefEmail.tsx + workspace deps
              [9932963..e34a2e3]
  ✅ Task 5 — /v1/brief/approve route extension [ddf8bc4..5d338ae]
  ✅ Task 6 — VPS rebuild (6-attempt fix cycle) + live staging smoke
              [1bef568..be61449]
  ✅ Task 7 — close-out

  Plan-vs-code drifts caught and fixed in lockstep this phase:
   - Tier prices reconciled to canonical 150/275/525 NGN
     (TIER_PRICES_NGN was 80/200/400; TIER_DISPLAY new was 150/350/750;
     pricing-and-packages.md was the truth).
   - Resend v4 ErrorResponse has NO statusCode field — was hidden by
     `as any` cast; classified all 4xx as transient and retried 4×.
     Fixed via local RESEND_STATUS_BY_ERROR_NAME map.
   - 5× as-any casts in /approve replaced with typed orderTyped/
     runTyped local consts. Customer-fetch-failure path now flips to
     brief_email_failed + writes activity_log + returns 502 (was bare
     400 leaving order stuck).
   - Cross-package workspace dep (web ↔ agent) breaks `next build`'s
     in-process type-check even when standalone tsc is clean.
     Resolved with typescript.ignoreBuildErrors=true in BOTH apps.
     Filed as Phase 4.5.1 ADR — extract shared types to
     @operscale-calendar/shared package.

  ❌ Phase 4.6 — STILL TO DO. Carry-forwards:
    - apps/agent/src/app/v1/webhook/paystack/route.ts. POST handler.
      HMAC-SHA512 on raw body (use existing
      paystack.ts::verifyWebhookSignature). Cloudflare proxy is OFF
      for api.operscale.cloud (DNS-only) so raw bytes survive — DO
      NOT change this.
    - On charge.success: idempotency-check by paystack_tx_ref UNIQUE,
      INSERT payments row, UPDATE orders status='paid' + paid_at,
      send payment-confirmation email via Resend (new template),
      flip production_ready_at.
    - On charge.failure: log activity_log; do NOT change order status
      (customer can retry); recovery cron picks up at +2h (separate
      phase).
    - apps/web/src/emails/PaymentConfirmation.tsx (new) per email-
      templates.md §"Template 4". Receipt PDF attachment can be
      deferred to Phase 4.7.
    - email.ts::sendEmail support for templateKey='payment-
      confirmation' (currently throws not_implemented_template for
      anything other than 'brief-email').
    - Live smoke step in Phase 4.6: complete a real test-card payment
      through the Paystack URL from a live /approve, watch the webhook
      land, verify orders.status → paid + payments row written +
      payment-confirmation email delivered.
```

---

## First message (paste after the system context)

```
Begin V2 Phase 4.6 with brainstorming.

Read MEMORY.md and the latest "V2 Phase 4.5 — ✅ COMPLETE 2026-05-05"
section in project_state.md to confirm Phase 4.5 forward path is live
and what carry-forwards exist for Phase 4.6.

Sanity-check before starting Phase 4.6:
1. `git log --oneline 5443868..HEAD` — should show ~25 commits ending
   with the Phase 4.5 close-out.
2. `git status --short` — should be clean.
3. `cd apps/agent; npm test` — should be 249/252 (3 nightly skipped).
4. `cd apps/agent; npm run typecheck` — clean.
5. `cd apps/agent; npm run build:worker` — clean.
6. POST a bogus body to https://api.operscale.cloud/v1/brief/analyze
   with no Authorization header → should get 401, NOT 501. Same for
   /approve. /v1/webhook/paystack should still return 501 (Phase 4.6
   replaces it).

If any sanity check fails, STOP and report — do not proceed.

Then run brainstorming for Phase 4.6 to settle these decision points
BEFORE writing the plan:
- A — Webhook idempotency strategy: by paystack_tx_ref UNIQUE on
  payments table (existing schema, simplest) vs by paystack_event_id
  (Paystack's own event ID, more robust against re-fires of the same
  charge.success). Recommend: paystack_event_id (Paystack's docs
  recommend it for replay safety).
- B — Payment-confirmation email send timing: synchronously inside
  the webhook handler (must return within 3s to Paystack) vs queued
  (insert email_jobs row, return 200 immediately, worker sends
  async). Recommend: queued — Paystack's 3s timeout is tight for a
  Resend round-trip plus PDF generation. ai_analysis_jobs is the
  precedent.
- C — Receipt PDF generation: in-line in 4.6 vs deferred to 4.7.
  Recommend: defer. Phase 4.6 ships the email without attachment;
  4.7 adds the PDF receipt. Keeps 4.6 small.
- D — `production_ready_at` flip on charge.success: in 4.6 (since
  Phase 2 production isn't built) vs deferred. Recommend: in 4.6 —
  the column is already on orders, the flip is a 1-line UPDATE, and
  it's a useful breadcrumb for when Phase 2 picks up.
- E — `payment_initiated` status: Phase 4.5 sets payment_initiated_at
  but NOT status='payment_initiated' (we go straight brief_sent →
  paid). 4.6 should keep this — Paystack does not emit a
  "transaction created" webhook for the click event, so we have no
  signal to flip to payment_initiated. The status remains in the
  CHECK constraint as forward-compatibility only.

After brainstorming, write a Phase 4.6 plan (writing-plans skill) at
docs/plans/2026-05-XX-v2-phase-4-6-paystack-webhook.md, then execute
task by task via subagent-driven-development.

CARRY-FORWARD discipline (DO NOT VIOLATE):
- All NEW relative imports in apps/agent/src/lib/ and src/worker/
  must include .js extensions (worker compiles them). Routes use @/.
- Phase 4.5's email.ts and snapshot-to-email-props.ts are EXCLUDED
  from tsconfig.worker.json — do NOT add them back. New webhook
  handler in apps/agent/src/app/v1/webhook/paystack/route.ts will
  use @/ aliases (route convention).
- Webhook MUST read raw body BEFORE JSON.parse for HMAC verification.
  Use req.text() then JSON.parse(rawBody) — NOT req.json() (consumes
  body stream).
- Idempotency on every webhook handler: lookup before INSERT.
  ai_analysis_jobs sets the precedent.
- writeActivityLog and writeLlmCall stay best-effort (stderr log on
  swallow, never throw).
- Logger.error on terminal failure paths.
- Plan-keeps-pace-with-code: same commit as code change.

NEVER:
- Commit or push any .env file or secret-shaped string.
- Use git --no-verify (pre-commit hook is the safety net).
- Inline a key in any code/config/docs/workflow file.
- Echo or log any secret value during paramiko sessions.
- Switch tsconfig.worker.json away from NodeNext.
- Hit Paystack live mode in any Phase 4.6 work — test keys only.
- Parse the Paystack webhook body before HMAC verification — HMAC
  is on the raw bytes.
- Change Cloudflare DNS on api.operscale.cloud to proxied — must
  stay DNS-only for raw-body HMAC.

When stopping (context limit, user pause, or after Phase 4.6 ships),
update memory's project_state.md with the shipped commit range and
rewrite prompt.md for the next session — same pattern as this
handoff.
```

---

## Useful one-liners

```bash
# Live stack health (external)
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/

# Verify Phase 4 + 4.5 routes are live (401, not 501)
curl -X POST https://api.operscale.cloud/v1/brief/analyze \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/brief/approve \
  -H 'content-type: application/json' -d '{}'

# Phase 4.6 webhook should still be 501 until shipped:
curl -X POST https://api.operscale.cloud/v1/webhook/paystack \
  -H 'content-type: application/json' -d '{}'

# Local test + typecheck + worker build (run from apps/agent)
npm test
npm run typecheck
npm run build:worker

# Re-run the Phase 4.5 staging smoke (paramiko + python urllib)
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-5-smoke.py

# Re-record the L2 cassette (only if a Phase 2 module changes)
npm run --prefix apps/agent test:claude:live initial-fashion-tier-2

# VPS rebuild (the script that worked through Phase 4.5's 6-attempt
# fix cycle — bakes in `git reset --hard origin/main` before build)
PYTHONIOENCODING=utf-8 python C:\tmp\vps-rebuild.py

# Tail the agent on VPS
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
- DON'T echo or log secret values (paramiko sessions, npm output, test output) — sanitize before printing.
- DON'T switch tsconfig.worker.json from NodeNext to bundler/ESNext — runtime requires NodeNext.
- DON'T add `.js` extensions or `@/` alias to email.ts or snapshot-to-email-props.ts — they're route-only and excluded from worker tsc.
- DON'T remove the `typescript.ignoreBuildErrors` setting in next.config.mjs without first adding a CI workflow that runs `tsc --noEmit` + `next lint` as dedicated gates.
- DON'T treat `briefs` as flat-column — form_payload jsonb is source of truth.
- DON'T omit `model: CLAUDE_MODEL` from any analysis_runs INSERT — column is NOT NULL.
- DON'T change Cloudflare DNS on api.operscale.cloud to proxied — must stay DNS-only for raw-body HMAC.
- DON'T parse the Paystack webhook body before HMAC verification.
- DON'T skip brainstorming/writing-plans before non-trivial code work.
- DON'T fix code-review findings without also updating the plan file in the same commit.
- DON'T go silent on long-running work — minute-cadence updates, every dispatch.
- DON'T run ALTER DATABASE as 'postgres' user — switch to 'supabase_admin'.
- DON'T re-record the L2 cassette unless a Phase 2 module's behaviour actually changed.
- DON'T pause mid-task without committing — every commit on main is a recovery point.
- DON'T hit Paystack live mode in any Phase 4.6 work — test keys only.
