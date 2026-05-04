#!/usr/bin/env bash
# scripts/deploy.sh
#
# Phase 1 deploy script. Lives in repo as the canonical version; the running
# copy lives at /srv/operscale-calendar/scripts/deploy.sh on the VPS and is
# refreshed via `git fetch && git reset --hard origin/main` during deploy.
#
# This is a STUB at scaffold time. Real implementation lands during Day 15
# (brand lock + first prod deploy) per docs/implementation.md.
#
# Source: docs/deployment.md "Deploy flow → scripts/deploy.sh".

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "→ Operscale Calendar deploy"
echo "  repo:   $REPO_ROOT"
echo "  user:   $(whoami)"
echo "  host:   $(hostname)"

# ---- Pre-flight checks ----
echo "→ Verifying chmod 600 on production env files"
for envfile in /etc/operscale-calendar/web.env /etc/operscale-calendar/agent.env; do
  if [[ ! -f "$envfile" ]]; then
    echo "::error::Missing $envfile"
    exit 1
  fi
  perms=$(stat -c '%a' "$envfile" 2>/dev/null || stat -f '%Lp' "$envfile")
  if [[ "$perms" != "600" ]]; then
    echo "::error::$envfile must be chmod 600 (currently $perms)"
    exit 1
  fi
done

echo "→ Brand placeholder check"
bash scripts/check-brand-placeholder.sh

echo "→ Env scoping check"
bash scripts/check-env-scoping.sh

# ---- Real implementation pending ----
# TODO(Operscale): full deploy per docs/deployment.md "Deploy flow":
#   1. git fetch origin main && git reset --hard origin/main
#   2. docker build -f apps/web/Dockerfile   -t operscale-calendar-web:latest   .
#   3. docker build -f apps/agent/Dockerfile -t operscale-calendar-agent:latest .
#   4. supabase db push  (apply migrations)
#   5. docker compose -f /srv/operscale-calendar/docker-compose.yml up -d --force-recreate
#   6. curl -fsS https://operscale.cloud               | head -c 200
#   7. curl -fsS https://api.operscale.cloud/v1/health | head -c 200

echo "✓ Pre-flight checks passed (deploy proper not yet implemented)"
