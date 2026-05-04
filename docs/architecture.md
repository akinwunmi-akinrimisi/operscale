# Architecture

Phase 1 architecture for the Operscale Content Calendar platform. This document describes the deployment topology, how services talk to each other, and the boundaries between this system and the existing Vision GridAI infrastructure that shares the same VPS.

## Design constraints

These shape every decision below. They are not negotiable.

1. **Same VPS.** This service runs on `srv1297445.hstgr.cloud` (Hostinger KVM 4) — the existing VPS we use for Vision GridAI and Cloudboosta. We do not provision new infrastructure for Phase 1.
2. **Same Supabase project.** New tables sit alongside the existing Vision GridAI tables in the shared Supabase. They do not modify or interfere with VG tables.
3. **Same Evolution API.** WhatsApp goes through the existing Evolution API instance running on the VPS.
4. **Single container per app.** Two containers total: `operscale-calendar-web` and `operscale-calendar-agent`. We resist the urge to split further until volume justifies it.
5. **Stateless containers.** All state lives in Supabase. Containers can be killed and replaced without data loss.
6. **No new domains.** Customer-facing brand is on `operscale.cloud` (locked at Day 15). Webhook subdomain is `api.operscale.cloud`. No multi-region, no preview environments beyond local dev.

## Topology

```
                     Internet
                        |
                  Cloudflare (proxied)
                        |
                  ─────────────────
                  TLS termination
                        |
                  ─────────────────
                  VPS srv1297445
                  Hostinger KVM 4
                        |
                  ─────────────────
                       Traefik
                  (reverse proxy)
                  /            \
                 /              \
   operscale.cloud         api.operscale.cloud
        |                          |
        v                          v
  ┌────────────────┐         ┌──────────────────┐
  │ operscale-     │         │ operscale-       │
  │ calendar-web   │         │ calendar-agent   │
  │ Next.js 15     │         │ Next.js API      │
  │ port 3001      │         │ port 3002        │
  └────────────────┘         └──────────────────┘
        \                          /
         \                        /
          v                      v
          ┌──────────────────────┐
          │ Supabase             │
          │ supabase.operscale   │
          │ .cloud               │
          │ (shared with VG)     │
          └──────────────────────┘
                  |
                  v
        ┌───────────────────┐
        │ External services │
        ├───────────────────┤
        │ Anthropic (Claude)│
        │ Paystack          │
        │ Resend            │
        │ Evolution API     │
        │ (on same VPS)     │
        └───────────────────┘
```

## Container layout

### `operscale-calendar-web`

**Purpose:** marketing site, intake form, internal CRM. The customer-facing surface and the founder-facing admin.

**Image:** `operscale-calendar-web:latest`, built from `apps/web/Dockerfile`.

**Internal port:** 3001

**Routes (via Traefik):**

| Hostname | Path | Routed to |
| --- | --- | --- |
| `operscale.cloud` | `/` | Marketing home |
| `operscale.cloud` | `/pricing` | Pricing page with calendar previews |
| `operscale.cloud` | `/brief/...` | Multi-step intake form |
| `operscale.cloud` | `/payment/return` | Paystack callback |
| `operscale.cloud` | `/admin/*` | Internal CRM (magic-link gated) |

**Why Next.js 15 App Router:** server components for initial render, server actions for form submissions and CRM mutations, route handlers for any client-fetched data. The same patterns we use for Vision GridAI's dashboard.

**State:** none. The container is stateless. All mutable state goes to Supabase.

**Restart policy:** `unless-stopped`. Auto-restarts on container crash.

### `operscale-calendar-agent`

**Purpose:** API endpoints that need server-side privileges (Anthropic API key, Paystack secret, Supabase service-role). Webhook handlers. Async jobs.

**Image:** `operscale-calendar-agent:latest`, built from `apps/agent/Dockerfile`.

**Internal port:** 3002

**Routes (via Traefik):**

