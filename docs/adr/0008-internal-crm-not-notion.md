# ADR 0008: Build the internal CRM into the app, not in Notion

**Status:** Accepted, 3 May 2026.

## Context

We could run the founder's review workflow on a low-code platform (Notion, Airtable, Linear) by syncing data from Supabase. Or we could build the CRM as part of the app at `/admin/*`.

Notion path: faster to start, but every action requires a custom integration (clicking "approve" in Notion has to fire the email — needs Zapier or custom webhook).

In-app path: more upfront build, but actions are direct (clicking "approve" runs the actual code).

## Decision

The CRM is a first-class part of the app at `apps/web/src/app/admin/*`. Magic-link auth gates it.

## Consequences

- Founder actions are direct: clicking "Approve and send" actually triggers the email send. No Zapier indirection.
- Real-time updates via Supabase Realtime work natively.
- Build cost: ~3-4 days of focused work for the CRM (Days 8-12 in the plan).
- We control the UX — designed specifically for the review-and-approve workflow, not adapted from a generic tool.
- Future reviewers (post-founder) get a cleaner onboarding (sign in, pick from queue) than learning a Notion-based ad-hoc system.
- Some operational reports might still benefit from a Notion or Sheets export. We allow that as a manual periodic export, not as a live integration.
