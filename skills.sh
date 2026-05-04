#!/usr/bin/env bash
#
# skills.sh — Operscale Content Calendar dev environment installer
#
# Idempotent. Safe to run multiple times. Installs:
#   - System deps (Node 20, pnpm, jq, ffmpeg for image processing only)
#   - Skills from skills.sh ecosystem (Superpowers, frontend-design, etc.)
#   - Project npm dependencies
#   - Pre-commit hooks
#   - Local environment scaffolding (.env.example files, Supabase CLI)
#
# Run from the repo root: ./skills.sh
# Inspect what would happen first: ./skills.sh --dry-run
#
# Environment expectations:
#   - macOS or Ubuntu 22.04+
#   - Internet access (skills install pulls from GitHub via npx)
#   - npm and node available
#
# This installer DOES NOT:
#   - Provision VPS infrastructure (we use the existing srv1297445)
#   - Create the Supabase project (we share the existing VG project)
#   - Configure Cloudflare DNS (manual step, documented in deployment.md)
#   - Set production environment variables (those live on the VPS, chmod 600)

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────
# Colours and logging
# ──────────────────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
RESET=$'\033[0m'

DRY_RUN=0
SKIP_SKILLS=0
SKIP_DEPS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)     DRY_RUN=1 ;;
    --skip-skills) SKIP_SKILLS=1 ;;
    --skip-deps)   SKIP_DEPS=1 ;;
    --help|-h)
      cat <<HELP
Usage: ./skills.sh [options]

Options:
  --dry-run       Print what would happen without doing it.
  --skip-skills   Skip skill installation (useful for CI).
  --skip-deps     Skip npm install (useful when only updating skills).
  --help, -h      Show this help.

This installer is idempotent and safe to re-run.
HELP
      exit 0 ;;
    *)
      echo "${RED}Unknown argument: $arg${RESET}" >&2
      echo "Run with --help for usage." >&2
      exit 1 ;;
  esac
done

log()   { echo "${BLUE}[skills.sh]${RESET} $*"; }
warn()  { echo "${YELLOW}[skills.sh][warn]${RESET} $*" >&2; }
err()   { echo "${RED}[skills.sh][error]${RESET} $*" >&2; }
ok()    { echo "${GREEN}[skills.sh][ok]${RESET} $*"; }

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  [dry-run] $*"
  else
    eval "$@"
  fi
}

require() {
  local cmd="$1"
  local install_hint="${2:-install it}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Missing required command: $cmd"
    err "  $install_hint"
    return 1
  fi
}

