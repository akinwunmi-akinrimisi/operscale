# skills.md

Index of every skill installed by `skills.sh`, organised by which stage of the build it applies to. When you (Claude) hit a task, find the stage in this index and use the listed skills. Don't reach outside this list without writing a new ADR.

This index is the contract between `CLAUDE.md` (which references skills by name) and `skills.sh` (which installs them). If you add a skill, update both files.

## How to use a skill

When a skill applies, read its `SKILL.md` file before starting the task. The path is typically `.claude/skills/<owner-skill>/SKILL.md` after `skills.sh` runs (location varies by agent — Claude Code stores them under `~/.claude/skills/`). The skill content is treated as authoritative for that domain.

If a skill conflicts with `CLAUDE.md`, `CLAUDE.md` wins. We've already vetted these skills for fit.

## Quick reference by lifecycle stage

| Stage | Primary skills |
| --- | --- |
| Brainstorming a problem before code | `brainstorming` |
| Planning a non-trivial change | `writing-plans` |
| Executing a plan step-by-step | `executing-plans`, `subagent-driven-development` |
| Building a UI component | `frontend-design`, `vercel-react-best-practices`, `next-best-practices`, `shadcn` |
| Writing or reviewing SQL / schema | `supabase-postgres-best-practices`, `supabase` |
| Writing tests | `test-driven-development`, `playwright-best-practices`, `webapp-testing` |
| Debugging | `systematic-debugging` |
| Reviewing code | `requesting-code-review`, `receiving-code-review` |
| Verifying done | `verification-before-completion` |
| Parallel work | `using-git-worktrees`, `dispatching-parallel-agents` |
| Customer-facing copy | `copywriting`, `content-strategy`, `marketing-psychology` |
| Pricing-page conversion | `page-cro`, `form-cro` |
| Email sequences | `email-sequence` |
| Niche-brief content | `social-content`, `ad-creative` |
| Analytics events | `analytics-tracking` |
| Generating proposal docs | `docx`, `pdf`, `pptx`, `xlsx`, `doc-coauthoring` |
| Brand-style enforcement | `brand-guidelines` |
| Building new skills | `skill-creator`, `mcp-builder`, `writing-skills` |
| Discovering more skills | `find-skills` |

## Methodology skills (Superpowers — `obra/superpowers`)

These define how we work. Reach for them at the named stage and follow them strictly.

### `brainstorming`

Use before any non-trivial feature. Pull stakeholders into ideation; surface assumptions; converge on a direction. Output goes into the GitHub issue or a design doc, NOT directly into code.

### `writing-plans`

Use after brainstorming, before code. Output is a 5-section plan: Goal, Approach, Files touched, Out of scope, Verification. The plan goes in the PR description or issue. CLAUDE.md mandates this for every non-trivial PR.

### `executing-plans`

Use during implementation. Work through the plan one bounded chunk at a time. Re-read the plan between chunks to keep aligned.

### `subagent-driven-development`

Use when a task has 3+ parallelisable subtasks. Delegate each subtask to a focused subagent with its own scoped context. The parent session aggregates outputs.

### `verification-before-completion`

Use before claiming any task done. The check is: end-to-end manual test, log review, scope re-check against the original ask. CLAUDE.md mandates this.

### `systematic-debugging`

Use whenever something breaks. The skill walks through: observe symptom, form hypothesis, test minimally, narrow down. Avoids the trap of "thrash random changes hoping it fixes itself."

### `test-driven-development`

Use for pure logic (validators, parsers, schema transformations, payment-amount calculations). Write test → watch fail → write code → watch pass. Not mandatory for UI/integration but mandatory for these specific kinds of code.

### `using-git-worktrees`

Use when you need to work on two issues in parallel without losing context. Each worktree has its own branch and disk path; you switch between them with `git worktree`.

### `dispatching-parallel-agents`

Use when multiple subagents can work on independent tasks simultaneously. The skill covers safe spawning, context isolation, and result aggregation.

