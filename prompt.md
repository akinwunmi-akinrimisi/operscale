# Continuation prompt — Operscale Calendar V2 Phase 4.6 EXECUTION

Brainstorming + design + plan are DONE for Phase 4.6. This handoff starts the implementation in a fresh session via subagent-driven-development.

---

## System context (paste FIRST in the new session)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

V2 Phase 4.6 EXECUTION. Brainstorming + design + plan are already
complete and committed:
  - Design: docs/specs/v2-phase-4-6-design.md (commit 47f813b)
  - Plan:   docs/plans/2026-05-05-v2-phase-4-6-paystack-webhook.md
            (commit e582146, 1325 lines, 7 tasks)

The plan is fully executable — every task has TDD step blocks with
verbatim test code, verbatim implementation code, exact bash commands,
exact commit messages. Use subagent-driven-development to execute.

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-
Antigravity-operscale-calender\memory\ auto-loads. Read MEMORY.md +
project_state.md first — section "V2 Phase 4.6 — 📋 BRAINSTORMED +
PLANNED" lists what's been decided + the 7 tasks ready to execute.

NON-NEGOTIABLE: NO API KEYS OR SECRETS COMMITTED OR PUSHED, EVER.
- .env files gitignored; pre-commit hook blocks .env + secret-shaped
  strings + files >5MB.
- Master .env at parent dir: C:\Users\DELL\Documents\Antigravity\
  operscale-calender\.env (server_password, ANTHROPIC_API_KEY,
  PAYSTACK test keys, RESEND_API_KEY, JWT_SECRET, SUPABASE_*).

For SSH/paramiko: PYTHONIOENCODING=utf-8. The VPS rebuild script at
C:\tmp\vps-rebuild.py bakes in `git fetch + git reset --hard
origin/main` (Phase 4.5 lesson — earlier scripts skipped the pull
and rebuilt stale code 3× in a row). Reuse it for Task 6.

Working pattern (do NOT deviate without asking):
- Direct commits to main (no feature branches).
- Subagent-driven-development for plan execution.
- Each task: implementer subagent → spec reviewer → code-quality
  reviewer → fix loop. Inline fixes acceptable for small mechanical
  cleanups; full two-stage review for non-trivial tasks.
- "Plan keeps pace with code" — fix plan file in the SAME commit
  as code when reviews catch plan-level bugs.
