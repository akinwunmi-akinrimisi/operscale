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
# Lockfile is committed — fail the build if it's stale rather than silently
# resolving a different dependency tree on each build.
RUN pnpm install --frozen-lockfile --filter=@operscale-calendar/web...

# ---- build stage ---------------------------------------------------------
FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
WORKDIR /repo/apps/web
# NEXT_PUBLIC_* vars must be set at build time — Next.js inlines them into
# the client bundle (substituted as literal strings during webpack/turbopack
# build). At runtime the container env values are NOT visible to client code.
# Compose passes these via build.args (see /docker/operscale-calendar/docker-
# compose.yml on the VPS).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_AGENT_BASE_URL
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
ARG NEXT_PUBLIC_BRAND_NAME=Operscale
ARG NEXT_PUBLIC_BRAND_DOMAIN=operscale.cloud
ARG NEXT_PUBLIC_FOUNDER_WHATSAPP
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_AGENT_BASE_URL=${NEXT_PUBLIC_AGENT_BASE_URL} \
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=${NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY} \
    NEXT_PUBLIC_BRAND_NAME=${NEXT_PUBLIC_BRAND_NAME} \
    NEXT_PUBLIC_BRAND_DOMAIN=${NEXT_PUBLIC_BRAND_DOMAIN} \
    NEXT_PUBLIC_FOUNDER_WHATSAPP=${NEXT_PUBLIC_FOUNDER_WHATSAPP}
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
