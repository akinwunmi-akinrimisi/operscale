# Continuation prompt — Operscale Calendar V2 Phase 6 BRAINSTORM (Customer Brief Form)

Phase 5 (Founder CRM v0) is COMPLETE and LIVE on https://operscale.cloud/admin. The forward path now runs end-to-end with a human-in-the-loop CRM: form (still stub) → analyze → founder reviews in CRM → approve → Paystack init + brief email → customer pays → webhook flips order to `paid` → payment-confirmation email lands in customer inbox → paid-orders dashboard shows it. This handoff starts the **Customer Brief Form** brainstorm in a fresh session.

The roadmap (revised at end of Phase 4.5): CRM was Phase 7, became Phase 5 (now done). Customer brief form is **Phase 6**. Submit/auto-ack is Phase 7, marketing/legal Phase 8, launch Phase 9. The reason the founder asked for this re-ordering: he wanted a working CRM **before** real customers arrived, so he could practice operating the pipeline end-to-end on test fixtures — that practice is now possible. Phase 6 builds the customer-facing intake the CRM has been waiting for.

---

## System context (paste FIRST in the new session)

```
Working directory: C:\Users\DELL\Documents\Antigravity\operscale-calender\operscale-calendar-platform

V2 Phase 6 BRAINSTORM (Customer Brief Form). Phases 1, 2, 3, 4,
4.5, 4.6, 5 are all live on https://api.operscale.cloud +
https://operscale.cloud/admin. The /v1/health, /v1/brief/analyze,
/v1/brief/approve, /v1/brief/discard, /v1/webhook/paystack routes
all return real responses (no 501s anywhere on the forward path).
The /admin sign-in + /auth/callback + /admin/pending-review +
/admin/orders/[id] (review + timeline modes) + /admin/paid-orders
surfaces all live with Realtime + 3 founder action modals.

Memory at C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-
Antigravity-operscale-calender\memory\ auto-loads. Read MEMORY.md +
project_state.md first — the "V2 Phase 5 — ✅ COMPLETE" section
ends with "Phase 5.x carry-forwards" + "Phase 6 starting points"
listing decisions to surface during brainstorming.

NON-NEGOTIABLE: NO API KEYS OR SECRETS COMMITTED OR PUSHED, EVER.
- .env files gitignored; pre-commit hook blocks .env + secret-shaped
  strings + files >5MB.
- Master .env at parent dir: C:\Users\DELL\Documents\Antigravity\
  operscale-calender\.env (server_password, ANTHROPIC_API_KEY,
  PAYSTACK test keys, RESEND_API_KEY, JWT_SECRET, SUPABASE_*,
  NEXT_PUBLIC_AGENT_BASE_URL).
- For SSH/paramiko: PYTHONIOENCODING=utf-8.

Working pattern (do NOT deviate without asking):
- Brainstorming first via superpowers:brainstorming. Surface the
  Phase 6 starting points from project_state.md + ask the founder
  for direction on UX details that aren't pre-decided.
- After brainstorming completes: design doc at
  docs/specs/v2-phase-6-design.md, then implementation plan at
  docs/plans/<date>-v2-phase-6-customer-form.md.
- Execution via superpowers:subagent-driven-development.
- Direct commits to main; no feature branches.
- "Plan keeps pace with code" — fix plan file in the SAME commit
  as code when reviews catch plan-level bugs (Phase 5 reinforced
  this 14 commits in a row).
- Push to origin every 2-3 tasks.
- Minute-cadence status updates between every dispatch.
- Use `git commit -F C:\tmp\commit-msg.txt` for messages with `#`
  chars (PowerShell heredoc trips on `#`).

CRITICAL build-discipline carry-forwards (REINFORCED through Phase 5):
- Route-only lib files (apps/agent/src/lib/email.ts,
  snapshot-to-email-props.ts, payment-confirmation-props.ts) use
  plain relative imports (no .js, no @/) AND are excluded from
  tsconfig.worker.json.
- All OTHER files in apps/agent/src/lib/ and apps/agent/src/worker/
  keep .js extensions on relative imports (NodeNext requirement).
