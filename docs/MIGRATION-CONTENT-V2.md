# MIGRATION-CONTENT-V2.md

**Status:** Authoritative migration instruction set.
**Audience:** Claude Code agent (or any AI agent) executing this V2 content migration against an existing Operscale Calendar Platform repo.
**Date:** 2026-05-04.
**Estimated complexity:** Medium. ~24 files touched. ~50K words of content.
**Estimated execution time:** 60-90 minutes for the agent. ~30 minutes for human review of changes.

---

## 0. How to read this file

This document instructs an AI coding agent (Claude Code, or similar) on how to execute the V2 content migration against an existing Operscale Calendar Platform repo. It is intentionally explicit and procedural — it does not assume the agent has read the entire codebase or has memorised the V2 design decisions.

The agent should:

1. Read this file completely before taking any action.
2. Run the pre-flight check in section 2.
3. Execute the migration sequentially per section 4.
4. Run the verification checks in section 6.
5. Stop and report if any abort condition in section 7 is hit.

The agent should NOT:

- Skip the pre-flight check.
- Modify files not in the manifest.
- Delete any file not on the explicit deletion list (which is empty for this migration).
- Modify the schema beyond what section 5 specifies.
- Improvise content beyond what the file plan specifies.

---

## 1. What this migration does (the why, briefly)

V2 introduces three structural changes to the content-generation surface:

1. **A no-fabrication content rule** — formalised in `docs/specs/content-types-allowed.md`. Every framework, archetype, and niche brief obeys it.

2. **A deterministic per-customer framework × archetype seeding system** — formalised in `docs/specs/non-duplication-system.md`. Every brief gets a unique combination of frameworks and archetypes, audit-trailed via a new schema column and a new table.

3. **A four-lens research methodology** — formalised in `docs/specs/research-methodology.md`. Every brief analysis grounds its output in the customer's actual material rather than fabricating.

The migration is **content-only**. No structural change to:
- Customer journey states (`docs/customer-journey.md`).
- Pricing tiers (`docs/pricing-and-packages.md`).
- Runbooks (`docs/runbooks/*.md`).
- Architecture, deployment, or security docs.
- ADRs 0001-0009.

The schema receives one additive column and one additive table — no destructive changes.

---

## 2. Pre-flight check

Before doing anything, the agent verifies the repo state is what this migration expects.

### 2.1 Required directory structure

The agent runs `ls` against the repo root and confirms these directories exist:

```
- docs/
- docs/specs/
- docs/adr/
- docs/runbooks/
- docs/diagrams/
- niche-briefs/
- scripts/
- supabase/
```

If any are missing, the agent **aborts** with: *"Pre-flight check failed: expected directory `<name>` not found. This migration assumes the post-cycle-1 repo state. Re-confirm repo selection."*

### 2.2 Required files (must exist before migration)

The agent confirms these baseline files exist:

```
README.md
CLAUDE.md
AGENT.md
CONTRIBUTING.md
skills.md
skills.sh
docs/architecture.md
docs/implementation.md
docs/security.md
docs/deployment.md
docs/data-model.md
docs/customer-journey.md
docs/pricing-and-packages.md
docs/content-mix-playbook.md
docs/specs/ai-brief-analysis.md
docs/specs/calendar-preview-on-pricing-page.md
docs/specs/email-templates.md
docs/specs/founder-review-flow.md
docs/specs/ndpc-compliance.md
docs/specs/paystack-integration.md
docs/specs/photo-upload-and-retention.md
docs/specs/whatsapp-flow.md
docs/runbooks/crm-runbook.md
docs/runbooks/incident-response.md
docs/runbooks/cost-monitoring.md
docs/adr/0001-standalone-repo.md
docs/adr/0002-fal-as-primary-video-api.md
docs/adr/0003-ugc-cinematic-mix.md
docs/adr/0004-founder-reviews-ai-before-send.md
docs/adr/0005-carousels-bundled.md
docs/adr/0006-customer-photo-collection.md
docs/adr/0007-no-customer-dashboard.md
docs/adr/0008-internal-crm-not-notion.md
docs/adr/0009-instant-auto-ack-then-founder-approval.md
docs/diagrams/customer-journey.mmd
docs/diagrams/founder-review-flow.mmd
docs/diagrams/data-model.mmd
docs/diagrams/photo-lifecycle.mmd
```