- Push to origin every 2-3 tasks (don't wait for the whole phase).
- Minute-cadence status updates between every dispatch.
- Use `git commit -F C:\tmp\commit-msg.txt` for messages with `#`
  chars (PowerShell heredoc trips on `#`).

CRITICAL Phase 4.5 build-discipline carry-forwards (REINFORCED in
the Phase 4.6 plan; do NOT regress):
- apps/agent/src/lib/email.ts and snapshot-to-email-props.ts and
  (NEW IN 4.6) payment-confirmation-props.ts use plain relative
  imports (`./types/v2`, `./post-processor`, `./snapshot-to-email-
  props`) — NO .js extension and NO @/ alias. They are EXCLUDED from
  tsconfig.worker.json (Task 2 Step 4 of the plan adds the new
  exclusion).
- All OTHER files in apps/agent/src/lib/ and apps/agent/src/worker/
  keep .js extensions (NodeNext requirement for build:worker).
- apps/agent AND apps/web next.config.mjs have typescript.
  ignoreBuildErrors=true + eslint.ignoreDuringBuilds=true. CI runs
  tsc --noEmit + next lint as separate gates.
- Webhook route MUST read raw body BEFORE JSON.parse for HMAC.
  req.text() then JSON.parse(rawBody) — NOT req.json() (consumes the
  stream). Documented + tested in Task 5 of the plan.
- Cloudflare DNS-only (NOT proxied) for api.operscale.cloud so raw
  bytes survive. Don't change this.
- Test mode keys only in 4.6 (PAYSTACK_SECRET_KEY=sk_test_*).

PHASES 1-4.5 ARE LIVE on https://api.operscale.cloud:
- /v1/brief/analyze + /v1/brief/approve return 401 (real, not 501).
- /v1/webhook/paystack still returns 501 — Phase 4.6 replaces it.
```

---

## First message (paste AFTER the system context)

```
Begin V2 Phase 4.6 execution.

Read MEMORY.md, project_state.md (especially the "V2 Phase 4.6 —
📋 BRAINSTORMED + PLANNED" section), then the design doc at
docs/specs/v2-phase-4-6-design.md (commit 47f813b) and the plan at
docs/plans/2026-05-05-v2-phase-4-6-paystack-webhook.md (commit
e582146).

Sanity-check before Task 1:
1. `git log --oneline e582146..HEAD` — should be empty (we are at
   tip).
2. `git status --short` — should be clean.
3. `cd apps/agent; npm test` — should be 249/252 (3 nightly
   skipped).
4. `cd apps/agent; npm run typecheck` — clean.
5. `cd apps/agent; npm run build:worker` — clean.
6. POST a bogus body to https://api.operscale.cloud/v1/webhook/
   paystack with no signature → should still get 501 (Phase 4.6
   not yet shipped). After Task 5 ships, the same call should
   return 401 (HMAC mismatch).

If any sanity check fails, STOP and report — do not proceed.

Then execute the 7 tasks via superpowers:subagent-driven-development:

  Task 1 — paystack.ts public event types
  Task 2 — payment-confirmation-props.ts pure mapper +
           tsconfig.worker.json exclusion
  Task 3 — PaymentConfirmation.tsx React Email component
  Task 4 — email.ts SUPPORTED_TEMPLATES allowlist += 'payment-
           confirmation'
  Task 5 — /v1/webhook/paystack route rewrite (10 unit tests
           covering all failure modes from design § 7)
  Task 6 — VPS rebuild via C:\tmp\vps-rebuild.py + live smoke
           (manual browser payment with test card 4084 0840
           8408 4081)
  Task 7 — close-out (full verify, plan checkboxes, memory
           project_state.md, prompt.md → Phase 5 / CRM handoff)

Per-task pattern:
- Dispatch implementer subagent (general-purpose, sonnet) with full
  task text + context.
- After implementer DONE: dispatch spec compliance reviewer.
- After spec ✅: dispatch code-quality reviewer.
- Fix loop on any blocker findings. Inline fixes for small nits OK.
- Mark task complete in TaskUpdate AFTER both reviews pass.
- Minute-cadence status updates to me between every dispatch.

Push to origin/main every 2-3 tasks. After Task 6's smoke passes
(manual confirmation by user that founder inbox received the
payment-confirmation email), proceed to Task 7 close-out.

When Phase 4.6 ships: rewrite prompt.md as the Phase 5 / Founder
CRM handoff. The user revised the roadmap so CRM is the next phase
after 4.6 (was previously Phase 7). Phase 5 carry-forwards to
brainstorm: magic-link auth flow, pending-review list with AI
snapshot, edit-field UX, brief-detail page wiring, paid-orders
dashboard reading Phase 4.6's payments + orders state.

NEVER:
- Commit/push secrets. The repo is public; one mistake is permanent.
- Use git --no-verify.
- Inline keys in code/config/docs/workflow.
- Echo or log secret values during paramiko sessions.
- Switch tsconfig.worker.json from NodeNext to bundler/ESNext.
- Add .js extensions or @/ aliases to email.ts / snapshot-to-email-
  props.ts / payment-confirmation-props.ts (route-only lib files).
- Remove typescript.ignoreBuildErrors from next.config.mjs without
  first adding a CI workflow that runs tsc --noEmit + next lint.
- Parse Paystack webhook body before HMAC verification.
- Change Cloudflare DNS on api.operscale.cloud to proxied.
- Hit Paystack live mode in any 4.6 work — test keys only.
```

---

## Useful one-liners (carry forward as-is)

```bash
# Live stack health
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/

# Phase 4 + 4.5 routes (should be 401, real)
curl -X POST https://api.operscale.cloud/v1/brief/analyze \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/brief/approve \
  -H 'content-type: application/json' -d '{}'

# Phase 4.6 webhook (501 until Task 5 ships; 401 after)
curl -X POST https://api.operscale.cloud/v1/webhook/paystack \
  -H 'content-type: application/json' -d '{}'

# Local agent (run from apps/agent)
npm test
npm run typecheck
npm run build:worker

# VPS rebuild (bakes in git pull)
PYTHONIOENCODING=utf-8 python C:\tmp\vps-rebuild.py

# Phase 4.5 smoke (still works against live VPS)
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-5-smoke.py

# Tail agent logs on VPS
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
