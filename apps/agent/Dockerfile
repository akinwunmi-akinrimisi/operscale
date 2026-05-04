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
RUN pnpm install --frozen-lockfile --filter=@operscale-calendar/agent...

# ---- build stage ---------------------------------------------------------
FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/agent/node_modules ./apps/agent/node_modules
COPY . .
WORKDIR /repo/apps/agent
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
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/.next/static ./apps/agent/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/agent/public ./apps/agent/public

USER nextjs
EXPOSE 3002
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/agent/server.js"]