If any are missing, the agent **aborts** with: *"Pre-flight check failed: expected baseline file `<path>` not found. Migration cannot proceed."*

### 2.3 Files that MUST already exist post-cycle-1 (V2 docs already shipped)

Cycle 1 of V2 may have already shipped the following files — the agent confirms they exist:

```
docs/specs/script-frameworks.md
docs/specs/angle-archetypes.md
docs/specs/content-types-allowed.md
docs/specs/non-duplication-system.md
docs/specs/research-methodology.md
docs/adr/0010-no-fabrication-content-rule.md
docs/adr/0011-deterministic-per-customer-seeding.md
docs/adr/0012-frameworks-by-name-not-by-marketer.md
docs/adr/0013-trending-deferred-to-phase-2.md
niche-briefs/beauty.md
niche-briefs/real-estate.md
niche-briefs/fashion-ecom.md
niche-briefs/fintech.md
niche-briefs/health.md
niche-briefs/food.md
niche-briefs/education.md
niche-briefs/restricted.md
niche-briefs/_trending.md
```

These are the V2 deliverables already produced. The agent **does not modify** these files unless explicitly noted.

### 2.4 Schema state check

The agent runs against the local Supabase migrations directory:

```bash
ls supabase/migrations/
```

If the migration set ends with a known pre-V2 migration, proceed to section 5. If V2 schema migration already exists (file matches `*_framework_seed_and_history.sql`), the agent skips section 5 and proceeds to section 4 file updates only.

---

## 3. The change manifest

Files in the migration grouped by what kind of change applies:

### 3.1 Files to UPDATE (existing files, content revisions)

| File | Change type | Lines affected (approx) |
|---|---|---|
| `docs/specs/ai-brief-analysis.md` | Major revision | ~80% |
| `docs/data-model.md` | Additive section | +60 lines |
| `docs/content-mix-playbook.md` | Section replacement | ~40% |
| `skills.md` | Additive section | +15 lines |
| `skills.sh` | Additive command | +3 lines |
| `CONTRIBUTING.md` | Additive section | +10 lines |

### 3.2 Files to LEAVE UNTOUCHED

Everything in section 2.2 not listed in 3.1 is left untouched.

### 3.3 Files to DELETE

**None.** This migration is purely additive and replacement. No file is deleted from the working tree.

### 3.4 Files already complete (do not modify)

Section 2.3 files. These were produced in cycle 1 of V2 and are ready as-is.

---

## 4. Per-file change instructions

### 4.1 `docs/specs/ai-brief-analysis.md`

**Why this file changes:** the AI brief analysis prompt was originally written to produce holistic brief analyses without explicit framework/archetype selection. V2 splits the prompt into a 4-layer structure that consumes the new framework + archetype banks and obeys the no-fabrication rule.

**What to keep verbatim:**
- The high-level overview section (introductory paragraph about what brief analysis is for).
- The list of inputs to the prompt.
- The cost/latency notes.
- Cross-reference section.

**What to replace:**
- The prompt structure section — replace with the 4-layer V2 prompt structure described below.
- The output format section — replace with the V2 output JSON shape (matches `docs/specs/research-methodology.md` section 7).
- Any references to "founder origin story" or "customer transformation" — remove or re-cast as observational.

**The V2 prompt structure (4 layers):**

