# ADR 0001: Standalone repo for the calendar platform

**Status:** Accepted, 3 May 2026.

## Context

The Operscale Content Calendar service emerged from a pivot in the operscale-video-ads project. We faced a choice: continue building inside the existing `operscale-video-ads` repo, soft-fork it, or create a standalone repo.

## Decision

We create a standalone repo: `operscale-calendar-platform`.

The repo is operationally co-located with Vision GridAI and the existing operscale-video-ads work — same VPS (`srv1297445.hstgr.cloud`), same Supabase project, same Evolution API instance — but it has its own codebase, its own brand surface, its own customer journey, and its own deploy lifecycle.

## Consequences

- Clean separation from the video-ads pivot history. New contributors don't trip over deprecated content-bank-playbook.md or the v1 form structure.
- No risk of accidentally breaking VG when shipping calendar changes.
- Some duplication in shared concerns (CLAUDE.md, security.md, gotchas list) that we accept.
- Two separate doc sets to maintain when shared infra changes (e.g., if we change Evolution API setup, both repos' deployment.md need updates).
- Operationally we gain clarity; mentally the cost is minor since the founder is the only contributor for now.
