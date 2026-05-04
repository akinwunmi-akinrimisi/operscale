#!/usr/bin/env bash
# scripts/lock-brand.sh
#
# One-shot script that replaces every customer-facing `<brand-name>` placeholder
# with the real brand name. Run ONCE in a dedicated PR on Day 15 of the build.
#
# After this script runs and the PR ships, set BRAND_LOCKED=true in CI so
# scripts/check-brand-placeholder.sh switches to the inverse check (verifies
# <brand-name> does NOT appear).
#
# Usage:
#   ./scripts/lock-brand.sh "RealBrandName" "realbrand.com"
#
# Source: CLAUDE.md "Brand placeholder rules".

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <brand-name-display> <brand-domain>"
  echo "Example: $0 'RealBrand' 'realbrand.com'"
  exit 2
fi

NAME="$1"
DOMAIN="$2"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "→ Replacing <brand-name>.com → $DOMAIN"
echo "→ Replacing <brand-name>     → $NAME (in customer-facing surfaces)"

# Scan EVERYTHING (text files only via -I) and rely on the skip-list below for
# files that intentionally retain the placeholder. This is broader than the
# original include-pattern list — catches .env.example, supabase/functions/*,
# root .md files, and shell scripts that previously slipped through.
FILES=$(grep -rIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  '<brand-name>' . || true)

if [[ -z "$FILES" ]]; then
  echo "Nothing to replace. Already locked?"
  exit 0
fi

# Domain replacement runs FIRST so we don't accidentally turn `<brand-name>.com`
# into `RealBrand.com` when we meant `realbrand.com`.
echo "$FILES" | while read -r f; do
  # Skip-list. Each file here intentionally retains the literal placeholder:
  #   * lock-brand.sh:                  this script's docstring + sed pattern
  #   * check-brand-placeholder.sh:     greps for the literal placeholder
  #   * CLAUDE.md:                      brand-placeholder rules section
  case "$f" in
    *scripts/lock-brand.sh|*scripts/check-brand-placeholder.sh|*CLAUDE.md)
      echo "  - SKIP (intentional): $f"
      continue
      ;;
  esac
  sed -i.bak "s|<brand-name>\.com|$DOMAIN|g; s|<brand-name>|$NAME|g" "$f"
  rm -f "$f.bak"
  echo "  - $f"
done

echo "✓ Replacement complete. Now:"
echo "  1) git diff   — review every changed file"
echo "  2) Run tests + manual smoke"
echo "  3) Open the brand-lock PR"
echo "  4) After merge: set BRAND_LOCKED=true in CI"