# ──────────────────────────────────────────────────────────────────────
# Step 0: pre-flight checks
# ──────────────────────────────────────────────────────────────────────
preflight() {
  log "Pre-flight checks..."

  require node "Install Node.js 20+ from https://nodejs.org/" || exit 1
  require npm  "Comes with Node.js" || exit 1
  require git  "Install git from https://git-scm.com/" || exit 1
  require curl "Should be on every modern OS" || exit 1

  local node_major
  node_major=$(node --version | sed -E 's/^v([0-9]+)\..*/\1/')
  if [[ "$node_major" -lt 20 ]]; then
    err "Node.js $node_major detected. Need 20+."
    err "  Install nvm and run: nvm install 20 && nvm use 20"
    exit 1
  fi
  ok "Node $(node --version)"

  if ! command -v pnpm >/dev/null 2>&1; then
    log "Installing pnpm..."
    run "npm install -g pnpm@9"
  fi
  ok "pnpm $(pnpm --version 2>/dev/null || echo unavailable)"

  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not installed. Some scripts (e.g. brand-name grep CI check) need it."
    warn "  macOS: brew install jq    Ubuntu: sudo apt-get install jq"
  fi

  if ! command -v supabase >/dev/null 2>&1; then
    log "Installing Supabase CLI..."
    case "$(uname -s)" in
      Darwin*)
        run "brew install supabase/tap/supabase || true"
        ;;
      MINGW*|MSYS*|CYGWIN*)
        # Windows: npm global install of supabase is unsupported (postinstall script
        # rejects it). Download the official binary from GitHub releases and drop it
        # in $HOME/bin (which Git Bash adds to PATH on most setups).
        local sb_arch="amd64"
        case "$(uname -m)" in
          aarch64|arm64) sb_arch="arm64" ;;
        esac
        local sb_tmp; sb_tmp=$(mktemp -d)
        local sb_url
        sb_url=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
          | grep -oE "https://[^\"]+supabase_windows_${sb_arch}\.tar\.gz" | head -1)
        if [[ -n "$sb_url" ]]; then
          run "curl -fsSL -o '$sb_tmp/supabase.tar.gz' '$sb_url'"
          run "tar -xzf '$sb_tmp/supabase.tar.gz' -C '$sb_tmp'"
          run "mkdir -p '$HOME/bin'"
          run "cp '$sb_tmp/supabase.exe' '$HOME/bin/supabase.exe'"
          run "rm -rf '$sb_tmp'"
          if ! echo ":$PATH:" | grep -q ":$HOME/bin:"; then
            warn "$HOME/bin is not on PATH — add it so 'supabase' resolves in future shells."
          fi
        else
          warn "Could not resolve Supabase CLI release asset for windows_${sb_arch}."
          warn "  Install manually from https://github.com/supabase/cli/releases"
        fi
        ;;
      *)
        # Linux: try the official install script first; fall back to npm only as a last resort.
        if command -v apt-get >/dev/null 2>&1; then
          run "curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh || true"
        else
          run "npm install -g supabase || true"
        fi
        ;;
    esac
  fi
  ok "Supabase CLI $(supabase --version 2>/dev/null || echo unavailable)"
}