```
LAYER 1 — System framing
  - Operscale Calendar overview
  - The no-fabrication rule (explicit summary)
  - The four-lens research methodology (summary)
  - Output schema

LAYER 2 — Customer corpus
  - Form payload (all 7 steps)
  - Reference posts (pasted + URL-fetched)
  - Photo aesthetic extraction (vision pass output)
  - Niche brief (loaded from niche-briefs/<niche>.md)

LAYER 3 — Selection inputs
  - framework_seed (computed by the application before the prompt runs)
  - archetype_seed (same)
  - The relevant excerpts from script-frameworks.md and angle-archetypes.md
    for the selected pairs
  - Re-analysis context (if applicable: founder note, prior runs)

LAYER 4 — Generation instructions
  - Run the four lenses in order
  - Compose the brief analysis output JSON
  - Run the fabrication-risk audit on every line
  - Flag any uncertainty for founder review
```

**Forbidden phrases that must NOT survive in the V2 version:**
- "founder origin story"
- "customer transformation"
- "in the style of [marketer]"
- "make up a believable backstory"
- Any phrase that instructs the AI to fabricate

**Verification:** after writing, the agent runs `grep -i "origin story\|transformation\|in the style of" docs/specs/ai-brief-analysis.md`. Output should be empty or limited to phrases that explicitly forbid these (e.g. "does not produce origin stories").

### 4.2 `docs/data-model.md`

**Why this file changes:** the schema gains one column on the existing `analysis_runs` table and one new `customer_framework_history` table.

**What to keep verbatim:** everything except the additive section described below.

**What to add:** at the end of the analysis_runs table description, append the column. At the end of the table list, append the new table.

**Additive content to append:**

```markdown
### `analysis_runs.framework_seed` (added in V2 content migration)

JSONB column added to support the deterministic per-customer framework × archetype seeding system (see `docs/specs/non-duplication-system.md`). Stores the seed inputs, hash, selected frameworks, selected archetypes, selected pairs, and exhaustion / LRU flags for each analysis run.

Example contents documented in `docs/specs/non-duplication-system.md` section 5.

### `customer_framework_history` (added in V2 content migration)

Tracks every (framework, archetype) pair ever delivered to a customer (i.e. approved by the founder). Used to ensure no pair repeats for a returning customer until the bank exhausts.

Schema:

```sql
create table customer_framework_history (
  customer_id     uuid not null references customers(id) on delete restrict,
  order_id        uuid not null references orders(id) on delete restrict,
  framework_slot  text not null,
  archetype_slot  text not null,
  used_at         timestamptz default now(),
  primary key (customer_id, framework_slot, archetype_slot)
);

create index customer_framework_history_customer_idx
  on customer_framework_history (customer_id);

create index customer_framework_history_order_idx
  on customer_framework_history (order_id);
```

**When rows are written:** when the founder approves an analysis run (`founder_approved` event). Re-analyses do not write rows; only approval does.

**ON DELETE RESTRICT:** rows survive customer deletion via NDPC anonymisation (the customer_id is set to a sentinel UUID rather than the row being dropped) — see section 9 for details.
```

**Verification:** after writing, the agent runs `grep -c "framework_seed\|customer_framework_history" docs/data-model.md`. Output should show ≥ 4 occurrences.

### 4.3 `docs/content-mix-playbook.md`

**Why this file changes:** the original playbook organised content arcs around founder-narrative archetypes ("Week 1: founder story, Week 2: customer transformation"). V2 reorganises arcs around frameworks and observational archetypes.

**What to keep verbatim:**
- The overall playbook overview.
- The 60/40 UGC/T2V mix section (this is a locked design decision).
- The carousel bundling section.
- Cross-reference section.

**What to replace:**
- Any section titled or covering "founder origin / Week 1 founder story" → replace with framework-driven arcs.
- Any section covering "customer transformation Week" → replace with category-level outcome content driven by Outcome Showcase + Behind-the-Work archetypes (no specific named customers).

