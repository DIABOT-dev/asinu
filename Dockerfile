# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20

###############################################################################
# deps – install production + build deps with cache/retry hardening
###############################################################################
FROM node:${NODE_VERSION}-bullseye-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    build-essential \
    python3 \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

ENV \
  npm_config_fetch_retries=5 \
  npm_config_fetch_retry_maxtimeout=20000 \
  npm_config_fetch_retry_mintimeout=2000 \
  npm_config_loglevel=error \
  NODE_ENV=production

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
  HUSKY=0 npm ci --no-audit --no-fund

###############################################################################
# builder – copy source and build Next.js app
###############################################################################
FROM node:${NODE_VERSION}-bullseye-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

###############################################################################
# runner – minimal image with standalone output
###############################################################################
FROM node:${NODE_VERSION}-bullseye-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    wget \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=UTC

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./.next/server
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz || exit 1

CMD ["node", "server.js"]