# ──────────────────────────────────────────────────────────────────────
# Step 1: install agent skills via npx skills
# ──────────────────────────────────────────────────────────────────────
# These skills are pulled from skills.sh ecosystem. Each install is
# idempotent — re-running just confirms the skill is up-to-date.
#
# Skill choices are documented in skills.md with rationale.
# ──────────────────────────────────────────────────────────────────────
install_skills() {
  if [[ $SKIP_SKILLS -eq 1 ]]; then
    log "Skipping skill install (--skip-skills)"
    return
  fi

  log "Installing agent skills from skills.sh ecosystem..."

  # The skill list below pulls from ~10 third-party GitHub repos. Any one can
  # be renamed, archived, or moved at any time (it has happened twice already:
  # awesomeskill-ai/scriptwriting-methodology -> mike-coulbourn/claude-vibes,
  # and sentry/dev -> getsentry/sentry-agent-skills). To keep one stale URL
  # from blocking the entire install — especially the pnpm install step that
  # produces the lockfile — strict mode is disabled for this section.
  # Individual `npx skills add` failures emit warnings and the script
  # continues. Strict mode is re-enabled at end-of-function.
  set +e

  # Foundational discovery skill — lets future sessions find more skills
  log "  -> find-skills (vercel-labs/skills)"
  run "npx -y skills add vercel-labs/skills --skill find-skills -g -y"

  # Superpowers — primary build methodology
  log "  -> Superpowers (obra/superpowers)"
  run "npx -y skills add obra/superpowers --skill brainstorming -g -y"
  run "npx -y skills add obra/superpowers --skill writing-plans -g -y"
  run "npx -y skills add obra/superpowers --skill executing-plans -g -y"
  run "npx -y skills add obra/superpowers --skill subagent-driven-development -g -y"
  run "npx -y skills add obra/superpowers --skill verification-before-completion -g -y"
  run "npx -y skills add obra/superpowers --skill systematic-debugging -g -y"
  run "npx -y skills add obra/superpowers --skill test-driven-development -g -y"
  run "npx -y skills add obra/superpowers --skill using-git-worktrees -g -y"
  run "npx -y skills add obra/superpowers --skill dispatching-parallel-agents -g -y"
  run "npx -y skills add obra/superpowers --skill requesting-code-review -g -y"
  run "npx -y skills add obra/superpowers --skill receiving-code-review -g -y"
  run "npx -y skills add obra/superpowers --skill writing-skills -g -y"
  run "npx -y skills add obra/superpowers --skill using-superpowers -g -y"

  # Anthropic-official skills
  log "  -> Anthropic skills (anthropics/skills)"
  run "npx -y skills add anthropics/skills --skill frontend-design -g -y"
  run "npx -y skills add anthropics/skills --skill webapp-testing -g -y"
  run "npx -y skills add anthropics/skills --skill brand-guidelines -g -y"
  run "npx -y skills add anthropics/skills --skill skill-creator -g -y"
  run "npx -y skills add anthropics/skills --skill mcp-builder -g -y"
  run "npx -y skills add anthropics/skills --skill doc-coauthoring -g -y"

  # Document-format skills (for proposal/brief docx generation if needed)
  run "npx -y skills add anthropics/skills --skill docx -g -y"
  run "npx -y skills add anthropics/skills --skill pdf -g -y"
  run "npx -y skills add anthropics/skills --skill pptx -g -y"
  run "npx -y skills add anthropics/skills --skill xlsx -g -y"

  # Vercel-labs skills — Next.js, React, design
  log "  -> Vercel-labs skills (vercel-labs/agent-skills)"
  run "npx -y skills add vercel-labs/agent-skills --skill vercel-react-best-practices -g -y"
  run "npx -y skills add vercel-labs/agent-skills --skill web-design-guidelines -g -y"
  run "npx -y skills add vercel-labs/agent-skills --skill vercel-composition-patterns -g -y"
  run "npx -y skills add vercel-labs/next-skills --skill next-best-practices -g -y"

  # Supabase — postgres + RLS best practices
  log "  -> Supabase skills (supabase/agent-skills)"
  run "npx -y skills add supabase/agent-skills --skill supabase-postgres-best-practices -g -y"
  run "npx -y skills add supabase/agent-skills --skill supabase -g -y"

  # shadcn/ui — component installer
  log "  -> shadcn/ui (shadcn/ui)"
  run "npx -y skills add shadcn/ui --skill shadcn -g -y"

  # Marketing / content-strategy skills (optional but useful for niche-brief tuning)
  log "  -> Marketing skills (coreyhaines31/marketingskills) — for niche brief tuning"
  run "npx -y skills add coreyhaines31/marketingskills --skill content-strategy -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill social-content -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill copywriting -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill email-sequence -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill ad-creative -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill marketing-psychology -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill page-cro -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill form-cro -g -y"
  run "npx -y skills add coreyhaines31/marketingskills --skill analytics-tracking -g -y"

  # Scriptwriting methodology — DR formula, PAS/AIDA/PAIPS structures, hook
  # stacking. Filtered through ADR 0012 (frameworks by name of framework, not
  # by name of marketer). Listed on awesomeskill.ai marketplace; canonical
  # source is mike-coulbourn/claude-vibes (skill at plugins/vibes/skills/).
  log "  -> Scriptwriting methodology (mike-coulbourn/claude-vibes)"
  run "npx -y skills add mike-coulbourn/claude-vibes --skill scriptwriting-methodology -g -y"

  # Observability — Sentry agent skills. The original sentry/dev path used here
  # 404s; getsentry/sentry-agent-skills is the working repo (archived by Sentry
  # but still installable; future-state replacement is getsentry/sentry-for-ai
  # which uses the plugin-marketplace mechanism, not `npx skills add`).
  # sentry-fix-issues is the closest analogue to "error-tracking CLI workflow".
  log "  -> Observability (getsentry/sentry-agent-skills)"
  run "npx -y skills add getsentry/sentry-agent-skills --skill sentry-fix-issues -g -y"

  # Playwright for end-to-end testing
  log "  -> Playwright (microsoft/playwright-cli, currents-dev best-practices)"
  run "npx -y skills add microsoft/playwright-cli --skill playwright-cli -g -y"
  run "npx -y skills add currents-dev/playwright-best-practices-skill --skill playwright-best-practices -g -y"

  # better-auth (Phase 1 uses Supabase magic-link, but this is on standby for Phase 2 customer dashboard if ever needed)
  # Skipping for now — keeps the install lean.

  # Re-enable strict mode for the rest of the script.
  set -e
  ok "All skills installed (any 404/auth-failed clones logged above as warnings)."
}