**The V2 arc structure (replacement content):**

```markdown
## Calendar arc structure (V2)

The calendar isn't a random pile of videos — it has rhythm. V2 organises rhythm by framework family rather than founder narrative.

### Starter (7 videos, 1 week)

A 7-day calendar uses 3 frameworks and 3 archetypes (per `docs/specs/non-duplication-system.md`). The arc:

- Day 1-2: Educational anchor. Educational Breakdown / Quick-Win / Numbered List frameworks. Pricing Breakdown or Decoded Jargon archetypes. Establishes expertise.
- Day 3-4: Direct response or persuasive. PAS / DR Formula / Myth-Buster / Cost Reveal frameworks. Insider Checklist / Common Mistake archetypes. Drives consideration.
- Day 5: Quality moment / Behind-the-Work T2V. Outcome Showcase or Quality Moment archetype. Aspirational anchor.
- Day 6: Social proof at category level (Industry Pattern or Market Reality archetype) — never named-customer testimonials.
- Day 7: CTA-strong close. DR Formula or Value Equation framework. Use-Case Spotlight archetype.

### Standard (14 videos, 2 weeks)

5 frameworks, 5 archetypes. The arc adds:

- One additional educational anchor in week 2.
- One additional T2V quality moment in week 2.
- A Comparison or Decision Framework piece.
- A Hidden Trap or Cost of Inaction piece.

### Calendar (30 videos, full month)

8 frameworks, 8 archetypes. The arc operates on weekly mini-arcs:

- Week 1: foundation — heavy educational, moderate direct response.
- Week 2: depth — process tours, quality tells, decoded jargon.
- Week 3: persuasion — myth-busters, comparisons, cost reveals.
- Week 4: aspiration + close — outcome showcases, use-case spotlights, CTA-strong direct response.

Each week has its own internal rhythm (educational → persuasive → aspirational → CTA).
```

**Forbidden phrases that must NOT survive in the V2 version:**
- "Week 1: founder story"
- "founder origin"
- "customer transformation Week"
- "Sarah's journey" (or any specific name pattern)

**Verification:** the agent runs `grep -i "founder origin\|founder story\|customer transformation" docs/content-mix-playbook.md`. Output should be empty.

### 4.4 `skills.md`

**Why this file changes:** V2 adds the awesomeskill.ai scriptwriting-methodology skill to the install set.

**What to add:** at the end of the marketing skills section, append:

```markdown
- **Scriptwriting methodology** (`awesomeskill.ai/skill/claude-vibes-scriptwriting-methodology`) — DR formula and hook-stacking patterns, filtered through the convention in ADR 0012 (frameworks by name of framework, not by name of marketer).
```

### 4.5 `skills.sh`

**Why this file changes:** the install script needs the new skill.

**What to add:** at the end of the install loop:

```bash
# Scriptwriting methodology (awesomeskill.ai)
plugin marketplace add awesomeskill-ai/scriptwriting-methodology
plugin install claude-vibes-scriptwriting-methodology@awesomeskill-ai
```

### 4.6 `CONTRIBUTING.md`

**Why this file changes:** the "files everyone reads first" list grows with V2 docs.

**What to add:** in the section listing required reading for new contributors, append the V2 docs:

```markdown
For anyone working on content generation specifically, the V2 doc set is required reading before any content-generation code change:

- `docs/specs/content-types-allowed.md` — the no-fabrication rule.
- `docs/specs/script-frameworks.md` — the framework bank.
- `docs/specs/angle-archetypes.md` — the archetype bank.
- `docs/specs/non-duplication-system.md` — the deterministic seeding system.
- `docs/specs/research-methodology.md` — the four-lens methodology.

Plus all niche briefs in `niche-briefs/` for the niche your work touches.
```

---

## 5. Schema migration

Run after section 4 file updates are complete.

### 5.1 Migration filename

```
supabase/migrations/0005_framework_seed_and_history.sql
```

