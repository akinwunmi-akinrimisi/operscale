# ADR 0007: No customer-facing dashboard

**Status:** Accepted, 3 May 2026.

## Context

Many SaaS-style content services give customers a dashboard to track order status, view past deliveries, message support. This is expected in some categories.

Building a customer dashboard adds: login flow, RLS-locked customer data views, account management, password resets, notification preferences, etc. Each is a non-trivial build.

## Decision

Phase 1 has NO customer-facing dashboard.

Customers interact with us via:
- The marketing site (no login)
- The intake form (no login, save token via email)
- Brief email
- Payment page (Paystack hosted)
- Confirmation email + WhatsApp

Founder views all customer state in the internal CRM.

## Consequences

- Significant build savings (~3-4 weeks of work avoided).
- Customer experience is email + WhatsApp driven. Familiar and intimate.
- We can't expose order status updates programmatically. Founder must manually communicate.
- Customers can't self-serve common requests (refund status, reupload photos, change brand colors). All go through email → manual handling.
- Phase 2 may add a customer dashboard if request volume justifies. Phase 1 explicitly does not.