### `requesting-code-review` / `receiving-code-review`

Use when opening a PR or reviewing one. Standard etiquette and structure. Phase 1 is mostly solo, but the skills are installed for when a reviewer joins.

### `writing-skills`

Use only if we're building a NEW skill (which we shouldn't need for Phase 1 — the existing skills cover us). Documents the format and metadata.

### `using-superpowers`

Meta-skill that explains how Superpowers expects to be used. Read once, refresh occasionally.

## UI / frontend skills

### `frontend-design` (`anthropics/skills`)

Mandatory for any React component or UI surface. Covers design tokens, component patterns, the styling discipline we ship under. CLAUDE.md mandates this.

### `vercel-react-best-practices` (`vercel-labs/agent-skills`)

Use for React component architecture, hooks, performance. Pairs with `frontend-design`.

### `web-design-guidelines` (`vercel-labs/agent-skills`)

Use for layout, spacing, typography decisions on the marketing site.

### `vercel-composition-patterns` (`vercel-labs/agent-skills`)

Use for component composition (when to split, when to combine). Useful when refactoring the form steps which share state.

### `next-best-practices` (`vercel-labs/next-skills`)

Use for Next.js 15 App Router patterns: server components vs client components, server actions, streaming, route handlers. Phase 1 makes heavy use of these.

### `shadcn` (`shadcn/ui`)

Use for installing or customising shadcn-ui components. Run via `npx shadcn add <component>` to get a real installation, then style per `frontend-design`.

## Database / schema skills

### `supabase-postgres-best-practices` (`supabase/agent-skills`)

Mandatory for any SQL or schema work. 8 priority categories: query performance, connection management, security & RLS, schema design, concurrency, data access, monitoring, advanced. Read the relevant rule files when writing migrations.

### `supabase` (`supabase/agent-skills`)

General Supabase platform skill — auth flows, Storage, Edge Functions, Realtime. Use for the photo storage bucket setup, magic-link auth, the photo-retention Edge Function, and Realtime publication of CRM tables.

## Testing / debugging skills

### `playwright-cli` (`microsoft/playwright-cli`)

Use to run / install Playwright. We use Playwright for e2e tests on the form (smoke test the 7-step flow) and the CRM (smoke test review-and-approve flow).

### `playwright-best-practices` (`currents-dev/playwright-best-practices-skill`)

Use when writing Playwright tests. Covers selector stability, fixtures, parallelisation, debugging.

### `webapp-testing` (`anthropics/skills`)

Use for general webapp testing strategy — unit vs integration vs e2e split, what to mock, what to verify against real services.

### `sentry-cli` (`sentry/dev`)

Use to wire Sentry into the apps and to query error data via CLI. Phase 1 ships with Sentry on the free tier.

## Content / marketing skills

These are used for: customer-facing copy on the marketing site, brief email content, niche brief markdown files, drop-off recovery emails. Lower priority than methodology skills but useful at specific stages.

### `copywriting` (`coreyhaines31/marketingskills`)

Use when writing customer-facing copy — landing page hero, pricing card descriptions, email body text. Anchored on conversion principles.

### `content-strategy` (`coreyhaines31/marketingskills`)

Use when populating `niche-briefs/<niche>.md` files. Covers angle selection, audience layering, content pillars.

### `social-content` (`coreyhaines31/marketingskills`)

Use specifically for the niche-brief content rhythm patterns — how to vary content across a 7/14/30 day calendar.

### `marketing-psychology` (`coreyhaines31/marketingskills`)

Use for the upsell copy block in the brief email and for objection-handling in drop-off recovery emails.

### `ad-creative` (`coreyhaines31/marketingskills`)

Use for the sample script seeds in the AI brief analysis output. Phase 2 relevance is higher; Phase 1 uses lightly.

### `email-sequence` (`coreyhaines31/marketingskills`)

Use when designing the auto-ack → brief → recovery sequence in `docs/specs/email-templates.md`.

