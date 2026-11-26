# MyFarma — guía para sesiones de trabajo

Buscador comunitario de medicamentos escasos en Panamá. En producción: https://myfarma.net

**Empieza siempre por [PLAN.md](PLAN.md):** decisiones, fases con su estado, checklist de la fase actual y reglas de rendimiento.

@AGENTS.md

## Comandos

```bash
pnpm services:up    # Postgres/PostGIS :5433, Redis :6380, Mailpit :8025
pnpm dev            # http://localhost:3000
pnpm check          # lint + tipos + formato (lo mismo que el CI)
pnpm build          # debe funcionar SIN base de datos (lo exige el build de Docker)
pnpm db:migrate     # nueva migración; después correr `pnpm db:generate` (Prisma 7 no regenera solo)
pnpm db:seed        # catálogo + reportes de ejemplo si no hay reportes
```

## Convenciones que no son obvias

- **Next 16 con Cache Components.** Los datos de la DB se leen en funciones con `"use cache"` + `cacheLife` + `cacheTag` (ver `src/server/services`). Lo que va en la página y lee la DB, `params`, `searchParams` o la hora va dentro de `<Suspense>`. Usa `<AtRequest>` o `requestTime()` para que el build nunca toque la DB.
- **Una consulta por pantalla.** Resultados y listados usan SQL explícito (`$queryRaw`) con `select` de solo lo necesario. Nada de N+1.
- **Ubicación:** `branches.location` (geography) la llena un trigger desde `lat`/`lng`. Prisma no escribe PostGIS.
- **Búsqueda:** texto normalizado en `medications.search_text` + `word_similarity ≥ 0.35` por palabra.
- **Estilos:** tokens en `src/app/globals.css` (lima, marino, bosque, pasteles) y clases `chip`, `btn-primary`, `pill`, `h-section`. El diseño de referencia es `prototype/index.html`.
- **Textos en español**, voz activa, sin datos personales en público (nombre + inicial).

## Deploy

Push a `main` → CI → imágenes en GHCR → `deploy/deploy.sh` en el droplet por SSH → health check. Infra en `deploy/`. El `.env` de producción vive solo en el servidor (`/opt/myfarma/.env`).
