# syntax=docker/dockerfile:1.7
# OpenLab Cloud — multi-stage image.
#   web     : Next.js standalone server (default target)
#   worker  : background job worker (Job Queue → Provider → Hypervisor)
#   migrate : one-shot "prisma migrate deploy" + idempotent seed

ARG NODE_VERSION=24

# ---------- deps: full install (incl. dev deps needed to build) ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------- migrate / worker: need the TypeScript sources + tsx ----------
FROM build AS tools
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
USER node

FROM tools AS migrate
# Seed skips itself when the organization already exists, so this is safe to run on every deploy.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

FROM tools AS worker
CMD ["npx", "tsx", "scripts/worker.ts"]

# ---------- web: minimal runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS web
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