- apps/agent AND apps/web next.config.mjs have typescript.
  ignoreBuildErrors=true + eslint.ignoreDuringBuilds=true. CI runs
  tsc --noEmit + next lint as separate gates.
- Cloudflare DNS-only (NOT proxied) for api.operscale.cloud — load-
  bearing for the live Paystack webhook. operscale.cloud (apex) IS
  proxied — Phase 5 added a port-strip in the auth/callback redirect
  to handle x-forwarded-host coming through Traefik (commit c535a6a).
- supabase-js join types are T[] | T | null even with !inner — use
  a firstOrNull helper. Pattern is now repeated in 4 sites in
  apps/web/src/app/admin/* — Phase 6 is a good time to extract to
  apps/web/src/lib/supabase-embed.ts.
- customers table column rename: PostgREST aliasing (id,
  name:full_name, whatsapp:whatsapp_number) keeps consumer code on
  canonical names. Reuse the alias selector verbatim.
- briefs.form_payload canonical keys live in
  apps/agent/src/lib/types/v2.ts BriefAnalyzerInput +
  apps/agent/src/worker/process-job.ts projector. Phase 6 form WILL
  write to form_payload — match these keys exactly or update the
  projector + analyzer in the same commit.
- vitest config has globals:false; component test files MUST import
  { afterEach } + { cleanup } from @testing-library/react and call
  afterEach(() => cleanup()). Without this, second test in the same
  file finds 2 instances of every element.
- Component test files use `// @vitest-environment happy-dom`
  directive at the top (vitest config env stays 'node' for the
  agent + email-template tests).
- Next.js standalone behind Traefik needs proxy-aware URL
  construction (x-forwarded-host with port-stripping for
  default-port hosts) for any redirect that bubbles back to the
  browser. Carry forward verbatim from /auth/callback for any new
  Phase 6 redirect (e.g. submit-success).

PHASES 1-5 ARE LIVE. Verify with:
  curl -sI https://api.operscale.cloud/v1/health           → 200
  curl -X POST https://api.operscale.cloud/v1/brief/analyze   → 401
  curl -X POST https://api.operscale.cloud/v1/brief/approve   → 401
  curl -X POST https://api.operscale.cloud/v1/brief/discard   → 401
  curl -X POST https://api.operscale.cloud/v1/webhook/paystack → 401
    (expects valid HMAC signature; 401 on bad/missing sig is correct)
  curl -sI https://operscale.cloud/admin                    → 200
  curl -sI https://operscale.cloud/auth/callback            → 307 with
    Location: https://operscale.cloud/admin?reason=expired

Migration applied through 0010. supabase/migrations/0001 to 0010
all on disk and applied to staging Supabase:
- 0009 — activity_log founder INSERT + READ policies
- 0010 — customers + brief_photos founder READ policies
```

---

## First message (paste AFTER the system context)

```
Begin V2 Phase 6 brainstorming.

Read MEMORY.md, project_state.md (especially the "V2 Phase 5 —
✅ COMPLETE" section + the "Phase 6 starting points" block at the
end), and skim docs/specs/data-model.md for the briefs +
brief_photos + customers schema affordances. The Phase 5 spec
(docs/specs/v2-phase-5-design.md) is also useful — it documents
which form_payload keys the AI analyzer + CRM projection consume.

Then run superpowers:brainstorming with this premise:

  Phase 6 builds the CUSTOMER BRIEF FORM at apps/web/src/app/brief/*
  — the FIRST customer-facing surface in the repo (Phases 1-5 lived
  in apps/agent's API routes + apps/web's founder-only /admin
  surface). The customer arrives via marketing site CTA → fills a
  multi-step form → uploads optional photos → hits submit → form
  POSTs to /v1/brief/submit (NEW route on apps/agent) which writes
  briefs + customers + brief_photos rows + creates the order +
  enqueues the analyze job + (Phase 7 concern) sends the auto-ack
  email. Customer sees a "thanks, check your inbox" page.

  Per CLAUDE.md file ownership: apps/web/src/app/brief/* is "Test on
  real mobile devices" — Nigerian SMB founders fill this on a phone,
  often on a flaky 3G connection. Mobile-first is non-negotiable, and
  partial-completion persistence (save token round-trips to Supabase
  after each step per VG fork pattern) is mandatory.

  Decisions to surface during brainstorming (anything not pre-
  decided in the spec):

  1. Form structure: how many steps? Hard cap at 4-5 to keep
     completion rate ≥ 35% target (CLAUDE.md "What good looks like").
     Likely shape: (1) brand basics + niche, (2) tone + audience,
     (3) examples/competitors + style refs, (4) optional photos,
     (5) review + submit. Founder confirm step boundaries.

  2. Save-token UX: anonymous form fills → server generates a UUID
     save_token cookie (httpOnly, 30-day TTL) → every step PATCHes
     a draft row in `briefs` (status='draft'). On final submit,
     status flips to 'analyzing' and the save_token is rotated.
     Founder preference on resume-via-link email vs cookie-only?

  3. Photo upload: tfjs blazeface advisory (CLAUDE.md locked stack)
     runs browser-side BEFORE upload — warns "this photo doesn't
     show a clear face" but does NOT block. Photos go to private
     Supabase Storage bucket via signed-upload-URL pattern (DO NOT
     expose service-role to client). Max N photos? 5? Founder pref.

  4. Validation: zod schemas for each step, server-side re-validate
     on submit, client-side eager validation on blur. Pattern from
     Phase 4 + 5: zod schemas live in apps/agent/src/lib/types/v2.ts;
     apps/web imports from there or duplicates? (Per Phase 4.5
     cyclic-dep pattern: duplicate is safer than circular. But
     form_payload keys are load-bearing so they MUST stay in sync
     with the analyzer projector — see build-discipline notes.)

  5. Niche-specific branching: the 8 niches (defined in
     niche-briefs/*) have different "what we need to know" lists.
     Does the form branch on niche-selected, or stay one-size-fits-
     all with a free-text "anything else" field? Founder preference.

  6. Auto-ack email: probably Phase 7 (separate phase per roadmap),
     but the submit handler MUST enqueue a job that Phase 7 will
     consume. Confirm scope boundary: Phase 6 = form + submit
     handler + draft persistence + photo upload, Phase 7 = auto-ack
     email + drop-off recovery emails (12h, 48h).

  7. Brand-name placeholder: every customer-facing string uses
     <brand-name>. Day 15 of build is the brand-locking PR; until
     then CI grep-checks the placeholder is present in expected
     places. Form copy MUST honour this.

  8. Marketing CTA inbound: where does the customer land? `/brief/`
     directly, or `/` (homepage with hero + CTA → `/brief/`)?
     Marketing site is Phase 8, so Phase 6 probably ships a stub
     `/` that redirects to `/brief/` for now. Founder confirm.

  Pre-decided constraints (DO NOT brainstorm — these are locked):

  - form_payload canonical keys live in
    apps/agent/src/lib/types/v2.ts BriefAnalyzerInput +
    apps/agent/src/worker/process-job.ts projector. Form WRITES to
    these keys exactly; no renaming without updating both consumers
    in the same commit.
  - Photos go to private Supabase Storage bucket via SIGNED upload
    URLs — apps/web/src/app/brief/* NEVER touches
    SUPABASE_SERVICE_ROLE_KEY. The upload-URL endpoint lives on
    apps/agent.
  - blazeface model is ADVISORY only. Never block submit on photo
    quality (CLAUDE.md locked stack: "advisory, not blocking").
  - Form completion target: ≥ 35% within 60 days. Anything that
    pushes against this needs a writedown.
  - Photo opt-in target: ≥ 40%. Photo step is OPTIONAL; making it
    feel mandatory is a CRO regression.
  - The customers table uses full_name + whatsapp_number columns
    (NOT name/whatsapp). Use PostgREST aliasing on read (Phase 5
    pattern) but write the canonical column names on insert.
  - REPLICA IDENTITY FULL is set on briefs + orders for Realtime —
    if Phase 6 adds a new table the founder will read in CRM, set
    it on the new table too (gotcha #4).
  - No Phase 2 work. Don't think about video/carousel rendering.

After brainstorming completes, write the design doc at
docs/specs/v2-phase-6-design.md, then the implementation plan at
docs/plans/<YYYY-MM-DD>-v2-phase-6-customer-form.md. Don't start
execution until both are committed and the founder has confirmed
direction.

NEVER:
- Commit/push secrets. The repo is public; one mistake is permanent.
- Use git --no-verify.
- Inline keys in code/config/docs/workflow.
- Add a brief/ page that calls SUPABASE_SERVICE_ROLE_KEY from a
  client component. Service-role usage is API-route-only.
- Block submit on blazeface output (advisory only).
- Skip the "observability before automation" pattern — log every
  customer step transition to activity_log BEFORE adding any
  drop-off recovery automation that reads from it.
- Touch any Phase 5 admin route, modal, or CRM read path without a
  separate brainstorm. The CRM is now load-bearing for daily founder
  ops; regressions are visible immediately.
- Touch any 4.6 webhook code without a separate brainstorm + plan.
- Hardcode the brand name. Use <brand-name> placeholder until the
  Day 15 brand-locking PR.

Phase 5.x carry-forwards (deliberately deferred — DO NOT pull into
Phase 6 unless the founder explicitly re-prioritises):
- Inline edit of AI fields + /v1/brief/edit-field route
- 2-hour WhatsApp founder alert cron
- 12-hour session-inactivity timeout
- Photo lightbox via /v1/admin/photo-signed-url
- "Resend brief email" recovery action for brief_email_failed
- Restricted-niche flag handling
- Receipt PDF on payment confirmation (was Phase 4.7)
- Modal a11y polish (backdrop click, Esc key, role="dialog")
- Workspace typecheck/lint redundancy cleanup (Task 11 noted
  apps/web pnpm typecheck/lint duplicate the workspace-level
  pnpm -r jobs)

Open follow-up tracked from Phase 5 close:
- supabase-js join firstOrNull helper repeats in 4 sites
  (apps/web/src/app/admin/pending-review + orders/[id] + paid-
  orders + RealtimeQueue). Overdue for extraction to
  apps/web/src/lib/supabase-embed.ts. If Phase 6 adds a 5th site
  (e.g. brief draft resume reads), do the extraction in the same
  PR.
```

---

## Useful one-liners (carry forward as-is)

```bash
# Live stack health
curl -sI https://api.operscale.cloud/v1/health
curl -sI https://operscale.cloud/
curl -sI https://operscale.cloud/admin

# Phase 4 + 4.5 + 4.6 + 5 routes (should all be 401 / 200, real)
curl -X POST https://api.operscale.cloud/v1/brief/analyze \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/brief/approve \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/brief/discard \
  -H 'content-type: application/json' -d '{}'
curl -X POST https://api.operscale.cloud/v1/webhook/paystack \
  -H 'content-type: application/json' -d '{}'

# Phase 5 callback proxy-aware redirect (must NOT show 0.0.0.0 or :3001)
curl -sI https://operscale.cloud/auth/callback | grep -i location
# Expect: Location: https://operscale.cloud/admin?reason=expired

# Local agent (run from apps/agent)
pnpm test
pnpm typecheck
pnpm build:worker

# Local web (run from apps/web)
pnpm test
pnpm typecheck
pnpm build

# Workspace-level (run from repo root)
pnpm -r test
pnpm -r typecheck

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

# Phase 5 live smoke runbook (founder-driven manual steps):
#   docs/runbooks/phase-5-smoke.md
# Phase 5 schema-reality integration test (gated):
cd apps/agent && SMOKE=1 pnpm test phase5-schema

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

# Tail web logs on VPS (Phase 5 added — useful for /auth/callback debug)
PYTHONIOENCODING=utf-8 python -c "
import paramiko
with open(r'c:\Users\DELL\Documents\Antigravity\operscale-calender\.env', encoding='utf-8') as f:
    pw = next(l.split('=', 1)[1].strip() for l in f if l.startswith('server_password='))
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('srv1297445.hstgr.cloud', 22, 'root', pw, timeout=20, allow_agent=False, look_for_keys=False)
_, out, _ = c.exec_command('docker logs --tail=50 operscale-calendar-web 2>&1 | tail -50', timeout=30)
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

# Brand-name grep check (CI runs this on every PR until brand-lock day)
grep -r '<brand-name>' apps/web/src apps/agent/src docs/

# Current branch state
git log --oneline -10
git status --short
```