# ──────────────────────────────────────────────────────────────────────
# Step 2: project npm/pnpm dependencies
# ──────────────────────────────────────────────────────────────────────
install_project_deps() {
  if [[ $SKIP_DEPS -eq 1 ]]; then
    log "Skipping project deps (--skip-deps)"
    return
  fi

  log "Installing project dependencies..."

  if [[ ! -f pnpm-workspace.yaml ]]; then
    log "  -> creating pnpm-workspace.yaml"
    cat > pnpm-workspace.yaml <<'YAML'
packages:
  - apps/*
YAML
  fi

  if [[ ! -f package.json ]]; then
    log "  -> creating root package.json"
    cat > package.json <<'JSON'
{
  "name": "operscale-calendar-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "dev:agent": "pnpm --filter agent dev",
    "build": "pnpm --filter web build && pnpm --filter agent build",
    "lint": "pnpm --filter web lint && pnpm --filter agent lint",
    "typecheck": "pnpm --filter web typecheck && pnpm --filter agent typecheck",
    "test": "pnpm --filter web test && pnpm --filter agent test",
    "test:e2e": "pnpm --filter web test:e2e",
    "brand:check": "scripts/check-brand-placeholder.sh",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "prettier": "^3.2.0"
  },
  "packageManager": "pnpm@9.0.0"
}
JSON
  fi

  log "  -> running pnpm install"
  run "pnpm install"
}

# ──────────────────────────────────────────────────────────────────────
# Step 3: scaffold .env.example files
# ──────────────────────────────────────────────────────────────────────
scaffold_env_examples() {
  log "Creating .env.example files..."

  if [[ ! -f .env.example ]]; then
    log "  -> root .env.example"
    cat > .env.example <<'ENV'
# Operscale Content Calendar — root environment template
#
# Copy to .env (which is gitignored) and fill in real values for local dev.
# Production values live on the VPS at /etc/operscale-calendar/.env, chmod 600.

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic (Claude Opus 4.7 for brief analysis)
ANTHROPIC_API_KEY=sk-ant-...

# Paystack (NGN payments)
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
# Switch to live keys at production launch only after end-to-end test passes

# Resend (email)
RESEND_API_KEY=re_...

# Evolution API (WhatsApp, self-hosted)
EVOLUTION_API_BASE=https://evolution.srv1297445.hstgr.cloud
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE_NAME=operscale-calendar

# Brand placeholder — locked at Day 15 of build
NEXT_PUBLIC_BRAND_NAME=Operscale
NEXT_PUBLIC_BRAND_DOMAIN=operscale.cloud
NEXT_PUBLIC_FOUNDER_WHATSAPP=+447592233052

# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Misc
NODE_ENV=development
ENV
  fi

  for app in apps/web apps/agent; do
    if [[ -d "$app" ]] && [[ ! -f "$app/.env.example" ]]; then
      log "  -> $app/.env.example"
      run "cp .env.example $app/.env.example"
    fi
  done
}

# ──────────────────────────────────────────────────────────────────────
# Step 4: gitignore
# ──────────────────────────────────────────────────────────────────────
ensure_gitignore() {
  log "Ensuring .gitignore covers secrets..."
  if [[ -f .gitignore ]]; then
    log "  -> .gitignore already exists, leaving it alone (project-hardened version preferred)"
    return
  fi
  cat > .gitignore <<'GITIGNORE'
# dependencies
node_modules/
.pnpm-store/

# build outputs
.next/
dist/
out/
*.tsbuildinfo

# env files (real secrets never committed)
.env
.env.local
.env.*.local
apps/*/.env
apps/*/.env.local
apps/*/.env.*.local

# Supabase
.supabase/

# logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# editor
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# coverage / test artifacts
coverage/
playwright-report/
test-results/

# uploads (test only)
uploads/

# build artifacts of the brand-locking process
*.brand-locked.bak
GITIGNORE
}

