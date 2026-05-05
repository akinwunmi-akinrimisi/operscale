# Nightly Claude smoke — runbook

The L3 nightly smoke runs at 02:00 UTC daily via GitHub Actions
(`.github/workflows/nightly-smoke.yml`). It calls real Claude Opus 4.7
against the frozen `initial-fashion-tier-2` fixture and asserts the
SupersetOutput shape + cost ceiling.

## When it fails

1. Check the auto-opened issue (label `nightly-smoke`). The body links
   the workflow run.
2. Read the failure mode:
   - **slot_count_mismatch** — model drift; cassette re-record may be
     needed (see Phase 2 Task 14 pattern).
   - **schema_mismatch / unauthorized_slot** — spec drift; check whether
     `ai-brief-analysis.md` §3.4 was edited without updating the
     orchestrator.
   - **claude_5xx_max_retries** — Anthropic outage; usually self-heals
     by next night. Re-run via `workflow_dispatch` after a few hours.
   - **cost > $1.00** — token usage spiked unexpectedly. Inspect the
     output length; may indicate the model is verbose or the prompt
     leaked size.
3. Triage in #operscale-eng (founder-only channel) before re-running
   manually.

## Cost budget

~$0.40 per run × 30 days = ~$12/month. Tracked under design §8.1.

## Required GitHub repo secret

**MANUAL PREREQ**: `ANTHROPIC_API_KEY` must be set as a GitHub Actions
repo secret BEFORE the first scheduled run at 02:00 UTC.

Steps:
1. Go to the repo on GitHub.
2. Settings → Secrets and variables → Actions → New repository secret.
3. Name: `ANTHROPIC_API_KEY`, Value: the Anthropic key.
4. Save.

The smoke runner (`scripts/run-smoke-tests.mjs`) aborts with exit code 1
and a clear error message if the secret is absent — this triggers the
failure-issue workflow step, so you will get an issue opened on the first
run if the secret has not been set.

The secret rotates quarterly per CLAUDE.md secrets rule 5.
