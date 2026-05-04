#!/usr/bin/env bash
# scripts/check-brand-placeholder.sh
#
# Two-mode brand-placeholder check, run on every PR by .github/workflows/ci.yml.
#
# Mode A (pre-lock, default until Day 15 of the build):
#   The placeholder `<brand-name>` MUST appear in every customer-facing surface
#   (apps/web/src/app/, apps/web/src/emails/, docs that quote user-facing strings).
#   Build fails if the placeholder is missing where it should be.
#
# Mode B (post-lock):
#   The placeholder MUST NOT appear anywhere customer-facing.
#   Build fails if any `<brand-name>` slips through after the lock PR.
#
# Mode is selected by the BRAND_LOCKED env var (set in CI when the lock PR ships).
#
# Source: CLAUDE.md "Brand placeholder rules" + "Brand-name grep check before merging".

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BRAND_LOCKED="${BRAND_LOCKED:-false}"

# Surfaces that must (or must not) contain the placeholder.
SURFACES=(
  "apps/web/src/app"
  "apps/web/src/emails"
  "apps/agent/src"
  "docs"
)

if [[ "$BRAND_LOCKED" == "true" ]]; then
  echo "→ Brand-locked mode: verifying <brand-name> is NOT present in customer-facing code"
  FOUND=0
  for surface in "${SURFACES[@]}"; do
    if [[ ! -d "$surface" ]]; then
      continue
    fi
    if grep -rIl --exclude-dir=node_modules --exclude-dir=.next '<brand-name>' "$surface"; then
      FOUND=1
    fi
  done
  if [[ $FOUND -ne 0 ]]; then
    echo "::error::Brand placeholder still present after lock"
    exit 1
  fi
  echo "✓ No <brand-name> placeholders remain"
  exit 0
fi

echo "→ Pre-lock mode: verifying <brand-name> is present in expected surfaces"

EXPECTED_PATHS=(
  "apps/web/src/app/page.tsx"
  "apps/web/src/app/layout.tsx"
  "apps/web/src/app/privacy/page.tsx"
  "apps/web/src/app/terms/page.tsx"
  "apps/web/src/lib/consent.ts"
  "apps/web/.env.example"
  "apps/agent/.env.example"
)

MISSING=0
for path in "${EXPECTED_PATHS[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "  - SKIP (file does not exist): $path"
    continue
  fi
  if ! grep -q '<brand-name>' "$path"; then
    echo "::error file=$path::expected <brand-name> placeholder, none found"
    MISSING=1
  else
    echo "  ✓ $path"
  fi
done

if [[ $MISSING -ne 0 ]]; then
  echo "::error::Brand placeholder missing in one or more expected surfaces"
  exit 1
fi

echo "✓ Brand placeholder present in all expected surfaces"