# ──────────────────────────────────────────────────────────────────────
# Step 5: pre-commit hook (brand placeholder + secret scan)
# ──────────────────────────────────────────────────────────────────────
install_precommit_hook() {
  log "Installing pre-commit hook (brand check + secret scan)..."

  mkdir -p .git/hooks 2>/dev/null || true
  if [[ ! -d .git ]]; then
    warn "Not a git repo yet. Run 'git init' first, then re-run skills.sh."
    return
  fi

  cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

# Block commits that contain plain-text Paystack secret keys
if git diff --cached -U0 | grep -E 'sk_(test|live)_[a-f0-9]{40,}' >/dev/null; then
  echo "[pre-commit] BLOCKED: detected Paystack secret key in staged changes."
  echo "[pre-commit] Move the secret to .env (which is gitignored) and reference via process.env."
  exit 1
fi

# Block commits that contain hardcoded Anthropic keys
if git diff --cached -U0 | grep -E 'sk-ant-[A-Za-z0-9_-]{40,}' >/dev/null; then
  echo "[pre-commit] BLOCKED: detected Anthropic API key in staged changes."
  exit 1
fi

# Block commits that contain hardcoded Supabase service-role JWTs
if git diff --cached -U0 | grep -E 'eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}' >/dev/null; then
  echo "[pre-commit] BLOCKED: detected JWT in staged changes (likely Supabase service role)."
  exit 1
fi

# Brand placeholder coherence check (post-launch only — toggle by file existence)
if [[ -f .brand-locked ]]; then
  if git diff --cached --name-only | grep -E '^(apps/web/src|apps/agent/src|docs)/.*\.(tsx?|md|html|json)$' \
     | xargs -I{} grep -l 'Operscale' {} 2>/dev/null; then
    echo "[pre-commit] BLOCKED: Operscale placeholder found after brand was locked."
    echo "[pre-commit] Brand has been locked (see .brand-locked file). Replace placeholders."
    exit 1
  fi
fi

exit 0
HOOK
  chmod +x .git/hooks/pre-commit
  ok "Pre-commit hook installed."
}

# ──────────────────────────────────────────────────────────────────────
# Step 6: scripts directory — useful one-shot scripts
# ──────────────────────────────────────────────────────────────────────
ensure_scripts() {
  log "Ensuring helper scripts exist..."
  mkdir -p scripts

  if [[ ! -f scripts/check-brand-placeholder.sh ]]; then
    cat > scripts/check-brand-placeholder.sh <<'SH'
#!/usr/bin/env bash
# CI check: brand placeholder coherence.
# Pre-launch: Operscale must be present in customer-facing surfaces.
# Post-launch: Operscale must NOT be present anywhere.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [[ -f .brand-locked ]]; then
  if grep -rn 'Operscale' apps/web/src apps/agent/src docs/ 2>/dev/null; then
    echo "FAIL: brand has been locked but Operscale still appears."
    exit 1
  fi
  echo "OK: brand locked, no placeholder found."
else
  if [[ -d apps/web/src ]] && ! grep -rn 'Operscale' apps/web/src 2>/dev/null >/dev/null; then
    echo "WARN: brand not locked, but Operscale not found in apps/web/src."
    echo "      This is expected only if no customer-facing code exists yet."
  fi
  echo "OK: brand not locked, placeholder check skipped."
fi
SH
    chmod +x scripts/check-brand-placeholder.sh
  fi

  if [[ ! -f scripts/lock-brand.sh ]]; then
    cat > scripts/lock-brand.sh <<'SH'
#!/usr/bin/env bash
# Lock the customer-facing brand name. Run once at Day 15 of the build.
# Usage: ./scripts/lock-brand.sh "Real Brand Name" "realbrand.com"

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 \"Brand Display Name\" \"brand-domain.com\""
  exit 1
fi

BRAND_NAME="$1"
BRAND_DOMAIN="$2"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ -f .brand-locked ]]; then
  echo "ERROR: brand already locked (see .brand-locked file). Aborting."
  exit 1
fi

