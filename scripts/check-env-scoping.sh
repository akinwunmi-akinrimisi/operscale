#!/usr/bin/env bash
# scripts/check-env-scoping.sh
#
# Defends against accidental secret leakage to the browser bundle.
#
# Rule 1 (CLAUDE.md): No NEXT_PUBLIC_*_KEY or NEXT_PUBLIC_*_SECRET names in any
#                     .env.example. NEXT_PUBLIC_* values are SHIPPED to the browser.
# Rule 2 (CLAUDE.md): SUPABASE_SERVICE_ROLE_KEY must NEVER be referenced from any
#                     file under apps/web/src/app/.
# Rule 3 (defensive):  Other server-only env vars (ANTHROPIC_API_KEY, PAYSTACK_SECRET_KEY,
#                     RESEND_API_KEY, EVOLUTION_API_KEY) must NEVER appear under apps/web/src/.
#
# Source: CLAUDE.md "API keys and secrets — non-negotiable rules" + docs/deployment.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

EXIT=0

# --- Rule 1 ----------------------------------------------------------------
echo "→ Rule 1: NEXT_PUBLIC_*_KEY / NEXT_PUBLIC_*_SECRET pattern in any .env.example"
ENV_PATTERN='NEXT_PUBLIC_[A-Z_]*(_KEY|_SECRET|_PRIVATE)'
SUSPECT=$(grep -rIEn "^${ENV_PATTERN}=" --include='.env.example' . || true)
if [[ -n "$SUSPECT" ]]; then
  # Allowlist: variables that look secret-shaped but are browser-safe by design.
  #   * NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY — Paystack inline checkout publishable key
  #   * NEXT_PUBLIC_SUPABASE_ANON_KEY    — Supabase anon JWT; RLS is the real security layer
  # Any other NEXT_PUBLIC_*_KEY / *_SECRET / *_PRIVATE name fails the check.
  FILTERED=$(echo "$SUSPECT" \
    | grep -v 'NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY' \
    | grep -v 'NEXT_PUBLIC_SUPABASE_ANON_KEY' \
    || true)
  if [[ -n "$FILTERED" ]]; then
    echo "::error::Suspect NEXT_PUBLIC_* secret-named variable(s) found:"
    echo "$FILTERED"
    EXIT=1
  fi
fi
echo "  ✓"

# --- Rule 2 ----------------------------------------------------------------
echo "→ Rule 2: SUPABASE_SERVICE_ROLE_KEY referenced only outside apps/web/src/app/"
if [[ -d apps/web/src/app ]]; then
  HITS=$(grep -rIEn 'SUPABASE_SERVICE_ROLE_KEY' apps/web/src/app/ || true)
  if [[ -n "$HITS" ]]; then
    echo "::error::SUPABASE_SERVICE_ROLE_KEY referenced in client-bundleable code:"
    echo "$HITS"
    EXIT=1
  fi
fi
echo "  ✓"

# --- Rule 3 ----------------------------------------------------------------
echo "→ Rule 3: server-only secrets not referenced under apps/web/src/"
SERVER_ONLY_VARS='(ANTHROPIC_API_KEY|PAYSTACK_SECRET_KEY|RESEND_API_KEY|EVOLUTION_API_KEY|SUPABASE_SERVICE_ROLE_KEY)'
if [[ -d apps/web/src ]]; then
  HITS=$(grep -rIEn "process\.env\.${SERVER_ONLY_VARS}" apps/web/src/ || true)
  if [[ -n "$HITS" ]]; then
    echo "::error::Server-only secret env var referenced under apps/web/src/:"
    echo "$HITS"
    EXIT=1
  fi
fi
echo "  ✓"

if [[ $EXIT -ne 0 ]]; then
  echo "::error::Env scoping check failed. See output above."
  exit 1
fi
echo "✓ Env scoping check passed"
