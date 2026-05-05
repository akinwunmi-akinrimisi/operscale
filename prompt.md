# Continuation prompt — Operscale Calendar V2 Phase 5 BRAINSTORM (Founder CRM)

Phase 4.6 (Paystack webhook handler + payment-confirmation email) is COMPLETE and LIVE. The forward path now runs end-to-end: form → analyze → approve → Paystack init + brief email → customer pays → webhook flips order to `paid` → payment-confirmation email lands in customer inbox. This handoff starts the **Founder CRM** brainstorm in a fresh session.

The roadmap was revised at the end of Phase 4.5: CRM was Phase 7, now Phase 5 (right after 4.6). Customer brief form is now Phase 6, submit/auto-ack Phase 7, marketing/legal Phase 8, launch Phase 9. The reason the founder asked for this re-ordering: he wants a working CRM **before** real customers arrive, so he can practice operating the pipeline end-to-end on test fixtures before any real money moves.

---

## System context (paste FIRST in the new session)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

V2 Phase 5 BRAINSTORM (Founder CRM). Phases 1, 2, 3, 4, 4.5, 4.6 are
all live on https://api.operscale.cloud. The /v1/health, /v1/brief/
analyze, /v1/brief/approve, /v1/webhook/paystack routes all return
real responses (no 501s remain on the forward path).

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-
Antigravity-operscale-calender\memory\ auto-loads. Read MEMORY.md +
project_state.md first — the "V2 Phase 4.6 — ✅ COMPLETE" section
ends with "Phase 5 carry-forwards" listing the decisions to surface
during brainstorming.

NON-NEGOTIABLE: NO API KEYS OR SECRETS COMMITTED OR PUSHED, EVER.
- .env files gitignored; pre-commit hook blocks .env + secret-shaped
  strings + files >5MB.
- Master .env at parent dir: C:\Users\DELL\Documents\Antigravity\
  operscale-calender\.env (server_password, ANTHROPIC_API_KEY,
  PAYSTACK test keys, RESEND_API_KEY, JWT_SECRET, SUPABASE_*).
- For SSH/paramiko: PYTHONIOENCODING=utf-8.

Working pattern (do NOT deviate without asking):
- Brainstorming first via superpowers:brainstorming. Surface the
  Phase 5 carry-forwards from project_state.md as starting points
  + ask the founder for direction on UX details that aren't pre-
  decided.
- After brainstorming completes: design doc at
  docs/specs/v2-phase-5-design.md, then implementation plan at
  docs/plans/<date>-v2-phase-5-founder-crm.md.
- Execution via superpowers:subagent-driven-development.
- Direct commits to main; no feature branches.
- "Plan keeps pace with code" — fix plan file in the SAME commit
  as code when reviews catch plan-level bugs.
- Push to origin every 2-3 tasks.
- Minute-cadence status updates between every dispatch.
- Use `git commit -F C:\tmp\commit-msg.txt` for messages with `#`
  chars (PowerShell heredoc trips on `#`).

CRITICAL build-discipline carry-forwards (REINFORCED through Phase 4.6):
- Route-only lib files (apps/agent/src/lib/email.ts,
  snapshot-to-email-props.ts, payment-confirmation-props.ts) use
  plain relative imports (no .js, no @/) AND are excluded from
  tsconfig.worker.json.
- All OTHER files in apps/agent/src/lib/ and apps/agent/src/worker/
  keep .js extensions on relative imports (NodeNext requirement).
- apps/agent AND apps/web next.config.mjs have typescript.
  ignoreBuildErrors=true + eslint.ignoreDuringBuilds=true. CI runs
  tsc --noEmit + next lint as separate gates.
- Cloudflare DNS-only (NOT proxied) for api.operscale.cloud — this
  is now load-bearing for the live Paystack webhook. Don't change.

PHASES 1-4.6 ARE LIVE. Verify with:
  curl -sI https://api.operscale.cloud/v1/health           → 200
  curl -X POST https://api.operscale.cloud/v1/brief/analyze   → 401
  curl -X POST https://api.operscale.cloud/v1/brief/approve   → 401
  curl -X POST https://api.operscale.cloud/v1/webhook/paystack → 401
    (expects valid HMAC signature; 401 on bad/missing sig is correct)

Migration applied through 0008. supabase/migrations/0001 to 0008
all on disk and applied to staging Supabase.
```

---

## First message (paste AFTER the system context)

```
Begin V2 Phase 5 brainstorming.

Read MEMORY.md, project_state.md (especially the "V2 Phase 4.6 —
✅ COMPLETE" section, focusing on the Phase 5 carry-forwards block
at the end), and skim docs/specs/founder-review-flow.md +
docs/specs/data-model.md for existing schema affordances.

