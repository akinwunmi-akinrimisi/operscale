# ADR 0009: Instant auto-acknowledgement, then founder-approved brief email

**Status:** Accepted, 3 May 2026.

## Context

The founder review-and-approve flow (ADR 0004) means the customer waits up to 1 hour for the personalised brief email. Without managing this expectation, customers will wonder if the form went through, refresh / re-submit, or churn out.

Two options for managing the wait:

A. Send no email until founder approves (1-hour silence).
B. Send an instant auto-acknowledgement at submit, then the personalised brief after founder approval.

## Decision

We send an instant auto-acknowledgement email within 30 seconds of form submission. Template-based, no AI. Frames the wait: "personalised brief within an hour during business hours".

The personalised brief email fires only after founder approval.

## Consequences

- Customer never feels ghosted. Confirmation arrives near-instantly.
- The 1-hour wait is bounded and expected. We measured and 1h is a credible commitment.
- Two emails per submission (auto-ack + brief) — small Resend cost.
- The auto-ack provides a chance to capture additional info: link to resume form, founder WhatsApp link for urgent questions.
- If the auto-ack fails to send (Resend down), the customer's confirmation page on the site already says "you'll get an email shortly" — soft-fallback.
- This is the most consequential UX decision for trust signal in Phase 1.
