# syntax=docker/dockerfile:1.7
# ══════════════════════════════════════════════════════════════════════
# MyFarma — imágenes de producción (se construyen en GitHub Actions, no en el droplet).
#
#   target "app"     → servidor Next.js standalone (~150 MB, sin node_modules completos)
#   target "migrate" → Prisma CLI + migraciones + seed, se ejecuta una vez por deploy
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
# El build no se conecta a nada, pero env.ts valida que existan las URLs.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    pnpm build

# ── Migraciones y seed (imagen mínima: solo Prisma y lo que usa el seed) ──
FROM node:22-alpine AS migrate
WORKDIR /app
# Mismas versiones mayores que package.json.
RUN npm init -y >/dev/null \
 && npm install --no-audit --no-fund --omit=dev \
      prisma@7.10.1 @prisma/client@7.10.1 @prisma/adapter-pg@7.10.1 pg@8 tsx@4 csv-parse@7 dotenv@18 \
 && npm cache clean --force
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src/lib/text.ts ./src/lib/text.ts
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed/index.ts"]

# ── Servidor ────────────────────────────────────────────────────────────
FROM node:22-alpine AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
