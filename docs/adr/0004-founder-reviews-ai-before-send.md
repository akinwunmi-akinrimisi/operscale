# ADR 0004: Founder reviews and approves every AI brief output before customer send

**Status:** Accepted, 3 May 2026.

## Context

The AI brief analysis service produces customer-facing content. Sending unreviewed AI output risks brand damage (off-brand suggestions, hallucinated details, awkward phrasing) — particularly during the first 50+ orders when the prompt is still being calibrated.

Customers paying ₦150k-₦525k expect human-touched output. Fully-automated competitors charge less.

## Decision

Every brief email is reviewed by the founder before send. AI analysis lands in CRM as `pending_founder_review`. Founder can:

- Approve as-is.
- Edit inline (each edit logged to `analysis_edits`).
- Re-analyze with a free-text note (new `analysis_runs` row, prior one preserved).

Customer receives an instant auto-acknowledgement email at submit time so the wait is framed (target: < 1 hour during business hours).

Every approval is logged with founder identity, timestamp, and the materialised analysis snapshot.

## Consequences

- Customer trust signal: "reviewed by our team" is differentiating.
- Founder time becomes a binding constraint at scale. At 5-15 briefs/day it's 25-75 minutes daily, manageable. At 30+ it's 2.5+ hours daily, which is a hire signal.
- Customer wait time +30 to +60 minutes vs fully-automated. Mitigated by the auto-ack email.
- Rich training-data side effect: every approval/edit/re-analysis is signal for future prompt tuning and (eventually) automation.
- The CRM is the central operational tool. Quality of CRM UX determines reviewer throughput.

## When to reconsider

- If founder review time per brief exceeds 8 minutes median for 30+ days, we redesign the CRM.
- If re-analyze rate exceeds 25% sustained, the prompt needs more iteration before we trust automation.
- If we stay below 10% re-analyze rate for 60+ days, automation handoff is feasible.
