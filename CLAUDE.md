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
pnpm test           # Vitest (reglas puras en src/lib)
pnpm test:e2e       # Playwright contra pnpm dev + Mailpit (entrar → reportar → confirmar)
pnpm worker         # alertas y fotos (BullMQ); los e2e de alertas lo necesitan corriendo
pnpm db:migrate     # nueva migración; después correr `pnpm db:generate` (Prisma 7 no regenera solo)
pnpm db:seed        # catálogo + reportes de ejemplo si no hay reportes
pnpm branches:import <xlsx>  # sucursales confirmadas de la hoja de LeadSeeker → CSV del seed (--dry, --todas)
```

## Convenciones que no son obvias

- **Next 16 con Cache Components.** Los datos de la DB se leen en funciones con `"use cache"` + `cacheLife` + `cacheTag` (ver `src/server/services`). Lo que va en la página y lee la DB, `params`, `searchParams` o la hora va dentro de `<Suspense>`. Usa `<AtRequest>` o `requestTime()` para que el build nunca toque la DB.
- **Una consulta por pantalla.** Resultados y listados usan SQL explícito (`$queryRaw`) con `select` de solo lo necesario. Nada de N+1.
- **Ubicación:** `branches.location` (geography) la llena un trigger desde `lat`/`lng`. Prisma no escribe PostGIS.
- **Búsqueda:** texto normalizado en `medications.search_text` + `word_similarity ≥ 0.35` por palabra.
- **Estilos:** tokens en `src/app/globals.css` (lima, marino, bosque, pasteles) y clases `chip`, `btn-primary`, `pill`, `h-section`. El diseño de referencia es `prototype/index.html`.
- **Sesión:** `currentUser()` de `src/server/auth.ts`, siempre dentro de `<Suspense>`. Auth.js v5 con sesiones en DB; Google solo aparece si hay `AUTH_GOOGLE_*`.
- **Reportes:** `src/server/services/reports.ts` (límites en Redis + transacción + `recomputeAvailability`). Las reglas viven en `src/lib/availability-rules.ts` y tienen tests.
- **Fotos:** el navegador sube directo a R2 (`myfarma-uploads`, privado); el worker (`src/worker`) publica las variantes en `img.myfarma.net`. Nunca mostrar una foto que no esté `READY`.
- **Worker:** lo que importa `src/worker` no puede depender de Next (su imagen no lo trae). Lo compartido va en módulos sin `next/*`, como `src/server/alert-links.ts`.
- **Textos en español**, voz activa, sin datos personales en público (nombre + inicial).

## Deploy

Push a `main` → CI → imágenes en GHCR → `deploy/deploy.sh` en el droplet por SSH → health check. Infra en `deploy/`. El `.env` de producción vive solo en el servidor (`/opt/myfarma/.env`).
