# CLAUDE.md

This is the operating doc for Claude Code sessions working on the Operscale Content Calendar Platform. Read this in full before doing anything else. The patterns and constraints documented here are a result of months of iteration on adjacent projects (Vision GridAI, Cloudboosta) — they are not preferences, they are load-bearing.

## How to use this document

If you (Claude) are starting a session, read this top-to-bottom once. The "Methodology", "Locked stack", "Inherited gotchas", and "Build discipline" sections matter most. Then read `AGENT.md` for the state machine, then `skills.md` for the skills index. Then pick up the actual task.

If a section here conflicts with something the user says in the current session, ask the user to confirm before deviating. Do not silently override.

## What we are building

Phase 1 of a content calendar service for Nigerian SMBs. The deliverable, end-to-end, is: customer arrives → fills form → gets auto-ack email → AI analyzes brief → founder reviews and approves in CRM → customer gets brief email + payment link → pays via Paystack → order moves to `paid` → Phase 2 production picks up.

We are NOT building Phase 2 (video and carousel production) in this repo. Phase 2 lives in a separate repo, will be specified in a separate PRD, and will not be touched here. If a task seems to require Phase 2 capability, it is out of scope for this build.

## Methodology

### Superpowers is the primary build pattern

This repo uses [obra/superpowers](https://github.com/obra/superpowers) for build methodology. The skills you care about most:

- `brainstorming` — for figuring out what to build before writing a line of code
- `writing-plans` — for converting a brainstorm into an executable plan with checkpoints
- `executing-plans` — for working through the plan one bounded chunk at a time
- `subagent-driven-development` — for delegating sub-tasks to focused subagents
- `verification-before-completion` — never claim a task is done until it actually works end-to-end
- `systematic-debugging` — for figuring out what's wrong without thrashing
- `test-driven-development` — write the test, watch it fail, write the code, watch it pass
- `using-git-worktrees` — for parallel work without breaking the main checkout

These are installed via `skills.sh`. See `skills.md` for the full index of what each does.

### gstack is selectively used

We use a small slice of [gstack](https://github.com/gstack-dev/gstack) — specifically only `/qa`, `/browse`, `/careful`, `/freeze`, and `/review`. The planning commands from gstack conflict with Superpowers' planning model, so we do NOT use them. If you reach for `/plan` or `/spec` from gstack, stop — use Superpowers' `writing-plans` instead.

### frontend-design is auto-applied for UI

Any React component, any Tailwind layout, any UI surface — read `anthropics/skills` `frontend-design` first. It covers design tokens, component patterns, the styling constraints we ship under. We do not invent new design tokens; we use the ones the skill defines.

### DOE framework for AGENT.md

`AGENT.md` is structured Directive → Observation → Experiment. Every state has a directive (what should happen), observations (what we watch for to know it happened), and experiments (the tests that prove it works). When you add a new state or modify an existing one in the state machine, preserve this structure.

### GSD is deprecated

Do not install or reference GSD. It conflicts with Superpowers and adds noise. If a doc or comment mentions GSD, it is wrong — flag and remove.

## Locked stack

These choices are locked. Do not propose alternatives without an ADR.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 15, App Router | Same as VG fork, fast iteration |
| UI | Tailwind + shadcn-ui | Same as VG fork |
| Backend API | Next.js API routes (Node 20) | Co-located with web for simpler deploy |
| Database | Supabase Postgres (shared with VG) | Already running, zero new infra |
| AI | Anthropic Claude Opus 4.7 with vision | Best for structured output and image analysis |
| Email | Resend | Best DX, generous free tier |
| WhatsApp | Evolution API (existing instance) | Free, reliable, sends from real number |
| Payment | Paystack | NGN-native, low fees, hosted checkout |
| DNS / TLS | Cloudflare proxied + Traefik | Same as VG, free TLS via Let's Encrypt |
| Hosting | Hostinger KVM 4 VPS `srv1297445` | Already exists, shared with VG |
| Auth (CRM) | Supabase magic-link | No password management |
| Photo storage | Supabase Storage, private bucket | RLS-locked |
| Photo quality check | tfjs blazeface (browser-side) | Advisory, not blocking |
| Monitoring | Sentry + UptimeRobot + Loki | Free tiers sufficient for Phase 1 |
| Build methodology | Superpowers + gstack-light + frontend-design | See methodology section |

If a task requires anything outside this list, write an ADR explaining why before adding the dependency.

## Brand placeholder rules

The customer-facing brand name is not locked yet. Until it is locked (Day 15 of build), every customer-facing surface uses the placeholder `<brand-name>`. This includes:

- Marketing site copy
- Email subject lines and bodies
- WhatsApp message templates
- Privacy policy and terms
- Domain references (use `<brand-name>.com` everywhere)
- Documentation that quotes user-facing strings

CI runs a grep check on every PR: `grep -r '<brand-name>' apps/web/src apps/agent/src` must return matches in expected places, AND a separate check verifies the placeholder is NOT present in any code path that has been brand-locked. The brand-locking process is a single PR that does the search-replace and ships.

Do not invent a brand name. Do not commit a real brand name in any non-placeholder location. The placeholder convention exists so we can flip the brand once with confidence.

## API keys and secrets — non-negotiable rules

1. **Never hardcode keys** in plain text. Not in code files, not in workflow JSON, not in committed config. Use environment variables.
2. **`.env*` files are gitignored**. The repo includes `.env.example` files showing the variable names; the actual values live on the VPS.
3. **Service-role keys are server-side only**. Never reference `SUPABASE_SERVICE_ROLE_KEY` from any file under `apps/web/src/app/` (which can run client-side). Service role usage lives in `apps/agent/src/` or in server actions explicitly marked.
4. **`chmod 600` on production .env files**. Verified by deploy script.
5. **Rotation cadence**: Paystack secret rotates if compromised, Anthropic keys rotate quarterly, Resend rotates on team changes.
6. **Webhook secrets are different from API secrets**. Paystack signs webhooks with the secret key; the comparison is HMAC-SHA512 on raw body.

If you see a hardcoded key in any file you touch, fix it before continuing the original task. Treat it as a build-blocker.

## Inherited gotchas

These bit us on Vision GridAI. They will bite us here if we forget. Add new gotchas as we discover them.

### 1. localhost vs IPv6 in Node 20+

`fetch('http://localhost:3001/...')` resolves to `::1` (IPv6) in Node 20+ but most services bind only to IPv4 `127.0.0.1`. Symptom: connection refused, looks like the service is down.
**Fix:** use `http://127.0.0.1:3001` explicitly, or set `NODE_OPTIONS=--dns-result-order=ipv4first`.

### 2. Missing `=` in n8n expression syntax

In n8n, expressions starting with `{{` are evaluated only when the node parameter is set to "Expression" mode. If you paste `{{ $json.foo }}` into a Fixed-mode field, n8n treats it as literal text. Symptom: workflow runs and writes the literal string `{{ $json.foo }}` into Postgres.
**Fix:** ensure the field mode is Expression. The leading `=` in the saved JSON node config is the marker.

### 3. FFmpeg fps mismatch silently truncates output

Stitching clips with different frame rates and re-encoding without explicit `-r` produces a video shorter than the inputs combined. Symptom: 4×8s clips → 28s output, not 32s. Audio is also truncated to match.
**Fix:** force a target fps on every concat: `-r 24` on output, and `-vf "fps=24"` on each input filter chain.

### 4. Supabase Realtime needs REPLICA IDENTITY FULL

Tables published to Realtime must have `REPLICA IDENTITY FULL`. Without it, Realtime emits incomplete payloads on UPDATE — only the changed columns, not the full row. Symptom: CRM shows stale data after an update.
**Fix:** in every migration that creates a Realtime-published table, run `ALTER TABLE foo REPLICA IDENTITY FULL;`. Also verify with `\d+ foo` in psql.

### 5. JWT chain has 5 sync points (with operscale agent container)

Anthropic API → agent container → Next.js web → Supabase → Postgres. Each hop has its own auth token or key. If any one is rotated without rotating the others, the chain breaks silently. Symptom: 401 errors that look like "Anthropic auth failed" but are actually Supabase service-role rejection.
**Fix:** rotation is a 5-step procedure documented in `docs/security.md`. Don't rotate one in isolation.

### 6. Music volume default is 0.12, not 0.5

If we mix music behind narration (Phase 2 concern), default music volume in FFmpeg's `amix` is too loud. We learned to set `volume=0.12` on the music input before mixing. Symptom: customers say "music is too loud".
**Fix:** `[1:a]volume=0.12[mus]; [0:a][mus]amix=inputs=2:duration=first` — `0.12`, not `0.5`.

### 7. Caption-burn 3-hour timeout host-side

If a caption-burn job runs more than 3 hours on a host, the kernel OOM-kills it (memory leak in libass with very long videos). Phase 1 doesn't burn captions. Phase 2 does. Carry forward.

### 8. fal.ai async queue limits

fal.ai has a per-account concurrency cap (15-25 concurrent jobs by default). Phase 1 doesn't use fal.ai (no rendering). But the Phase 1 brief analysis does call Claude in parallel for batch — if we ever batch 25+ briefs we will hit Claude rate limits.
**Fix:** queue brief analyses; max 5 in-flight at any time.

### 9. NODE_FUNCTION_ALLOW_BUILTIN=child_process

n8n's Function and Function Item nodes block the `child_process` builtin by default. If we ever spawn FFmpeg from n8n (Phase 2), need this env var. Carry forward.

### 10. Audio is master clock

In Phase 2 video assembly, the audio track is the master clock; video is fitted to it. Symptom of getting it backwards: a/v drift accumulating as the video plays.
**Fix:** when stitching, use `-shortest` only when audio matches; otherwise pad video to match audio explicitly.

### 11. Scene-by-scene Supabase writes (not bulk)

We learned to write each scene/state transition as it completes, not at end-of-pipeline. Symptom of bulk writes: when the pipeline crashes mid-flight, we lose all progress and can't resume.
**Fix:** every state transition writes to `activity_log` immediately. Idempotency keys on every write.

### 12. caption_highlight_word CHECK constraint

In the VG fork schema, the `caption_highlight_word` column has a CHECK constraint that enforces specific colour values. Phase 1 doesn't have captions but the constraint pattern is good — if you add a column that takes a small enum of valid values, use a CHECK constraint, not application-side validation.

## Build discipline

These are non-negotiable practices for every PR.

### Plan before code

Use Superpowers' `writing-plans` skill before any non-trivial change. The plan goes in a comment on the issue or in the PR description. The plan has:

- Goal (one sentence)
- Approach (3-5 bullet points)
- Files touched (explicit list)
- Out of scope (what we are NOT doing in this PR)
- Verification (how we'll know it works)

If the plan can't fit in those five sections, the change is too big — split it.

### Verify before claiming done

Superpowers' `verification-before-completion` skill is mandatory. Every claim of "this is done" requires:

- Manual end-to-end test of the changed flow on a local or staging env
- Logs reviewed for unexpected errors
- The original issue/spec re-read to confirm scope was met (not exceeded, not under-met)

If any of these turn up problems, the task is not done.

### Test-driven where it makes sense

For pure logic (validation, parsing, schema transformations, payment-amount calculations), write the test first. Watch it fail. Write the code. Watch it pass.

For UI components and integration code (form steps, webhook handlers), tests are useful but not mandatory upfront. We have webapp-testing skill installed for Playwright-based smoke tests post-build.

### Commits stay small and described

One logical change per commit. Commit message format:
```
<scope>: <imperative one-line summary>

<optional body explaining why, not what>
<optional reference to issue or ADR>
```

Example: `form: persist save token to Supabase after step 3`

### No shortcut: never disable, mock or fallback to make it work; we want the real thing working in real-time/live

If something doesn't work, find out why. Don't add a `try/catch` that swallows the error. Don't comment out the failing line. Don't add a feature flag that turns off the broken thing. The bug is information; suppressing it costs us next week.

If you genuinely cannot fix it in the current session, mark it with `// TODO(brand-name): broken because X, see issue #N`, file an issue, and surface it in the session summary.

### Brand-name grep check before merging

CI runs `grep -r '<brand-name>' apps/web/src apps/agent/src docs/`. PRs that change customer-facing surfaces must show this grep still finds the placeholder in the right places. If the brand has been locked (post Day 15), CI runs a different grep verifying `<brand-name>` is NOT present anywhere customer-facing.

### Schema changes are immutable migrations

`supabase/migrations/` files are immutable once shipped. To change a schema, write a new migration. Never edit an old one. Migrations are numbered and applied in order. The numbering scheme is `NNN_descriptive_slug.sql` where `NNN` is monotonically increasing (zero-padded).

### Observability before automation

Before automating any flow (e.g., the photo retention sweep, drop-off recovery emails), we log first, then automate. If the logs don't show the right events firing manually, automation will hide bugs. The pattern: implement it as a manual trigger, watch the logs over a few real cases, then add the cron.

## File ownership

| Path | Owner |
| --- | --- |
| `apps/web/src/app/admin/` | Founder workflows. Touch carefully. |
| `apps/web/src/app/brief/` | Customer-facing form. Test on real mobile devices. |
| `apps/agent/src/api/webhook/` | Webhook handlers. Idempotency is mandatory. |
| `apps/agent/src/lib/claude.ts` | AI brief analysis. The prompt itself is the spec — see `docs/specs/ai-brief-analysis.md`. |
| `supabase/migrations/` | Schema. Immutable once shipped. |
| `niche-briefs/` | Operational knowledge per niche. Updated as we learn. |
| `docs/adr/` | Append-only. ADRs are not edited; they are superseded by new ones. |

## What "good" looks like in this codebase

- The form completion rate is ≥ 35% within 60 days of launch.
- Photo opt-in rate is ≥ 40%.
- Founder review time per brief median ≤ 5 minutes.
- AI brief analysis p95 latency ≤ 180 seconds.
- Brief email delivery time post-submission p95 ≤ 60 minutes during business hours.
- WhatsApp delivery latency post-payment ≤ 90 seconds.
- Refund rate ≤ 5%.
- No hardcoded API keys in any file. Ever.
- No raw card data ever touches our infrastructure.
- Brand-name grep check passes before merge on every PR until launch.

If a change you're considering would push any of these the wrong way, stop and write down why.

## When to escalate to the user

Escalate (ask the user before proceeding) when:

1. A task requires changing the locked stack.
2. A task requires touching shared infrastructure (the VPS, the Supabase project) in a way other Operscale services depend on.
3. NDPC compliance is affected (data retention, customer rights, deletion).
4. A test reveals a Phase 2 dependency that wasn't planned for.
5. A spec under `docs/specs/` is internally inconsistent with another spec or with `AGENT.md`.

Do not silently work around any of these. The escalation costs less than the rework.

## When NOT to escalate

You can act without asking when:

1. The change is within scope of the current task and consistent with this CLAUDE.md.
2. A bug fix is obvious and small.
3. A doc clarification doesn't change behaviour.
4. Test additions on existing code paths.
5. Renaming variables for clarity (within a single PR's scope).

## Out of scope (will be a Phase 2 problem, do not solve here)

- Video script generation
- HeyGen avatar creation from photos
- Video render pipeline (Veo, Seedance, Kling, etc.)
- Carousel image generation (Ideogram)
- FFmpeg stitching and caption burn
- Customer-facing approval gates for production
- Customer delivery package
- Subscription / recurring billing
- Customer site / Instagram scraping
- Multi-currency support
- Customer-facing analytics

If you find yourself building any of these, you're in the wrong repo. Stop.
