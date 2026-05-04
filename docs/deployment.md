# Deployment

How we deploy `operscale-calendar-platform` to production. The same VPS that hosts Vision GridAI and the rest of the Operscale infrastructure.

## Target environment

- **VPS:** `srv1297445.hstgr.cloud` (Hostinger KVM 4)
- **OS:** Ubuntu 24 LTS
- **Container runtime:** Docker 24+ with Docker Compose v2
- **Reverse proxy:** Traefik 3 (already running, with the `traefik` Docker network)
- **TLS:** Let's Encrypt via Traefik's ACME provider

The VPS is a shared multi-service host. We add containers to it; we don't reconfigure it.

## Container images

Two images:

- `operscale-calendar-web:latest` — built from `apps/web/Dockerfile`
- `operscale-calendar-agent:latest` — built from `apps/agent/Dockerfile`

Both are built via `docker build` during deploy. We do NOT push to a registry — the VPS is the only place that runs these. Builds happen on the VPS itself.

## Docker Compose

The compose file lives at `/srv/operscale-calendar/docker-compose.yml` on the VPS:

```yaml
services:
  web:
    container_name: operscale-calendar-web
    image: operscale-calendar-web:latest
    restart: unless-stopped
    env_file: /etc/operscale-calendar/web.env
    networks:
      - traefik
    expose:
      - "3001"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opscal-web.rule=Host(`operscale.cloud`) || Host(`www.operscale.cloud`)"
      - "traefik.http.routers.opscal-web.entrypoints=websecure"
      - "traefik.http.routers.opscal-web.tls.certresolver=lets-encrypt"
      - "traefik.http.services.opscal-web.loadbalancer.server.port=3001"
      - "traefik.docker.network=traefik"

  agent:
    container_name: operscale-calendar-agent
    image: operscale-calendar-agent:latest
    restart: unless-stopped
    env_file: /etc/operscale-calendar/agent.env
    networks:
      - traefik
      - supabase-internal
    expose:
      - "3002"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opscal-agent.rule=Host(`api.operscale.cloud`)"
      - "traefik.http.routers.opscal-agent.entrypoints=websecure"
      - "traefik.http.routers.opscal-agent.tls.certresolver=lets-encrypt"
      - "traefik.http.services.opscal-agent.loadbalancer.server.port=3002"
      - "traefik.docker.network=traefik"

  worker:
    container_name: operscale-calendar-worker
    image: operscale-calendar-agent:latest
    restart: unless-stopped
    command: ["node", "apps/agent/dist/worker.js"]
    env_file: /etc/operscale-calendar/worker.env
    networks:
      - supabase-internal
    deploy:
      replicas: 1

networks:
  traefik:
    external: true
  supabase-internal:
    external: true
```

## Environment files

Live on the VPS, NOT in the repo:

- `/etc/operscale-calendar/web.env` — owner `docker`, mode `600`
- `/etc/operscale-calendar/agent.env` — owner `docker`, mode `600`
- `/etc/operscale-calendar/worker.env` — owner `docker`, mode `600`. Holds `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. **Does NOT** contain `NEXT_PUBLIC_*` keys (they belong to the customer-facing web service only).

Contents covered in `architecture.md` section "Production environment variables".

### Setting them up first time

```bash
sudo mkdir -p /etc/operscale-calendar
sudo chmod 750 /etc/operscale-calendar
sudo chown docker:docker /etc/operscale-calendar
sudo touch /etc/operscale-calendar/web.env /etc/operscale-calendar/agent.env /etc/operscale-calendar/worker.env
sudo chmod 600 /etc/operscale-calendar/*.env
sudo chown docker:docker /etc/operscale-calendar/*.env

# Edit each with the values from the 1Password vault entry
# "Operscale Calendar — production env"
sudo vim /etc/operscale-calendar/web.env
sudo vim /etc/operscale-calendar/agent.env
sudo vim /etc/operscale-calendar/worker.env
```

## Dockerfiles

### `apps/web/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
```

### `apps/agent/Dockerfile`

Similar pattern, port 3002.

Both use Next.js standalone output mode. Configured in each app's `next.config.mjs`:

```typescript
export default { output: 'standalone' };
```

## Deploy flow

The deploy is a single bash script run on the VPS as the docker user.

### `scripts/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run on the VPS, in /srv/operscale-calendar
cd /srv/operscale-calendar

# Pull latest code
git fetch origin main
git reset --hard origin/main

# Verify env files are scoped correctly
./scripts/check-env-scoping.sh || { echo "FAIL: env scoping check"; exit 1; }

# Verify brand-name placeholder coherence
./scripts/check-brand-placeholder.sh || { echo "FAIL: brand check"; exit 1; }

# Build images
docker build -f apps/web/Dockerfile -t operscale-calendar-web:latest .
docker build -f apps/agent/Dockerfile -t operscale-calendar-agent:latest .

# Apply DB migrations (idempotent — Supabase CLI handles already-applied)
supabase db push

# Restart containers
docker compose -f docker-compose.yml up -d --force-recreate

# Smoke test
sleep 5
curl --fail --silent --max-time 10 https://operscale.cloud > /dev/null || { echo "FAIL: web smoke"; exit 1; }
curl --fail --silent --max-time 10 https://api.operscale.cloud/v1/health > /dev/null || { echo "FAIL: agent smoke"; exit 1; }

echo "Deploy OK at $(date)"
```

### `scripts/check-env-scoping.sh`

Verifies that no `NEXT_PUBLIC_` variable contains a service-role key, secret, or token. This is a paranoia check for the gotcha where `NEXT_PUBLIC_` accidentally inlines a secret into the client bundle.

```bash
#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="${1:-/etc/operscale-calendar/web.env}"

if grep -E '^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET|TOKEN|sk_(live|test)|sk-ant)' "$ENV_FILE"; then
  echo "FAIL: found a NEXT_PUBLIC_ variable that looks like a secret"
  exit 1
fi
echo "OK: env scoping looks correct"
```

## DB migrations

Migrations live in `supabase/migrations/`. Numbered, monotonically increasing, immutable once shipped.

`supabase db push` applies any new migrations (skips already-applied). It's idempotent.

If a migration is broken in production:
1. Don't edit the existing migration file. Create a new one that fixes the issue.
2. If the bad migration created a column we need to drop, the new migration drops it.
3. Always test migrations on a clean local DB first.

## Rollback

Rollback procedure if a deploy goes wrong:

```bash
cd /srv/operscale-calendar
git reset --hard <previous-commit-sha>
docker build -f apps/web/Dockerfile -t operscale-calendar-web:latest .
docker build -f apps/agent/Dockerfile -t operscale-calendar-agent:latest .
docker compose up -d --force-recreate
```

DB schema rollbacks are NOT supported by simple revert. If a migration introduced a problem and we need to roll back the schema, we write a new migration that undoes the change. Never delete a migration file from the repo.

## DNS setup (one-off, before launch)

In Cloudflare:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| A | `operscale.cloud` | VPS IP | Proxied |
| CNAME | `www` | `operscale.cloud` | Proxied |
| A | `api` | VPS IP | DNS only |
| MX | `@` | Resend MX records (3 entries) | n/a |
| TXT | `@` | Resend SPF | n/a |
| TXT | `_dmarc` | Resend DMARC policy | n/a |
| TXT (DKIM) | `<rs-key>._domainkey` | Resend DKIM | n/a |

### Why `api.operscale.cloud` is DNS-only (proxy off)

The `api` subdomain serves the agent container that receives Paystack, Resend, and Evolution API webhooks. **Cloudflare proxy must remain off** for this hostname. Two reasons make this load-bearing, not stylistic:

1. **Webhook signature verification operates on the raw request body.** Per `docs/specs/paystack-integration.md`, every Paystack webhook is verified with HMAC-SHA512 over the *exact bytes* Paystack sent us, compared via `crypto.timingSafeEqual` against the `x-paystack-signature` header. The Cloudflare proxy normalises whitespace, recompresses some content types, may modify line endings, and can re-order JSON object keys — any of which silently invalidate the HMAC and produce 401s on legitimate webhooks. We need the bytes Paystack signed to be the bytes our handler reads. DNS-only routing skips the proxy entirely.

2. **Webhook latency budget.** Paystack retries 6 times over 24h on non-2xx responses. Cloudflare adds ~30–80ms per hop and an extra TLS termination round-trip; under the 25-second Paystack ACK timeout this rarely matters, but it eats into the budget for `charge.success` → payment confirmation email/WhatsApp p95 ≤90s (per `CLAUDE.md` "What good looks like in this codebase"). Direct routing keeps the path short.

The marketing apex (`operscale.cloud`) and `www` stay proxied for DDoS protection, caching, and Cloudflare Analytics on the customer-facing site — that traffic is HTML and image responses where proxy modification is harmless. Only the webhook-receiving subdomain needs DNS-only.

If the project later needs Cloudflare features on the `api` subdomain (e.g. WAF rules), the path forward is a separate proxied subdomain (e.g. `apidash.operscale.cloud`) that does *not* receive webhooks. Webhook traffic stays on a DNS-only host.

## TLS

Traefik's Let's Encrypt integration handles TLS automatically. First request to a new domain triggers cert issuance. Renewal happens automatically at 30 days remaining.

If a cert fails to issue:
1. Check Traefik logs: `docker logs traefik`.
2. Common cause: rate limit hit (Let's Encrypt limits 5 dupe certs per week per name). Wait or use DNS challenge.
3. Restart Traefik: `docker restart traefik`.

## Backups

Daily logical pg_dump runs on the VPS at 02:00 WAT:

```bash
#!/usr/bin/env bash
# /etc/cron.daily/pg_backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
pg_dump "$DATABASE_URL" | gzip > /tmp/db-$TIMESTAMP.sql.gz
b2 upload-file backups db-$TIMESTAMP.sql.gz operscale-backups/db-$TIMESTAMP.sql.gz
rm /tmp/db-$TIMESTAMP.sql.gz

# Retention: keep daily for 30 days, weekly for 90 days. b2-cli handles via lifecycle rules.
```

Photos are NOT backed up by design (NDPC retention rules).

## Monitoring

- **UptimeRobot:** pings `operscale.cloud` and `api.operscale.cloud/v1/health` every 5 minutes.
- **Sentry:** error events from both web and agent.
- **Pino → Loki:** structured logs, 30-day retention on the VPS's local Loki instance.

Founder gets WhatsApp alerts on:
- 2 consecutive failed UptimeRobot pings
- 5xx error rate > 0.1% over 5 minutes (Sentry rule)
- Any webhook signature failure

## Logs locations

- Container logs: `docker logs operscale-calendar-web` and `docker logs operscale-calendar-agent`
- Loki / Grafana: `https://logs.operscale.cloud` (existing VG infrastructure)
- Sentry: `https://sentry.io/operscale/operscale-calendar`

## Local dev → staging → prod

Phase 1 has no separate staging environment. Volume doesn't justify it.

The dev cycle:
1. Local dev: `pnpm dev` (web) + `pnpm dev:agent` (agent), Supabase local.
2. Push to a feature branch on GitHub.
3. PR review (founder reviews own PRs in solo mode; future hires would do peer review).
4. Merge to `main`.
5. SSH to VPS, run `./scripts/deploy.sh`.

If volume grows past Phase 1, we add a staging container alongside production using a `*-staging` subdomain.

## What's NOT in this deploy

- CI-driven deploys. We deploy manually for Phase 1 — gives us a beat to think before pushing changes that affect customers.
- Blue/green deploys. Brief downtime acceptable.
- Auto-scaling. Single replica per container.
- Multi-region failover. Out of scope.

## Where to look next

- `docs/architecture.md` — VPS topology, env-var inventory.
- `docs/security.md` — secrets handling.
- `scripts/deploy.sh` — the actual deploy script.
- `docker-compose.yml` — the compose file (lives on VPS, generated from template in repo).