echo "About to replace:"
echo "  Operscale -> $BRAND_NAME"
echo "  operscale.cloud -> $BRAND_DOMAIN"
echo
echo "Files affected (preview):"
grep -rln 'Operscale' apps/ docs/ 2>/dev/null | head -30 || true
echo
read -p "Proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# OS-portable in-place replacement
if [[ "$(uname -s)" == "Darwin" ]]; then
  SED_INPLACE=(sed -i '')
else
  SED_INPLACE=(sed -i)
fi

# Domain MUST be replaced before name (so the .com variant matches first)
grep -rl 'operscale.cloud' apps/ docs/ 2>/dev/null \
  | xargs "${SED_INPLACE[@]}" "s|operscale.cloud|$BRAND_DOMAIN|g" || true

grep -rl 'Operscale' apps/ docs/ 2>/dev/null \
  | xargs "${SED_INPLACE[@]}" "s|Operscale|$BRAND_NAME|g" || true

date -u +"%Y-%m-%dT%H:%M:%SZ" > .brand-locked
echo "$BRAND_NAME" >> .brand-locked
echo "$BRAND_DOMAIN" >> .brand-locked

echo "OK: brand locked. .brand-locked file created."
echo "Commit immediately: git add -A && git commit -m 'lock brand: $BRAND_NAME'"
SH
    chmod +x scripts/lock-brand.sh
  fi

  if [[ ! -f scripts/seed-test-data.sh ]]; then
    cat > scripts/seed-test-data.sh <<'SH'
#!/usr/bin/env bash
# Seed test customers, briefs, and orders into local Supabase for development.
# Idempotent: if seed data already exists, this is a no-op.

set -euo pipefail
echo "Seed test data — implemented after schema migrations land."
echo "TODO: implement once supabase/migrations/001_initial.sql exists."
SH
    chmod +x scripts/seed-test-data.sh
  fi
}

# ──────────────────────────────────────────────────────────────────────
# Step 7: GitHub Actions workflow scaffolds
# ──────────────────────────────────────────────────────────────────────
ensure_workflows() {
  log "Ensuring GitHub Actions workflow scaffolds..."
  mkdir -p .github/workflows

  if [[ ! -f .github/workflows/ci.yml ]]; then
    cat > .github/workflows/ci.yml <<'YAML'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - name: Brand placeholder coherence
        run: ./scripts/check-brand-placeholder.sh
YAML
  fi

  if [[ ! -f .github/workflows/secret-scan.yml ]]; then
    cat > .github/workflows/secret-scan.yml <<'YAML'
name: Secret scan

on:
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Scan for leaked secrets
        run: |
          set -e
          if git log -p --all | grep -E 'sk_(test|live)_[a-f0-9]{40,}'; then
            echo "FAIL: Paystack secret key found in git history."
            exit 1
          fi
          if git log -p --all | grep -E 'sk-ant-[A-Za-z0-9_-]{40,}'; then
            echo "FAIL: Anthropic API key found in git history."
            exit 1
          fi
          echo "OK: no obvious leaked secrets in history."
YAML
  fi
}

# ──────────────────────────────────────────────────────────────────────
# Step 8: VPS deployment notes (informational only)
# ──────────────────────────────────────────────────────────────────────
print_vps_reminder() {
  cat <<INFO

${YELLOW}─── VPS deployment reminder ───${RESET}

This service runs on the existing Hostinger VPS: ${BLUE}srv1297445.hstgr.cloud${RESET}

Production deploys are handled via the existing Traefik network on that VPS.
The full deploy procedure is in ${BLUE}docs/deployment.md${RESET}.

What this installer does NOT touch on the VPS:
  - Traefik routing
  - Production .env files (live at /etc/operscale-calendar/.env, chmod 600)
  - Docker daemon
  - Supabase project (shared with Vision GridAI)
  - Cloudflare DNS

When you're ready to deploy to staging/prod, read docs/deployment.md.

INFO
}

# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────
main() {
  log "Operscale Content Calendar — environment installer"
  log ""

  preflight
  install_skills
  install_project_deps
  scaffold_env_examples
  ensure_gitignore
  install_precommit_hook
  ensure_scripts
  ensure_workflows
  print_vps_reminder

  ok "Done. Read CLAUDE.md and AGENT.md before starting work."
}

main "$@"
