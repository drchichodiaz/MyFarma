# MyFarma

Buscador comunitario de medicamentos escasos en Panamá: en qué farmacia hay, a qué precio y cuándo se confirmó.

Nació de un problema real: pacientes de la CSS con artritis reumatoide recorren farmacia por farmacia buscando metotrexato.

- Plan completo, fases y decisiones: [PLAN.md](PLAN.md)
- Prototipo visual aprobado: [prototype/index.html](prototype/index.html)

## Stack

Next.js 16 (App Router, Cache Components, React Compiler) · Tailwind CSS 4 · Prisma 7 + PostgreSQL/PostGIS · Redis · Docker Compose · Caddy · Cloudflare (CDN + R2)

## Desarrollo local

Requisitos: Node 22+, pnpm, Docker.

```bash
pnpm install              # también genera el cliente de Prisma
cp .env.example .env      # valores de desarrollo listos para usar
pnpm services:up          # Postgres/PostGIS :5433, Redis :6380, Mailpit :8025
pnpm db:deploy            # aplica migraciones
pnpm dev                  # http://localhost:3000
```

Comprobar que todo está conectado: <http://localhost:3000/api/health>

| Comando              | Qué hace                                                     |
| -------------------- | ------------------------------------------------------------ |
| `pnpm check`         | lint + tipos + formato (lo mismo que corre el CI)            |
| `pnpm db:migrate`    | crea una migración nueva a partir de `prisma/schema.prisma`  |
| `pnpm db:studio`     | explorador visual de la base de datos                        |
| `pnpm services:down` | apaga los contenedores (los datos se conservan en volúmenes) |

Correos de desarrollo (enlaces mágicos, alertas): <http://localhost:8025>
