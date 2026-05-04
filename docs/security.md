# Security

Security model for Operscale Content Calendar Phase 1. This document covers trust boundaries, secret handling, the JWT auth chain, photo handling, NDPC compliance, and the rules everyone follows.

If you're about to commit something that touches any of: auth, secrets, customer data, payment data — read this first.

## Threat model (the things we actively defend against)

We are NOT defending against nation-state actors. We are defending against:

1. **Accidental key leakage** by the developer (us). Hardcoded keys in repo, keys in committed `.env` files, keys printed to logs.
2. **Accidental customer data leakage** through misconfigured RLS or signed URLs that don't expire.
3. **Webhook spoofing** — someone pretending to be Paystack to mark unpaid orders as paid.
4. **Replay attacks** on webhooks — legitimate webhook replayed maliciously to double-trigger downstream.
5. **PII compliance failures** under NDPC — failure to honour deletion requests, retention overruns, photos shared without consent.
6. **CSRF / form abuse** — attacker submitting forms on behalf of a logged-in user.
7. **Bot-driven form spam** — fake submissions wasting Anthropic spend.

We accept (and document) the risk of:

- Loss of the VPS (single point of failure). Mitigation: Supabase backups daily, can rebuild containers from source within an hour.
- Compromise of the founder's email (which gates the CRM). Mitigation: 2FA on the founder email; treat it as the highest-value credential.
- Compromise of the Anthropic key (which costs us money but doesn't expose customer data). Mitigation: budget alerts; rotate quarterly.

## Trust boundaries

These are the boundaries we enforce. Each boundary has rules.

### Boundary 1: Browser ↔ Web container

**The browser is hostile.** Treat every request from a browser as potentially malicious until validated.

Rules:
- Every form input is server-side validated. Client-side validation is for UX only.
- Every server action checks auth before mutating data.
- Customer-facing endpoints use the `anon` Supabase role (RLS-locked).
- Admin endpoints (CRM) require `authenticated` role plus an allowlist check on the user's email.
- No `service_role` keys are ever shipped to the browser. They live only in agent container env.
- CSRF protection on all mutation endpoints. Next.js server actions have built-in CSRF protection via origin checks; we rely on it but verify.

### Boundary 2: Web container ↔ Agent container

The agent container has more privileges than the web container (Anthropic key, Paystack secret, Supabase service-role).

Rules:
- Web → Agent calls authenticated via signed JWT (Supabase auth token from the user). Agent verifies the token.
- Agent never blindly trusts a web-submitted user_id; always re-derives from the verified JWT.
- Agent runs in an isolated Docker network. Outside-VPS traffic only via Traefik proxy.
- Agent restarts do not lose state; all state is in Supabase.

### Boundary 3: Agent container ↔ Supabase

Agent uses the service-role key. This bypasses RLS — the agent can read or write anything.

Rules:
- Service-role key lives only in `/etc/operscale-calendar/agent.env`, chmod 600.
- Agent code uses service-role via a single `supabaseAdmin` instance imported from `apps/agent/src/lib/supabase-admin.ts`. No other place in the codebase imports the service-role key.
- Every agent endpoint that mutates data on behalf of a customer takes a customer_id parameter and validates that the customer's auth token matches before mutating.

### Boundary 4: External webhook callers ↔ Agent container

Paystack and Resend send us webhooks. We trust nothing until verified.

Rules:
- Paystack webhooks: HMAC-SHA512 verified on raw request body BEFORE any JSON parsing. Reject (401) if signature invalid. See `docs/specs/paystack-integration.md`.
- Resend webhooks: signed similarly, verify before trust.
- All webhook handlers are idempotent (UNIQUE constraints + lookup-before-insert).
- Webhook handlers return 200 within 3 seconds; heavy work happens async.
- Failed signatures get a 401 and an alert — we want to know if someone's probing.

### Boundary 5: Customer ↔ Their own data

A customer should be able to see their own data, never another customer's.

Rules in Phase 1: customers don't have accounts, so there's no customer-facing data view. The save token is the single piece of data they "own" — and it's only used to resume a draft form.
Rules for Phase 2: customer dashboards (if we ever add them — we currently don't plan to) MUST use RLS policies keyed on `customer_id = auth.uid()`. Service-role bypass paths NEVER touch customer dashboards.

## Secrets inventory

| Secret | Where | Who can read |
| --- | --- | --- |
| Supabase anon JWT | Web `.env`, public client bundle | Everyone |
| Supabase service-role JWT | Agent `.env` and Worker `.env`, both chmod 600 | Agent and Worker containers only |
| Anthropic API key | Agent `.env` and Worker `.env` | Agent and Worker containers only |
| Paystack public key | Web `.env`, public client bundle | Everyone |
| Paystack secret key | Agent `.env` | Agent container only |
| Resend API key | Agent `.env` | Agent container only |
| Evolution API key | Agent `.env` | Agent container only |
| Sentry DSN | Both web and agent `.env` | Public-facing (Sentry DSNs are not sensitive) |
| Sentry auth token | Agent `.env` only | Agent container only |
| Paystack webhook signature key | Same as Paystack secret key | Agent container only |

### Rotation cadence

- Paystack secret: only on suspected compromise. Rotation is a 5-step procedure (update Paystack dashboard, update agent env, deploy, verify webhook, retire old key).
- Anthropic key: quarterly. Same procedure.
- Resend key: on team changes (when a team member with knowledge leaves).
- Supabase service-role: only on Supabase auth-key rotation events (rare).

### Rotation procedure (general)

1. Generate new key in the upstream provider.
2. Add new key to `agent.env` alongside the old one as `OLD_KEY_NAME=...`.
3. Update code to use the new key.
4. Deploy.
5. Verify the new key works end-to-end.
6. Remove old key from upstream provider.
7. Remove `OLD_KEY_NAME` from `agent.env`.
8. Redeploy.

### Hard rules

- **No keys in code.** Pre-commit hook in `skills.sh` blocks committed Paystack and Anthropic keys.
- **No keys in logs.** Pino logger is configured to redact fields named `*_KEY`, `*_SECRET`, `*_TOKEN`, `password`, `card_*`.
- **No keys in error messages** returned to the client. Errors are sanitised before they leave the agent container.
- **No keys in Sentry events.** Sentry SDK is configured with `beforeSend` that scrubs known sensitive paths.

## JWT auth chain

Phase 1 has 5 sync points (per gotcha #5 in CLAUDE.md):

```
[Customer browser]
        |
        | (anon JWT, signed by Supabase)
        v
[Web container — server actions verify anon JWT]
        |
        | (forwarded JWT for admin actions; service role JWT for agent calls)
        v
[Agent container — verifies forwarded JWT, uses service-role for DB writes]
        |
        | (service-role JWT)
        v
[Supabase Postgres — RLS bypass via service-role]
        |
        | (no JWT — direct connection)
        v
[Postgres backend]
```

For admin (CRM) operations:

```
[Founder browser]
        |
        | (authenticated JWT via magic link)
        v
[Web container — verifies JWT, checks email allowlist]
        |
        | (admin JWT forwarded)
        v
[Agent container — verifies admin JWT, then uses service-role]
        |
        v
[Supabase]
```

If any one JWT in this chain is rotated without rotating the others, the chain breaks silently — symptoms look like one specific service is broken but the actual issue is auth mismatch. Document every rotation and its verification step.

**Phase 3 adds a 6th sync point: the worker container.** As of Phase 3, `worker.env` holds its own copies of `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (separate file from `agent.env`, chmod 600 at `/etc/operscale-calendar/worker.env`). When rotating either of those keys, update all three files — `agent.env`, `worker.env`, and the upstream provider — in the same deployment. Rotating one without the other produces the same silent-401 failure mode described above. The rotation procedure in the "Rotation procedure (general)" section applies; add `worker.env` as an additional step alongside `agent.env`.

## RLS lockdown

We default-deny everything for `anon`. Every table that exposes data to the customer must have explicit RLS policies.

### Default-deny pattern

For every new table, the migration includes:

```sql
ALTER TABLE foo ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon. Service role bypasses RLS automatically.
```

If we want anon to have specific access, we add policies explicitly. We do NOT use permissive defaults.

### Phase 1 RLS rules

| Table | anon | authenticated (admin) | service_role |
| --- | --- | --- | --- |
| `customers` | DENY | SELECT (admin allowlist) | ALL |
| `briefs` | DENY (writes via agent endpoint) | SELECT | ALL |
| `brief_photos` | DENY | SELECT (signed URLs only) | ALL |
| `brief_consent` | DENY | SELECT | ALL |
| `analysis_runs` | DENY | SELECT, UPDATE (via inline edits) | ALL |
| `analysis_edits` | DENY | INSERT, SELECT | ALL |
| `orders` | DENY | SELECT, UPDATE | ALL |
| `payments` | DENY | SELECT | ALL |
| `activity_log` | DENY | SELECT | ALL |

Customers do not directly read from any of these tables. All reads happen through the agent's API endpoints (which use service-role).

### Storage bucket policies

- `customer-photos`: anon = no access, authenticated = no access (admin reads only via signed URLs from agent), service_role = full.
- `customer-logos`: same as `customer-photos`.

The signed-URL pattern: when the CRM needs to display a photo, it asks the agent to generate a signed URL with 5-minute expiry. The URL is rendered in the page; after 5 minutes it returns 403.

## Webhook security details

### Paystack HMAC-SHA512 verification

```typescript
// apps/agent/src/api/v1/webhook/paystack/route.ts (sketch)
import crypto from 'crypto';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  // CRITICAL: read raw body BEFORE any JSON parsing.
  // Re-parsing reformats whitespace and breaks HMAC.
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';

  const computed = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks.
  const sigBuf = Buffer.from(signature, 'hex');
  const compBuf = Buffer.from(computed, 'hex');
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
    // Log signature mismatch for ops alert.
    return new Response('', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  // Dispatch by event type. Idempotency on paystack_tx_ref UNIQUE.
}
```

Failure modes:

- Signature mismatch → 401, founder alert (treats as potential probe).
- Duplicate webhook (same `paystack_tx_ref`) → 200, idempotency makes it a no-op.
- Malformed JSON after signature passes → 200 (we accepted the payload but logged the parse failure for review).

## NDPC compliance

We register as a Data Controller with the Nigeria Data Protection Commission before launch.

### Data we collect from customers

- Email, name, business name, WhatsApp number — for service delivery and billing.
- Brand details (logo, colors, sample posts) — for the brief.
- Face photos (up to 3, optional) — for custom AI avatar in Phase 2.
- Payment metadata (Paystack reference, amount, payment method) — never raw card data.

### Customer rights we surface in the privacy policy

- Right to access — request a JSON export of their data.
- Right to delete — request deletion of all their data.
- Right to correct — request correction of any data we hold.
- Right to data portability — same as access; we provide JSON.
- Right to withdraw consent — particularly for photo storage; triggers immediate deletion.

### Phase 1 implementation of these rights

All five rights are handled manually in Phase 1:

- Customer emails `privacy@operscale.cloud`.
- Founder responds within 72 hours.
- Founder runs the appropriate SQL or storage delete.
- Founder confirms back to the customer.

Phase 2 may add self-service endpoints. Phase 1 does not, by choice — the volume is too low to justify the build, and human-touch on privacy requests is a quality signal.

### Photo retention

Photos auto-delete:
- 90 days after `orders.delivered_at` (the success path)
- 30 days after `brief_photos.uploaded_at` if no order materialises (the abandoned-form path)

Daily cron Edge Function `photo-retention-sweep` enforces this. See `docs/specs/photo-upload-and-retention.md` for full lifecycle.

## Logging and observability — security-aware

### What we log

- Every state transition in the customer journey (`activity_log`).
- Every API call to Anthropic (cost, tokens, duration) (`llm_calls` table).
- Every webhook received (full payload in `payments.webhook_payload`).
- Every founder action in the CRM (writes to `analysis_edits`, `activity_log`).
- Every error (Sentry).

### What we DO NOT log

- Raw card details. Paystack handles this.
- Customer passwords. We don't have customer passwords (no customer accounts in Phase 1).
- Photo file contents. We log the path and metadata, never the bytes.
- WhatsApp message bodies (only sender, recipient, status — the content is in the message itself).
- API keys, JWTs, secrets. The Pino logger redacts these.

### Where logs live

- Application logs: Loki on the VPS, 30-day retention.
- Sentry: 90-day retention on the free tier.
- Database events: Supabase logs, 7 days.
- Activity log (the canonical audit trail): forever, in `activity_log` table. We never delete from this table.

## Founder credentials and access

The founder has the highest-level credentials in this system:
- Supabase project owner
- Anthropic workspace admin
- Paystack business owner
- Resend admin
- Evolution API admin
- Hostinger VPS root
- Cloudflare account owner
- 1Password vault owner (where all the above credentials are stored)

Compromise of the founder's primary email account would compromise all of these. Therefore:

- 2FA enabled on every account that supports it.
- Recovery codes for each are stored in 1Password.
- Founder email account itself has 2FA via authenticator app, NOT SMS (SIM swap risk in Nigeria).
- 1Password vault password is unique, long, and never re-used.

Phase 1 does not have a documented "founder is unavailable" recovery path. This is a known gap. Mitigation: a designated trusted person (named in the founder's will) holds an emergency 1Password recovery sheet in a sealed envelope.

## Incident response — the playbook

If something looks wrong, the first 5 minutes matter.

### Symptom: webhook signature failures spiking

1. Check Sentry for the actual signatures that failed.
2. Check Paystack dashboard — is there an upstream issue?
3. If looks like an attack (signatures don't match any pattern), block the source IP at Cloudflare temporarily.
4. If looks like a Paystack-side change (e.g., they rotated their webhook secret), update agent env and redeploy.

### Symptom: customer reports they can't pay

1. Look up the order in the CRM. Find their last activity_log event.
2. If `payment_initiated` but no follow-up: check Paystack dashboard for the transaction. Customer may have abandoned or the bank may have declined.
3. If no `payment_initiated`: check the brief_email_sent_at — did they get the email? Check Resend logs.
4. Send a manual WhatsApp from the CRM action panel.

### Symptom: customer requests deletion

1. Acknowledge within 24 hours via email.
2. Run the deletion SQL: delete from `customers` cascades to `briefs`, `brief_photos`, `brief_consent`, `analysis_runs`, `analysis_edits`, `orders`, `payments`, `activity_log`.
3. Run the storage deletion: delete files at `customer-photos/<customer_id>/*` and `customer-logos/<customer_id>/*`.
4. Confirm back to the customer with a deletion timestamp.
5. Log the action in a separate `privacy_actions` audit log (not in `activity_log` because the activity_log entries are themselves deleted).

### Symptom: leaked secret detected (e.g., a key was committed)

1. Rotate the key immediately at the upstream provider.
2. Update agent env on the VPS.
3. Redeploy.
4. `git filter-branch` or `git filter-repo` to scrub the leaked key from history. Force-push.
5. Force every collaborator to re-clone.
6. Document the incident in a private postmortem.

## Audit log retention

The `activity_log` table is append-only. We never DELETE from it. We never UPDATE it (only INSERT). This is the canonical audit trail.

If a customer requests deletion, the customer's records (customers, briefs, photos, etc.) are deleted, but the `activity_log` rows referring to them are retained — anonymised by setting their order_id and customer_id to NULL but preserving the event type and timestamp. This is for our own audit needs (proving we processed valid orders, proving we honoured deletion requests).

## Where to look next

- `docs/specs/paystack-integration.md` for the full Paystack security details.
- `docs/specs/photo-upload-and-retention.md` for photo lifecycle including retention.
- `docs/specs/ndpc-compliance.md` for the registration filing checklist.
- `docs/data-model.md` for RLS policy specifics in the schema.
