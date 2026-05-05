# apps/agent/Dockerfile
# Multi-stage build for the Next.js API container (port 3002).
# Source: docs/deployment.md "apps/agent/Dockerfile" section.

FROM node:20.11-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- deps stage: install with workspace context --------------------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/agent/package.json apps/agent/
COPY apps/web/package.json apps/web/
# Lockfile is committed — fail the build if it's stale rather than silently
# resolving a different dependency tree on each build.
RUN pnpm install --frozen-lockfile --filter=@operscale-calendar/agent...

# ---- build stage ---------------------------------------------------------
FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/agent/node_modules ./apps/agent/node_modules
COPY . .
WORKDIR /repo/apps/agent
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
RUN pnpm build:worker

# ---- runner stage: minimal standalone image ------------------------------
FROM node:20.11-alpine AS runner
RUN apk add --no-cache libc6-compat tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/.next/static ./apps/agent/.next/static
# Agent is API-only — no apps/agent/public directory exists. The COPY line that
# was here originally was copy-pasted from the web Dockerfile and broke the build.

# Worker artefact (Phase 3): plain-Node output of `pnpm build:worker`.
# Resolves to apps/agent/dist/worker/index.js — used by the worker compose service CMD.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/dist ./apps/agent/dist

# Worker runtime deps (Phase 3): the Next standalone bundle in /app/node_modules
# only contains deps Next traced from .next/server/, which doesn't include the
# worker's @anthropic-ai/sdk + @supabase/supabase-js imports.
#
# pnpm layout: workspace symlinks at apps/agent/node_modules/<pkg> point (via 4
# levels of ../) to <repoRoot>/node_modules/.pnpm/<pkg-version>/node_modules/<pkg>.
# In the runner image the same walk lands at /app/node_modules/.pnpm/, so we
# layer the builder's .pnpm/ subdirectory alongside the standalone's curated
# /app/node_modules/. The standalone doesn't use a .pnpm/ subdir, so this is
# additive — the agent's runtime (CMD: apps/agent/server.js) keeps resolving
# from the standalone's hoisted node_modules unchanged.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/node_modules ./apps/agent/node_modules
COPY --from=builder --chown=nextjs:nodejs /repo/node_modules/.pnpm ./node_modules/.pnpm

# Bank-catalog spec files. loadBankCatalog auto-ascends from cwd looking for
# pnpm-workspace.yaml as the repo-root marker, then reads niche briefs +
# framework + archetype specs from there. The worker bootstraps with cwd=/app
# so we layer these into /app/ at the same relative paths the dev tree uses.
COPY --from=builder --chown=nextjs:nodejs /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nextjs:nodejs /repo/niche-briefs ./niche-briefs
COPY --from=builder --chown=nextjs:nodejs /repo/docs/specs/script-frameworks.md ./docs/specs/script-frameworks.md
COPY --from=builder --chown=nextjs:nodejs /repo/docs/specs/angle-archetypes.md ./docs/specs/angle-archetypes.md

USER nextjs
EXPOSE 3002
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/agent/server.js"]