| Hostname | Path | Routed to |
| --- | --- | --- |
| `api.operscale.cloud` | `/v1/brief/submit` | Form submission handler |
| `api.operscale.cloud` | `/v1/brief/upload-photo` | Photo upload (signed Supabase Storage write) |
| `api.operscale.cloud` | `/v1/brief/analyze` | AI brief analysis trigger |
| `api.operscale.cloud` | `/v1/brief/reanalyze` | Founder-triggered re-analysis |
| `api.operscale.cloud` | `/v1/brief/edit-field` | Founder inline edit save |
| `api.operscale.cloud` | `/v1/brief/approve` | Founder approve-and-send |
| `api.operscale.cloud` | `/v1/brief/discard` | Founder discard |
| `api.operscale.cloud` | `/v1/payment/initialize` | Paystack initialize call |
| `api.operscale.cloud` | `/v1/webhook/paystack` | Paystack webhook (HMAC-verified) |
| `api.operscale.cloud` | `/v1/admin/photo-delete` | Manual photo deletion (founder-triggered) |
| `api.operscale.cloud` | `/v1/admin/orders` | Admin order list (RLS-protected) |

**Why a separate container from web:** the agent holds secrets the web container must not have access to. Splitting them prevents accidental leakage to client bundles. Also lets us independently scale (or kill) the agent without taking the marketing site down.

**State:** none. Same as web.

**Restart policy:** `unless-stopped`.

## Why one VPS, two containers

We considered three alternatives:

1. **Single container** that does both marketing site and APIs. Rejected because secrets exposure is too easy — one mistake in environment-variable scoping and the Anthropic key is in the client bundle.
2. **Separate VPS for the agent.** Rejected because the volume doesn't justify it, and we already have the VPS we need.
3. **Serverless deployment (Vercel / Cloudflare Workers).** Rejected because we'd duplicate build artifacts, fragmented secrets across two environments, and we already have the muscle-memory for Docker on the VPS. Also avoids vendor lock-in for the marketing site.

The two-container, one-VPS arrangement is the simplest topology that keeps secrets off the customer surface.

## Network topology on the VPS

The VPS already runs:

- `traefik` (reverse proxy, TLS via Let's Encrypt)
- `n8n` (Vision GridAI workflows)
- `supabase` instance (shared Supabase Postgres + Storage + Realtime + Edge Functions)
- `evolution-api` (WhatsApp self-hosted)
- (other VG containers: vision-gridai-web, vision-gridai-agent, etc.)

We add:

- `operscale-calendar-web`
- `operscale-calendar-agent`

All containers share the `traefik` Docker network so Traefik can route to them. The agent container additionally joins the `supabase-internal` network for direct DB access (avoids round-tripping through the public Supabase API where service-role JWT is needed).

## Cloudflare DNS

| Record | Type | Value | Mode |
| --- | --- | --- | --- |
| `operscale.cloud` | A | VPS IP | Proxied |
| `www.operscale.cloud` | CNAME | `operscale.cloud` | Proxied |
| `api.operscale.cloud` | A | VPS IP | DNS only (orange cloud OFF) |

The webhook subdomain is DNS-only because Cloudflare proxying breaks Paystack's webhook IP allowlist if Cloudflare's IPs change. DNS-only also avoids any inadvertent body re-encoding that could break HMAC verification on webhooks.

## TLS

- Let's Encrypt certs issued by Traefik on first request.
- Wildcard cert is NOT used; we use SAN with both apex and webhook subdomain.
- Renewal is automatic via Traefik's ACME provider.
- Cert lifetime: 90 days. Renewal at 30 days remaining.

## Supabase usage

**Project:** `supabase.operscale.cloud` (shared with Vision GridAI, self-hosted on the VPS).

**Schemas:** `public` (default), already populated with VG tables. We add Phase 1 tables to `public` with table names that are unambiguous (e.g., `briefs`, `brief_photos`, `analysis_runs` — all calendar-specific).

**Roles used:**

- `anon` — for the marketing site and form. Strict RLS deny-all by default.
- `authenticated` — for CRM admin users (founder, future reviewer). Magic-link auth issues this role.
- `service_role` — server-side only, used by the agent container. Bypasses RLS.

**Storage buckets:**

- `customer-photos` (private) — face reference photos. RLS denies anon.
- `customer-logos` (private) — uploaded brand logos. RLS denies anon.

**Edge Functions:**

- `photo-retention-sweep` — daily 03:00 WAT cron, deletes photos past their `scheduled_delete_at`.
- `drop-off-recovery` — every 30 min, finds customers in recovery windows and triggers recovery emails / WhatsApp.

**Realtime publication:** `orders`, `payments`, `analysis_runs`, `analysis_edits`, `activity_log`. All five have `REPLICA IDENTITY FULL`.

**Why we don't use a separate Supabase project:** the VG project already has the infrastructure (Edge Functions runtime, Realtime, Storage, magic-link auth). Provisioning a second project would duplicate it. Cross-project queries are not needed.

## Anthropic integration

Used by the agent container only. The Phase 1 use case is the brief analysis prompt (Claude Opus 4.7 with vision blocks).

**Library:** `@anthropic-ai/sdk` for Node.

**Quota:** the Operscale workspace is on the standard pay-as-you-go tier. Estimated daily cost at 30 briefs/day is ~$5 ($0.12 per brief × 30 + a small budget for re-analyses).

**Failure mode:** documented in `AGENT.md` State 2. Retry with exponential backoff, then fallback template + founder alert.

## Paystack integration

Used by both containers, but secrets are agent-only.

**Mode:** Test until launch day. Live keys swap in at the very last step of launch.

**Webhook URL:** `https://api.operscale.cloud/v1/webhook/paystack`. Configured in Paystack dashboard.

**Webhook signature:** HMAC-SHA512 verified on raw request body. See `docs/specs/paystack-integration.md`.

**Currency:** NGN only.

## Resend integration

Used by the agent container only.

**Domain:** `operscale.cloud` verified in Resend (DKIM, SPF, DMARC records configured at Cloudflare).

**Send patterns:**
- Auto-ack: rendered template, fires at form submit (must arrive < 30 seconds).
- Brief email: rendered template populated with founder-approved analysis, fires at approve.
- Payment confirmation: fires on `charge.success` webhook.
- Drop-off recovery: fires from cron Edge Function.

**Inbound:** Resend supports inbound webhooks. We use this to capture customer replies to brief emails (logged in CRM order detail timeline). Inbound parsing runs on the agent container at `/v1/webhook/resend-inbound`.

## Evolution API integration

The same Evolution API instance that Vision GridAI uses. New things for Phase 1:

- A new instance / connection name dedicated to the calendar service: `operscale-calendar`.
- Reuses the existing connected WhatsApp number (the founder's business WhatsApp).

**Send patterns:**
- Payment confirmation WhatsApp: fires on `charge.success`.
- Drop-off recovery WhatsApp: fires from cron at +2h after `payment_initiated`.
- Founder alerts: fires on system events (brief unreviewed > 2h, webhook signature failure, AI analysis failure).

## Local development

Local dev runs all containers on `localhost`:

- `pnpm dev` runs `apps/web` on port 3001.
- `pnpm dev:agent` runs `apps/agent` on port 3002.
- Local Supabase via `supabase start` (Docker), exposes its services on the standard ports.
- Paystack webhooks tunneled via `ngrok` or `cloudflared tunnel` for end-to-end test.

Local environment variables live in `apps/web/.env.local` and `apps/agent/.env.local` (both gitignored). The `.env.example` files in those directories show the variables.

## Production environment variables

Production env files live on the VPS at:

- `/etc/operscale-calendar/web.env` (chmod 600, owner: docker user)
- `/etc/operscale-calendar/agent.env` (chmod 600, owner: docker user)

These are mounted into containers via `--env-file`. They are NEVER committed to the repo, NEVER shared via Slack/email, NEVER copied to a developer's laptop.

The full env var inventory:

### Web container (`web.env`)

```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://supabase.operscale.cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon JWT>
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_...
NEXT_PUBLIC_BRAND_NAME=Operscale
NEXT_PUBLIC_BRAND_DOMAIN=operscale.cloud
NEXT_PUBLIC_FOUNDER_WHATSAPP=+447592233052
SENTRY_DSN=https://<key>@sentry.io/<project>
```

### Agent container (`agent.env`)

```
NODE_ENV=production
SUPABASE_URL=https://supabase.operscale.cloud
SUPABASE_SERVICE_ROLE_KEY=<service-role JWT>
ANTHROPIC_API_KEY=sk-ant-...
PAYSTACK_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
EVOLUTION_API_BASE=http://evolution-api:8080
EVOLUTION_API_KEY=<evolution key>
EVOLUTION_INSTANCE_NAME=operscale-calendar
SENTRY_DSN=https://<key>@sentry.io/<project>
SENTRY_AUTH_TOKEN=<token>
NEXT_PUBLIC_BRAND_DOMAIN=operscale.cloud
NEXT_PUBLIC_FOUNDER_WHATSAPP=+447592233052
```

Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle at build time. Service-role keys, Anthropic keys, Paystack secret keys, and Resend keys MUST NOT be `NEXT_PUBLIC_`.

The deploy script (see `docs/deployment.md`) verifies key scoping before deploy.

## Backups

- **Supabase Postgres:** daily logical `pg_dump` to encrypted S3-compatible storage (Backblaze B2). Retention: 30 days.
- **Supabase Storage (photos and logos):** NOT backed up. By design — photos have NDPC retention rules, backing them up would extend retention beyond what we promised customers.
- **Container images:** rebuilt from source on each deploy, no images backed up.
- **Configuration:** the `/etc/operscale-calendar/*.env` files are backed up to encrypted local storage on the VPS owner's password manager (1Password vault).

## Observability

| Layer | Tool | Retention |
| --- | --- | --- |
| Application logs | Pino → Loki on VPS | 30 days |
| Errors | Sentry | 90 days (free tier) |
| Uptime | UptimeRobot, 5-min ping | indefinite |
| Database events | Supabase logs | 7 days (default) |
| Webhook payloads | `payments.webhook_payload` JSONB column | indefinite (DB row lifetime) |

Founder is alerted via WhatsApp on:
- 5xx error rate > threshold (Sentry rule)
- Uptime check fails for 2 consecutive pings (UptimeRobot)
- Brief unreviewed > 2 hours during business hours (custom rule)
- Webhook signature verification failure (immediate)
- AI analysis failure after 5 retries (immediate)

## What is explicitly NOT built into this architecture

- **Multi-region.** Single VPS, single region (Frankfurt — where srv1297445 lives).
- **Read replicas.** Single Postgres primary handles all reads.
- **CDN for static assets.** Cloudflare proxy fronts the marketing site, which provides edge caching for free.
- **Auto-scaling.** Containers run a single replica. If volume grows, we vertically scale the VPS first.
- **Blue/green deploys.** We deploy by rolling the container — brief downtime acceptable for Phase 1 volume.
- **Service mesh.** Two containers don't need one. Traefik handles all routing.
- **Message queue.** Drop-off cron and async jobs run on Supabase Edge Functions, which is sufficient.
- **Caching layer.** Postgres reads are fast enough at our scale. No Redis.

If volume grows past Phase 1's planned 30 orders/day, we revisit. For now, simplicity is the architecture goal.

## Where to look next

- For deployment specifics: `docs/deployment.md`.
- For schema details: `docs/data-model.md`.
- For security boundaries: `docs/security.md`.
- For why we made these choices: `docs/adr/`.
