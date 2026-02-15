# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace config + package manifests (layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/core/ ./packages/core/
COPY apps/web/ ./apps/web/

# Build core first (web depends on it at build time)
RUN pnpm --filter @blueth/core build

# NEXT_PUBLIC_* vars are inlined at build time by Next.js
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# API_INTERNAL_URL is used server-side only for Next.js rewrites
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

RUN pnpm --filter @blueth/web build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server (includes node_modules trace)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets (not included in standalone trace)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}

CMD ["node", "apps/web/server.js"]
