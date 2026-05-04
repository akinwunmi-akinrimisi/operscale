# Contributing

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi.
**Last updated:** 2026-05-03.

This document is for anyone — Akinwunmi, Claude Code, future hires — making changes to this codebase or its documentation. The rules are short. Follow them.

## 1. The first principle: docs and reality must agree

If you change behaviour, change the doc. If you can't change both in one commit, change neither.

This isn't bureaucracy. It's the only way the docs stay useful as the system evolves. The moment a doc lies, every future reader stops trusting all the docs.

When you're tempted to skip the doc update because the change is small: the small changes accumulate fastest into doc drift. Update it.

## 2. What to update where

### 2.1 Behaviour changes

If you change how a state transition works, what fields are written, what an email contains, what flag is raised — update the corresponding doc:

- State transitions, customer flow → `docs/customer-journey.md`
- Schema, indexes, RLS → `docs/data-model.md`
- AI prompts, JSON schema → `docs/specs/ai-brief-analysis.md`
- Email bodies → `docs/specs/email-templates.md`
- WhatsApp bodies → `docs/specs/whatsapp-flow.md`
- Founder review UI flows → `docs/specs/founder-review-flow.md`
- Photo handling → `docs/specs/photo-upload-and-retention.md`
- Payment flow → `docs/specs/paystack-integration.md`
- NDPC compliance details → `docs/specs/ndpc-compliance.md`
- Pricing, COGS, mix → `docs/pricing-and-packages.md`, `docs/content-mix-playbook.md`
- CRM operations → `docs/runbooks/crm-runbook.md`

### 2.2 Decisions that have alternatives

If you make a decision that someone might reasonably reverse later, write an ADR. ADRs live in `docs/adr/`. Format: `NNNN-short-name.md`. Sequential numbering. Existing ADRs as templates.

Examples of decisions that need an ADR:
- "We're using X provider over Y for Z."
- "We're not building the customer-facing dashboard until Phase 3."
- "We're keeping carousels bundled rather than as add-ons."

Examples of decisions that don't:
- "We're naming this column `customer_id` not `cust_id`."
- "We're using the existing pattern for Toast component."

The line: if you'd want to know "why did we do this?" six months from now, write the ADR.

### 2.3 New features or subsystems

If you're adding something substantial — a new subsystem, a new integration, a new flow — write a spec doc in `docs/specs/`. Format matches existing specs. Cross-reference from `docs/customer-journey.md` and `docs/data-model.md` as appropriate.

### 2.4 New niche briefs

If we open up to a new niche, add a brief in `niche-briefs/` following the structure of existing briefs. Update:
- The form's niche picker config.
- The AI brief analysis prompt's niche list.
- The calendar preview component's niche list.
- `docs/content-mix-playbook.md` (section 8 — niche-specific adjustments).

## 3. Documentation review checklist

Before merging a PR that changes behaviour, confirm:

- [ ] The relevant doc has been updated in this same PR.
- [ ] The doc's "Last updated" date is current.
- [ ] If a state was added or removed: state diagram updated in `docs/diagrams/customer-journey.mmd`.
- [ ] If a table was added / changed: ER diagram updated in `docs/diagrams/data-model.mmd` AND data-model.md DDL is canonical.
- [ ] If an event type was added: it's in section 5 of `docs/data-model.md` (activity_log taxonomy).
- [ ] If an ADR was needed: it was written.
- [ ] Cross-references in other docs that mention the changed thing have been audited.

This is enforced by `.github/workflows/doc-check.yml` (Phase 1: human-only check; Phase 2: automated).

## 4. Code conventions

Concise list. Most codebases over-document this; ours doesn't need to.

- **TypeScript strict mode.** No `any`.
- **Prettier defaults.** No bikeshedding.
- **Components in `apps/web/src/components/`** — kebab-case file names, PascalCase component names.
- **API routes in `apps/web/src/app/api/`** — one route per file.
- **Database access via service-role client only** for write operations. Never use anon key for writes.
- **Service-role key is in `.env.local`** (gitignored) and `/root/calendar/.env` on the VPS. Never committed.
- **Env vars referenced via `process.env.X`** with a runtime check on startup.
- **Realtime subscriptions in `apps/web/src/hooks/use-realtime-*.ts`** — one hook per channel.
- **Edge Functions in `supabase/functions/`** — one folder per function.
- **Migrations in `supabase/migrations/`** — see `docs/data-model.md` section 10 for ordering rules.

## 5. Commit messages

Conventional Commits-ish. Format:

```
<type>(<scope>): <subject>

<body — what changed and why>

<footer — issue refs if any>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Scope is optional.

Examples:

- `feat(crm): add inline edit to brand_voice block`
- `fix(paystack): handle webhook idempotency on transient 5xx`
- `docs(data-model): document activity_log event taxonomy`
- `refactor(agent): extract photo-resize helper`

Bodies should explain why, not just what. Diffs already show what.

## 6. Pull requests

- One logical change per PR. Don't bundle "fix typo in doc" with "add new payment flow."
- PR description should answer: what, why, how to verify.
- Self-review before requesting review. Read your own diff line by line.
- For Phase 1, the only reviewer is Akinwunmi; the discipline still applies.

## 7. The "I'll fix it later" trap

Don't say "I'll fix the doc later" or "I'll write the ADR later." Later doesn't happen. The PR with the behaviour change is the right moment.

If the doc update is genuinely too big for the same PR (say, a major architectural change), open a follow-up issue immediately and reference it in the behaviour PR. The issue is the commitment.

## 8. Working with Claude Code on docs

Claude Code is a primary contributor. When asking Claude to make a change:

- **Cite the relevant doc(s)** in your prompt. "Update `docs/specs/paystack-integration.md` and the matching code."
- **Ask Claude to verify cross-references** after the change. "After updating data-model.md, check if customer-journey.md still references the columns correctly."
- **Don't skip Claude's doc updates** because they look long. Long doc updates usually mean the change was bigger than it looked.

The `CLAUDE.md` in the repo root is Claude's primary instructions. Updates to that file should be deliberate and PR-reviewed.

## 9. Postmortems

When an incident happens, write a postmortem in `docs/postmortems/YYYY-MM-DD-short-name.md`. Even brief ones.

Template:

```markdown
# Postmortem: <short-name>

**Date:** YYYY-MM-DD
**Severity:** SEV-N
**Duration:** Xm to Ym
**Author:** <name>

## What happened

Plain prose. What did the customer see? What did we see?

## Why it happened

Root cause. Be specific.

## What we did

Timeline of detection, response, resolution.

## What we learned

What's the takeaway? What changes (if any) are we making?

## Action items

- [ ] Specific. Owned. Dated.
```

Postmortems are blameless. We're learning, not assigning fault.

## 10. The five files everyone reads first

When a new contributor (human or AI) joins, send them these five files in order:

1. `README.md` — what this is and how to start.
2. `CLAUDE.md` — methodology and constraints.
3. `docs/architecture.md` — what's built and where it lives.
4. `docs/customer-journey.md` — what happens to a customer end to end.
5. `docs/data-model.md` — the schema everything else writes against.

If you're updating the project and these five would be misleading after your change, your PR isn't done yet.