### `page-cro` / `form-cro` (`coreyhaines31/marketingskills`)

Use for the pricing page and the 7-step form. CRO discipline: friction audit, drop-off analysis, A/B test design.

### `analytics-tracking` (`coreyhaines31/marketingskills`)

Use for setting up the `activity_log` event taxonomy and any client-side analytics. Phase 1 uses Supabase activity_log as the canonical event store.

### `claude-vibes-scriptwriting-methodology` (`awesomeskill.ai`)

Use when generating script structure for the AI brief analysis output (`docs/specs/ai-brief-analysis.md`) and the Phase 2 production agent. Covers DR formula, hook stacking, and short-form pacing patterns. Filtered through the convention in ADR 0012 — frameworks are referenced by the name of the framework, never by the name of a marketer. The skill is the toolbox; the names of the people who taught the patterns are not part of the customer's deliverable.

## Document / artifact generation skills

### `docx` (`anthropics/skills`)

Use for generating Word documents — proposals, contracts, the PRD itself. We've used this skill for the PRD that drove this build.

### `pdf` (`anthropics/skills`)

Use for generating PDF artifacts — Phase 2 will use this for the posting calendar PDF in customer delivery; Phase 1 uses it for one-off founder workflow docs.

### `pptx` (`anthropics/skills`)

Use for slide decks — investor updates, partner pitches. Not on the critical path for Phase 1.

### `xlsx` (`anthropics/skills`)

Use for spreadsheet artifacts — financial models, KPI dashboards exported.

### `doc-coauthoring` (`anthropics/skills`)

Use when collaborating on a doc with the user — tracked changes, review etiquette.

### `brand-guidelines` (`anthropics/skills`)

Use when applying brand to surfaces — once the brand is locked at Day 15, this skill covers the consistency check across surfaces.

## Discovery / meta skills

### `find-skills` (`vercel-labs/skills`)

Use when you genuinely need a capability not in this list. The skill walks through searching the skills.sh ecosystem and verifying skill quality before installing. Update `skills.sh` and this file when you add a new one.

### `skill-creator` (`anthropics/skills`)

Use only if we need to build a new skill specific to this codebase. Phase 1 should not need this — the existing skills cover the surface.

### `mcp-builder` (`anthropics/skills`)

Use only if we expose Operscale capabilities as an MCP server. Phase 1 does not. Documented for completeness.

### `writing-skills` (`obra/superpowers`)

Use only when contributing back to the skills.sh ecosystem. Defines the SKILL.md format.

## When NOT to reach for a skill

Sometimes the right answer is to just write the code. Don't reach for a skill when:

- The task is a one-line fix.
- The skill would distract from the actual problem (e.g., reaching for `marketing-psychology` to write a SQL query).
- You've already done this exact task in this session and remember the pattern.

When in doubt, do the simplest thing that the spec describes and move on.

## When to add a new skill

Add a new skill (and update this file + `skills.sh`) when:

1. A capability gap appears repeatedly across two or more sessions.
2. A skill would meaningfully improve quality on a task you're about to do.
3. The user explicitly asks for it.

Process:
1. Run the `find-skills` skill to search the ecosystem.
2. Verify the skill (install count, source reputation, GitHub stars). Don't install anything with <1K installs without a strong reason.
3. Add it to `skills.sh` in the appropriate section.
4. Add it to this file under the appropriate lifecycle stage.
5. Write a one-line ADR if the skill changes how we work (most skills don't).
6. Commit with message: `skills: add <skill-name> for <use case>`.

## Skill versions

Skills are pulled fresh from GitHub on every `skills.sh` run. We do not pin versions — the latest version of a skill is always what we get. If a skill update breaks our workflow, we file an issue upstream and either fork or revert via `npx skills add <owner/repo@hash>`.

## Index complete

That's every skill in the install set. If you reach for something not listed, that's a signal to update this file and `skills.sh`.