The project's migration naming convention is `NNNN_<slug>.sql` with a four-digit zero-padded prefix. Existing migrations are `0001_initial_schema.sql` through `0004_*`, so this V2 migration takes `0005`. (An earlier draft of this document incorrectly suggested a `YYYYMMDDHHMMSS` timestamp prefix; that was an authoring error and is corrected here. Future migrations continue the four-digit sequence.)

### 5.2 Migration content

```sql
-- V2 content migration: add framework_seed column to analysis_runs
-- and create customer_framework_history table for non-duplication system.
-- See docs/specs/non-duplication-system.md for full spec.
--
-- RLS policy convention follows 0001_initial_schema.sql:
--   - Restrictive deny-all for the `anon` role.
--   - Permissive policies for the `authenticated` role gated on
--     `auth.jwt() ->> 'role' = 'founder'`.
--   - Read and write paths split.

begin;

-- Add the framework_seed column to analysis_runs.
alter table analysis_runs
  add column if not exists framework_seed jsonb;

comment on column analysis_runs.framework_seed is
  'JSONB containing seed_hash, seed_inputs, selected_frameworks, selected_archetypes, selected_pairs, exhaustion_warning, lru_fallback_used. See docs/specs/non-duplication-system.md.';

-- Create the customer_framework_history table.
create table if not exists customer_framework_history (
  customer_id     uuid not null references customers(id) on delete restrict,
  order_id        uuid not null references orders(id) on delete restrict,
  framework_slot  text not null,
  archetype_slot  text not null,
  used_at         timestamptz default now(),
  primary key (customer_id, framework_slot, archetype_slot)
);

create index if not exists customer_framework_history_customer_idx
  on customer_framework_history (customer_id);

create index if not exists customer_framework_history_order_idx
  on customer_framework_history (order_id);

comment on table customer_framework_history is
  'Tracks every (framework, archetype) pair delivered to a customer via founder-approved analysis runs. Used to ensure no pair repeats for a returning customer until the bank exhausts. See docs/specs/non-duplication-system.md.';

-- Row-level security.
alter table customer_framework_history enable row level security;

create policy customer_framework_history_anon_deny
  on customer_framework_history
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

create policy customer_framework_history_founder_read
  on customer_framework_history
  for select
  to authenticated
  using (auth.jwt() ->> 'role' = 'founder');

create policy customer_framework_history_founder_insert
  on customer_framework_history
  for insert
  to authenticated
  with check (auth.jwt() ->> 'role' = 'founder');

-- No update or delete policies: the table is append-only by design.
-- NDPC anonymisation re-points customer_id to a sentinel UUID rather than
-- deleting rows; that procedure runs as a privileged migration, not via RLS.

commit;
```

### 5.3 Rollback statement

If the migration needs to be rolled back:

```sql
begin;

drop policy if exists customer_framework_history_founder_insert on customer_framework_history;
drop policy if exists customer_framework_history_founder_read on customer_framework_history;
drop policy if exists customer_framework_history_anon_deny on customer_framework_history;

drop index if exists customer_framework_history_order_idx;
drop index if exists customer_framework_history_customer_idx;
drop table if exists customer_framework_history;

alter table analysis_runs drop column if exists framework_seed;

commit;
```

The rollback is destructive of `customer_framework_history` rows — only run after backing up.

### 5.4 Application of the migration

The agent does NOT auto-apply this migration to a live database. The agent writes the migration file and reports: *"Migration file written. Apply manually via `supabase db push` or your migration tooling. Do not auto-apply against staging or production without human review."*

---

## 6. Verification

After all file updates and the migration file is written, the agent runs the following checks:

### 6.1 Forbidden phrase scan

Run across all updated and newly-created content files:

```bash
# These phrases must NOT appear in the V2 docs (except in this MIGRATION file
# which discusses them as forbidden) or in niche briefs as positive examples.

grep -rn "my grandmother's\|my mother taught me\|when I was a student\|three years ago I\|I started this brand because" \
  docs/specs/ai-brief-analysis.md \
  docs/content-mix-playbook.md \
  niche-briefs/

# Also forbidden in those files:
grep -rn "Customer transformation:\|Sarah's journey\|Tomi went from\|in the style of " \
  docs/specs/ai-brief-analysis.md \
  docs/content-mix-playbook.md \
  niche-briefs/
```

Expected output: empty.

If any line shows up, the agent reports it and **does not finalise** until the file is corrected.

### 6.2 Required reference scan

Confirm each niche brief references the V2 spec docs:

```bash
for f in niche-briefs/*.md; do
  if [ "$f" = "niche-briefs/_trending.md" ]; then continue; fi
  echo "=== $f ==="
  grep -c "content-types-allowed.md\|script-frameworks.md\|angle-archetypes.md\|research-methodology.md" "$f"
done
```

Expected output: each niche brief shows ≥ 4 occurrences (the cross-references section).

### 6.3 ADR completeness scan

Confirm all 4 V2 ADRs exist with correct status:

```bash
for adr in 0010 0011 0012 0013; do
  ls docs/adr/${adr}-*.md
  grep "Status: Accepted" docs/adr/${adr}-*.md
done
```

Expected: all 4 ADRs present with "Status: Accepted".

### 6.4 Schema migration syntactic check

```bash
# Confirm the migration file contains both the alter table and create table.
grep "alter table analysis_runs" supabase/migrations/*framework_seed*.sql
grep "create table.*customer_framework_history" supabase/migrations/*framework_seed*.sql
```

Expected: both lines found.

### 6.5 Cross-reference integrity scan

For every doc that references another V2 doc, confirm the target exists:

```bash
# Pull all referenced V2 doc paths and confirm they exist.
grep -rn "docs/specs/script-frameworks.md\|docs/specs/angle-archetypes.md\|docs/specs/non-duplication-system.md\|docs/specs/research-methodology.md\|docs/specs/content-types-allowed.md" \
  docs/ niche-briefs/ | head -20

# Confirm those paths actually exist:
for f in docs/specs/script-frameworks.md docs/specs/angle-archetypes.md docs/specs/non-duplication-system.md docs/specs/research-methodology.md docs/specs/content-types-allowed.md; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: all "OK".

### 6.6 No deletions occurred

```bash
# Confirm none of the protected baseline files were deleted.
for f in docs/customer-journey.md docs/pricing-and-packages.md docs/data-model.md \
         docs/architecture.md docs/security.md docs/deployment.md \
         docs/runbooks/crm-runbook.md docs/runbooks/incident-response.md docs/runbooks/cost-monitoring.md \
         docs/adr/0001-standalone-repo.md docs/adr/0002-fal-as-primary-video-api.md \
         docs/adr/0003-ugc-cinematic-mix.md docs/adr/0004-founder-reviews-ai-before-send.md \
         docs/adr/0005-carousels-bundled.md docs/adr/0006-customer-photo-collection.md \
         docs/adr/0007-no-customer-dashboard.md docs/adr/0008-internal-crm-not-notion.md \
         docs/adr/0009-instant-auto-ack-then-founder-approval.md; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: all "OK".

---

## 7. Abort conditions

The agent stops the migration immediately if any of the following occur:

1. Pre-flight check fails (section 2).
2. Any baseline file from section 2.2 is missing.
3. Any V2 doc from section 2.3 is missing **and** the agent cannot regenerate it from the source-of-truth content in this migration file. (This migration file does not contain the full text of all V2 docs; if cycle 1 V2 docs are missing, the agent reports and stops.)
4. A forbidden phrase is found in a non-allowed file during section 6.1.
5. A required cross-reference target doesn't exist (section 6.5).
6. The schema migration syntactic check fails (section 6.4).
7. Any protected file from section 6.6 is missing.

