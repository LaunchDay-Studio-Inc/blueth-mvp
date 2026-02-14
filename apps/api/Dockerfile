# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace config + package manifests (layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/core/ ./packages/core/
COPY packages/db/ ./packages/db/
COPY apps/api/ ./apps/api/

# Build in dependency order
RUN pnpm --filter @blueth/core build && \
    pnpm --filter @blueth/db build && \
    pnpm --filter @blueth/api build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 blueth

# Copy workspace config (needed for pnpm workspace resolution)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./

# Copy built packages
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/core/dist/ ./packages/core/dist/

COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist/ ./packages/db/dist/
# Migrations must be accessible: migrate.js uses path.join(__dirname, '../migrations')
COPY --from=builder /app/packages/db/migrations/ ./packages/db/migrations/

COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist/ ./apps/api/dist/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

USER blueth
EXPOSE 3001

# Default: run API server. Override for workers/migration:
#   scheduler: node apps/api/dist/workers/scheduler.js
#   tick:      node apps/api/dist/workers/tick.js
#   migrate:   node packages/db/dist/migrate.js
CMD ["node", "apps/api/dist/index.js"]