Then run superpowers:brainstorming with this premise:

  Phase 5 builds the FOUNDER CRM at apps/web/src/app/admin/* — the
  first surface that lives in apps/web (Phases 1-4.6 lived in
  apps/agent's API routes; Phases 5+ start expanding the web app).
  The founder uses one of three allowlisted emails to magic-link-
  sign-in. They land on a pending-review list, click into a brief
  to see the AI snapshot, can edit fields / discard / approve.
  Paid orders appear in a separate dashboard reading the post-4.6
  state (status=paid + payments + paid_at + production_ready_at).

  Decisions to surface during brainstorming (anything not pre-
  decided in the spec):

  1. Magic-link UX flow: do we land on /admin (gated) and redirect
     to /auth/sign-in if no session, or land on /auth/sign-in by
     default and redirect to /admin after successful auth? Either
     works; founder preference?

  2. Pending-review list filters / sort: by submitted_at desc by
     default. Filter by tier? Search by brand_name? Bulk discard?
     Probably YAGNI for v0.

  3. Edit-field UX: which fields are editable from the founder UI
     vs read-only AI output? Founder-editable fields write to
     analysis_edits (existing table per 0001 schema). Re-analyze
     button calls POST /v1/brief/analyze with trigger_type=
     're_analyze_with_note' + prior_run_id + founder_note.

  4. Realtime vs poll: Supabase Realtime is wired for some tables
     (REPLICA IDENTITY FULL set per gotcha #4). Pending-review list
     and paid-orders dashboard could subscribe live, OR poll every
     N seconds. Realtime is more elegant; poll is simpler. Founder
     preference?

  5. Discard action: do we immediately flip orders.status='discarded'
     and the brief stays for audit, or also soft-delete the brief?
     Probably first option (audit trail matters per CLAUDE.md
     "observability before automation").

  6. Brief detail page layout: side-by-side (brief on left, AI
     snapshot on right) vs tabs vs single column scroll? Real-mobile
     test required per CLAUDE.md file ownership rules.

  7. Pagination on pending-review list: when does it kick in? 10
     per page? 25? Founder ops volume early on is low (~1-3
     submissions/day expected).

  8. Audit log surfaces: every founder action (edit, re-analyze,
     discard, approve) writes to activity_log. Should the brief
     detail page render the activity_log timeline as a sidebar?
     Probably yes — gives founder context on prior actions.

  Pre-decided constraints (DO NOT brainstorm — these are locked):

  - Magic-link auth via Supabase signInWithOtp; allowlist enforced
    by send_email_hook + custom_access_token_hook (already
    installed project-wide on shared Supabase per memory).
  - role: founder is in the JWT after the custom_access_token_hook
    fires; verifyJwt helper at apps/agent/src/lib/auth/verify-jwt.ts
    can be reused on apps/web by exporting it from the agent
    workspace package OR duplicating it (Phase 4.5 cyclic dep
    pattern — duplicate is safer than circular import).
  - Anything that calls SUPABASE_SERVICE_ROLE_KEY MUST stay server-
    side. apps/web uses anon key for client-side reads; founder-
    privileged writes go through API routes that use service-role.
  - The 8 selected_pairs from analysis_runs.framework_seed are
    READ-ONLY in the CRM v0. Future phases can add edit-pair
    workflow.
  - Brief and order are 1:1 — one brief per order. The CRM lists
    by order (since founder review is per-order workflow).

After brainstorming completes, write the design doc at
docs/specs/v2-phase-5-design.md, then the implementation plan at
docs/plans/<YYYY-MM-DD>-v2-phase-5-founder-crm.md. Don't start
execution until both are committed and the founder has confirmed
direction.

NEVER:
- Commit/push secrets. The repo is public; one mistake is permanent.
- Use git --no-verify.
- Inline keys in code/config/docs/workflow.
- Add a CRM page that calls SUPABASE_SERVICE_ROLE_KEY from a client
  component. Service-role usage is API-route-only.
- Build edit-pair UX in Phase 5 (deferred).
- Skip the "observability before automation" pattern — log every
  founder action to activity_log BEFORE adding any automation that
  reads from it.
- Touch any 4.6 webhook code without a separate brainstorm + plan.
```

---

## Useful one-liners (carry forward as-is)

```bash
# Live stack health
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/

# Phase 4 + 4.5 + 4.6 routes (should all be 401, real)
curl -X POST https://api.operscale.cloud/v1/brief/analyze \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/brief/approve \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/webhook/paystack \
  -H 'content-type: application/json' -d '{}'

# Local agent (run from apps/agent)
npm test
npm run typecheck
npm run build:worker

# Local web (run from apps/web)
npm test
npm run typecheck
npm run build

# VPS rebuild (bakes in git pull)
PYTHONIOENCODING=utf-8 python C:\tmp\vps-rebuild.py

# Phase 4.5 smoke (still works against live VPS — exercises the
# enqueue/analyze/approve/paystack-init/email-send forward path)
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-5-smoke.py

# Phase 4.6 smoke (two-phase: setup then verify, with manual
# browser payment in between using test card 4084 0840 8408 4081)
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-6-smoke.py setup
# (open URL, pay)
PYTHONIOENCODING=utf-8 python C:\tmp\phase4-6-smoke.py verify

# Webhook replay pattern (avoids re-paying for debug runs):
# 1. SELECT raw_payload from existing payments row.
# 2. DELETE the payments row + webhook_handler_failed log.
# 3. Build {event:'charge.success', data: raw_payload} envelope.
# 4. HMAC-SHA512 sign with PAYSTACK_SECRET_KEY.
# 5. POST to /v1/webhook/paystack with x-paystack-signature header.
# Used in Phase 4.6 Task 6 to verify schema fix without a fresh
# Paystack transaction. See git log around commit 030399d.

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

# Apply a new migration to staging
PYTHONIOENCODING=utf-8 python -c "
import paramiko, pathlib
pw = next(l.split('=', 1)[1].strip() for l in pathlib.Path(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env').read_text(encoding='utf-8').splitlines() if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()
local = r'<absolute-path-to-NEW-migration.sql>'
remote = '/tmp/' + local.split(chr(92))[-1]
sftp.put(local, remote)
sftp.close()
_, out, err = c.exec_command(f'docker cp {remote} supabase-db-1:/tmp/m.sql && docker exec supabase-db-1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/m.sql && docker exec supabase-db-1 psql -U postgres -d postgres -t -A -c \"NOTIFY pgrst, \\'reload schema\\'\"', timeout=30)
print(out.read().decode()); print(err.read().decode())
c.close()
"

# Current branch state
git log --oneline -10
git status --short
```