When aborting, the agent:

- Reverts any partial changes in the working tree (`git checkout -- <changed files>` if git is available; otherwise reports which files were modified).
- Does not apply the schema migration.
- Reports the specific abort condition hit and what it found.

---

## 8. The explicit no-deletions list

This list documents files the migration **must not delete or restructure**, even though they may seem related to V2 content changes. The agent should never delete or substantively rewrite these:

| File | Why it stays untouched |
|---|---|
| `docs/customer-journey.md` | The 9-state journey is locked. V2 is content-only. |
| `docs/pricing-and-packages.md` | Tier structure (Starter / Standard / Calendar) is locked. |
| `docs/data-model.md` | Only ADDITIVE changes per section 4.2. |
| `docs/architecture.md` | Infrastructure decisions are locked. |
| `docs/security.md` | Security posture is unaffected by content migration. |
| `docs/deployment.md` | Deployment process unchanged. |
| `docs/implementation.md` | The 22-day plan is locked. |
| `docs/specs/founder-review-flow.md` | Re-analyze button additions go through this file separately if needed; for V2 content migration, untouched. |
| `docs/specs/paystack-integration.md` | Payment flow unchanged. |
| `docs/specs/photo-upload-and-retention.md` | Photo handling unchanged. |
| `docs/specs/whatsapp-flow.md` | Outreach flow unchanged. |
| `docs/specs/ndpc-compliance.md` | Compliance posture unchanged. |
| `docs/specs/email-templates.md` | Email templates unchanged in V2. |
| `docs/specs/calendar-preview-on-pricing-page.md` | Pricing page preview unchanged. |
| All runbooks | Operator processes unchanged. |
| ADRs 0001-0009 | Existing decisions unchanged. |
| Diagrams | Unchanged. |

---

## 9. Post-migration checklist for the human

After the agent completes successfully, the human reviewer should:

1. Run a full `git diff` and read every change.
2. Confirm no protected file was modified beyond the additive sections in section 4.
3. Apply the schema migration to staging first; verify it succeeds.
4. Run the `framework-selector` unit tests (when they exist — these will be created in the implementation cycle, not this content migration).
5. Apply the schema migration to production after staging verification.
6. Update the team / contributors via the standard channel about the V2 doc set.
7. Note any documentation gaps discovered during review and address in a follow-up PR per `CONTRIBUTING.md` rule #1.

---

## 10. Migration vocabulary

For clarity, when this document says:

- **"V2 docs"** — the content-generation spec files added or rewritten in this migration.
- **"V1"** — the pre-V2 state. (The original cycle-1 docs that have founder-narrative arcs.)
- **"Cycle 1 of V2"** — the initial wave that produced the foundational specs (script-frameworks, angle-archetypes, content-types-allowed, non-duplication-system, research-methodology) and the niche brief rewrites.
- **"This migration"** — the full V2 migration, of which this file is the master instruction set.
- **"The bank"** — the 25 frameworks × 25 archetypes = 625 unique pairs.
- **"The seed"** — the deterministic hash that drives selection.
- **"LRU fallback"** — least-recently-used pair re-use when the bank exhausts for a customer.

---

## 11. If the agent has questions

If during execution the agent encounters genuinely ambiguous instructions or believes a section of this migration file is incorrect, the agent does NOT improvise. The agent stops and reports:

*"Migration paused at section X. Specific concern: [detail]. Recommended action: human review before proceeding."*

The agent does not attempt to "be helpful" by exceeding the explicit instructions in this file.

---

## 12. Done state

The migration is complete when:

- All files in section 3.1 have been updated as specified in section 4.
- All verification checks in section 6 pass.
- The schema migration file is written (not applied) per section 5.
- The agent reports a summary of files touched, with diff stats.

At that point, the V2 content migration is structurally complete and ready for human review.
