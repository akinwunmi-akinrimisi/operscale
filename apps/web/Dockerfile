# apps/web/Dockerfile
# Multi-stage build for the Next.js web container (port 3001).
# Source: docs/deployment.md "apps/web/Dockerfile" section.

FROM node:20.11-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- deps stage: install with workspace context --------------------------
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY apps/agent/package.json apps/agent/
# First-deploy mode: --no-frozen-lockfile because the repo doesn't yet ship
# a pnpm-lock.yaml. The first build generates one and pnpm caches it; a
# follow-up commit will pin it and we'll switch back to --frozen-lockfile.
RUN pnpm install --no-frozen-lockfile --filter=@operscale-calendar/web...

# ---- build stage ---------------------------------------------------------
FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
WORKDIR /repo/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner stage: minimal standalone image ------------------------------
FROM node:20.11-alpine AS runner
RUN apk add --no-cache libc6-compat tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
