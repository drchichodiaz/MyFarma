# syntax=docker/dockerfile:1.7
# ══════════════════════════════════════════════════════════════════════
# MyFarma — imágenes de producción (se construyen en GitHub Actions, no en el droplet).
#
#   target "app"     → servidor Next.js standalone (~150 MB, sin node_modules completos)
#   target "migrate" → Prisma CLI + migraciones + seed, se ejecuta una vez por deploy
#   target "worker"  → cola de fotos (BullMQ + sharp), mismo código de src/server
# ══════════════════════════════════════════════════════════════════════

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ── Dependencias (capa cacheada mientras no cambie el lockfile) ─────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── Build ───────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# Sentry (opcional): el DSN es público (va en el JS del navegador); org, proyecto y release
# identifican dónde subir los source maps. El token es secreto: entra como secret de BuildKit
# (no queda en ninguna capa de la imagen). Sin token, el build no sube nada.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ARG SENTRY_RELEASE=""
# Umami Cloud (analítica sin cookies): el ID del sitio es público. Sin él, no se carga.
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=""
# El build no se conecta a nada, pero env.ts valida que existan las URLs.
RUN --mount=type=secret,id=sentry_auth_token,required=false \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID="$NEXT_PUBLIC_UMAMI_WEBSITE_ID" \
    SENTRY_ORG="$SENTRY_ORG" SENTRY_PROJECT="$SENTRY_PROJECT" SENTRY_RELEASE="$SENTRY_RELEASE" \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    pnpm build

# ── Migraciones y seed (imagen mínima: solo Prisma y lo que usa el seed) ──
FROM node:22-alpine AS migrate
WORKDIR /app
# Mismas versiones mayores que package.json.
RUN npm init -y >/dev/null \
 && npm install --no-audit --no-fund --omit=dev \
      prisma@7.10.1 @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg@8 tsx@4 csv-parse@7 dotenv@18 zod@4 \
 && npm cache clean --force
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src/lib/text.ts src/lib/branch-import.ts ./src/lib/
RUN npx prisma generate
# Producción nunca carga datos de ejemplo (y borra los que hayan quedado); el compose también lo fija.
ENV SEED_DEMO=0
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed/index.ts"]

# ── Worker de fotos (mismo código de src/server, ejecutado con tsx) ─────
# Solo los paquetes que usa el worker (no las dependencias de Next ni de desarrollo).
FROM node:22-alpine AS worker
ENV NODE_ENV=production
WORKDIR /app
RUN npm init -y >/dev/null \
 && npm install --no-audit --no-fund --omit=dev \
      sharp@0.35 bullmq@6 aws4fetch@1 ioredis@6 zod@4 server-only tsx@4 @sentry/node@11 \
      nodemailer@8 web-push@3 \
      @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg@8 \
 && npm cache clean --force
COPY tsconfig.json ./
COPY src ./src
# Cliente de Prisma ya generado en la etapa deps (src/generated no entra al contexto).
COPY --from=deps /app/src/generated ./src/generated
USER node
CMD ["node_modules/.bin/tsx", "--conditions=react-server", "src/worker/index.ts"]

# ── Servidor ────────────────────────────────────────────────────────────
FROM node:22-alpine AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/public ./public
# Fuentes para las imágenes de vista previa (opengraph-image).
COPY --from=build --chown=node:node /app/assets ./assets
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
