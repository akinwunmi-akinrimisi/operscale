#!/usr/bin/env bash
# scripts/setup.sh
#
# One-time per-clone setup. Run after `git clone`:
#   bash scripts/setup.sh
#
# Activates the in-repo pre-commit hook (which blocks .env commits and secret
# shapes — see scripts/git-hooks/pre-commit). Without this, a fresh clone has
# the hook FILE but Git doesn't run it.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d .git ]]; then
  echo "Not a git repo: $REPO_ROOT"
  exit 1
fi

git config core.hooksPath scripts/git-hooks
chmod +x scripts/git-hooks/pre-commit 2>/dev/null || true

echo "✓ git core.hooksPath = scripts/git-hooks"
echo "✓ pre-commit hook armed"
echo ""
echo "Test it: try staging a fake .env to confirm rejection."
