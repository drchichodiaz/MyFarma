# MyFarma — Plan de la Opción A (MVP real)

> Buscador comunitario de medicamentos escasos en Panamá: quién tiene, a qué precio y cuándo se confirmó.
> El prototipo visual aprobado está en [`prototype/index.html`](prototype/index.html). Es la referencia de diseño.

## Decisiones tomadas

| Tema         | Decisión                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hosting      | Droplet de DigitalOcean con Docker Compose (Next.js + Postgres/PostGIS + Caddy), igual que ShedulerApp                                     |
| Arquitectura | Next.js fullstack (App Router + Route Handlers). La lógica vive en `src/server/services`, para que el bot de WhatsApp la reutilice después |
| Login        | Auth.js: Google + enlace mágico por correo. Buscar no requiere cuenta; reportar y crear alertas sí                                         |
| Lenguaje     | TypeScript estricto                                                                                                                        |
| Estilos      | Tailwind con los tokens del prototipo (lima, azul marino, verde bosque, pasteles)                                                          |

## Stack

| Capa                | Tecnología                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework           | Next.js (App Router, versión estable más reciente) + React Server Components                                         |
| Estilos             | Tailwind CSS; fuentes Archivo, Plus Jakarta Sans y JetBrains Mono vía `next/font`                                    |
| DB                  | PostgreSQL + PostGIS (imagen `postgis/postgis`)                                                                      |
| ORM                 | Prisma (columnas geográficas con `Unsupported("geography(Point,4326)")` y consultas espaciales con `$queryRaw`)      |
| Auth                | Auth.js (NextAuth) + Prisma Adapter. Proveedores: Google y Email (nodemailer, mismo SMTP de ShedulerApp)             |
| Mapa                | Leaflet + react-leaflet, teselas de OpenStreetMap (o CARTO/MapTiler si crece el tráfico)                             |
| Validación          | Zod (entradas de API y formularios)                                                                                  |
| Fotos               | Cloudflare R2 (subida directa con URL firmada) + `sharp` en el worker para quitar EXIF y generar variantes AVIF/WebP |
| CDN / borde         | Cloudflare en modo proxy delante del droplet: caché de estáticos, Brotli, HTTP/3, WAF                                |
| Caché y límites     | Redis (caché de disponibilidad y autocompletado, límites de uso)                                                     |
| Cola de trabajos    | BullMQ sobre Redis, con un contenedor `worker` que usa el mismo código (`src/server/services`)                       |
| Correo              | nodemailer + plantillas React Email (se envían desde la cola)                                                        |
| Push                | Web Push (PWA) con claves VAPID (se envía desde la cola)                                                             |
| Datos en el cliente | TanStack Query (deduplicación y caché) y TanStack Virtual (listas largas)                                            |
| Observabilidad      | OpenTelemetry (`instrumentation.ts`) → Sentry: trazas, peticiones lentas y errores                                   |
| Tests               | Vitest (servicios), Playwright (flujos clave), Lighthouse CI (presupuesto de rendimiento)                            |
| Calidad             | ESLint, Prettier, `tsc --noEmit`, `knip` (dependencias sin usar), límite de peso del bundle, GitHub Actions          |
| Analítica           | Umami self-hosted (sin cookies) + Web Vitals de usuarios reales                                                      |

## Estructura del repo

```
MyFarma/
├── prototype/                 # prototipo HTML aprobado (referencia visual)
├── src/
│   ├── app/
│   │   ├── (public)/          # inicio, /buscar, /m/[slug] (resultados), /sucursal/[id]
│   │   ├── (auth)/            # /reportar, /alertas, /cuenta
│   │   ├── admin/             # moderación (rol ADMIN)
│   │   └── api/               # route handlers: /api/search, /api/reports, /api/alerts, /api/auth/[...]
│   ├── components/            # UI: MedCard, BranchCard, StatusPill, MapView, Radar, BlisterHero…
│   ├── server/
│   │   ├── db.ts              # cliente Prisma
│   │   ├── services/          # search, reports, availability, alerts, notifications (reutilizable por el bot)
│   │   └── geo.ts             # helpers PostGIS (ST_DWithin, ST_Distance)
│   └── lib/                   # utils, zod schemas, formato B/., fechas relativas
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/                  # medicamentos, condiciones, cadenas y sucursales (CSV)
├── docker-compose.yml         # dev: postgis + mailpit
├── docker-compose.prod.yml    # prod: app + postgis + caddy + umami
├── Caddyfile
└── deploy.sh
```

## Modelo de datos (borrador)

```prisma
enum StockStatus { AVAILABLE  LOW  OUT }          // Hay / Quedan pocas / No hay
enum Role        { USER  ADMIN }
enum Channel     { EMAIL  PUSH  WHATSAPP }

model Condition   { id, slug, name, colorToken, medications MedicationCondition[] }

model Medication {
  id, slug
  activeIngredient   // "Metotrexato"
  strength           // "2.5 mg"
  form               // "Tabletas"
  pack               // "Caja x 50"
  requiresRx  Boolean
  scarceInCss Boolean   // marcado por admin
  aliases     String[]  // marcas comerciales y errores de tipeo comunes, para la búsqueda
}

model Chain   { id, name, website, colorToken }
model Branch  {
  id, chainId, name, address, phone, hours Json
  location   Unsupported("geography(Point,4326)")   // índice GIST
  verified   Boolean
}

model Report {
  id, userId, medicationId, branchId
  status     StockStatus
  priceCents Int?          // B/. en centavos
  photoKey   String?
  createdAt
  hidden     Boolean       // moderación
}

model Confirmation { id, reportId, userId, agrees Boolean, createdAt }   // "Sí había / No había"

// Estado actual por (sucursal, medicamento). Se recalcula en cada reporte.
model Availability {
  branchId, medicationId  @@id([branchId, medicationId])
  status, priceCents, confirmedAt, confirmations Int, lastReportId
}

model Alert {
  id, userId, medicationId
  center    Unsupported("geography(Point,4326)")
  radiusKm  Float
  channels  Channel[]
  active    Boolean
  lastNotifiedAt DateTime?
}

model PushSubscription { id, userId, endpoint, keys Json }
// + modelos de Auth.js: User (con role), Account, Session, VerificationToken
```

### Reglas de disponibilidad

- El estado de una sucursal es el **último reporte**, reforzado o corregido por las confirmaciones posteriores.
- Frescura: menos de 3 h = "fresco" (punto pulsante); de 3 a 24 h = normal; de 24 a 72 h = "puede haber cambiado"; más de 72 h = vuelve a "sin datos recientes".
- Si un "Ya no hay" contradice un "Hay" reciente, gana el más nuevo y se guarda el historial completo.

### Reglas contra abuso

- Para reportar hay que iniciar sesión. Límite de N reportes por hora por usuario y no repetir la misma sucursal y medicamento en 30 min.
- Los reportes con foto ganan peso. Los admins pueden ocultar reportes y bloquear usuarios.
- Nunca se piden datos de la receta ni de la cédula. Las fotos se guardan sin EXIF.

## Flujos y API

| Flujo              | Endpoint / ruta                           | Notas                                                                                     |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| Autocompletar      | `GET /api/search?q=`                      | Busca por principio activo, alias y condición, ignorando acentos (`unaccent` + `pg_trgm`) |
| Resultados         | `/m/[slug]?lat&lng&sort`                  | Consulta en el servidor con `ST_Distance`; filtros de existencia y frescura               |
| Detalle sucursal   | `/sucursal/[id]?med=`                     | Historial de reportes y confirmaciones                                                    |
| Reportar           | `POST /api/reports`                       | Zod → crea Report → recalcula Availability → dispara alertas                              |
| Confirmar          | `POST /api/reports/:id/confirm`           | "Sí había / No había"                                                                     |
| Alertas            | `GET/POST/PATCH/DELETE /api/alerts`       | Radio de 1 a 10 km, canales                                                               |
| Disparo de alertas | servicio `alerts.onAvailabilityChanged()` | `ST_DWithin(alert.center, branch.location, radius)`; máximo 1 aviso por alerta cada 12 h  |

La ubicación del usuario se obtiene con la geolocalización del navegador, con permiso. Como alternativa, el usuario elige su corregimiento o barrio en una lista.

## Fases

| Fase                         | Entregable                                                                                                           | Hecho cuando                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **F0 · Base**                | Repo git, Next.js + Tailwind con tokens y fuentes, Prisma + PostGIS + Redis + Mailpit en Docker, ESLint/Prettier, CI | `pnpm dev` levanta la app con la DB local; `/api/health` responde con PostGIS y Redis; CI en verde |
| **F1 · Catálogo y búsqueda** | Schema + seed, inicio, autocompletar, resultados con mapa real, ficha de sucursal (solo lectura)                     | Busco "metotrexato" y veo las sucursales del seed ordenadas por distancia                          |
| **F2 · Cuentas y reportes**  | Auth.js (Google + correo), formulario de reporte con foto, confirmaciones, recálculo de disponibilidad               | Un usuario logueado reporta y el resultado cambia al instante                                      |
| **F3 · Alertas**             | CRUD de alertas con radar, correo y Web Push, PWA instalable                                                         | Al reportar "Hay", llega un correo o push a quien tiene alerta en el radio                         |
| **F4 · Moderación y pulido** | Panel admin, rate limits, página de privacidad, SEO/OG, estados vacíos y de error, modo oscuro                       | Checklist de lanzamiento completa                                                                  |
| **F5 · Deploy y beta**       | `docker-compose.prod.yml`, Caddy con HTTPS, backups diarios con `pg_dump`, Umami                                     | En línea con un grupo pequeño de pacientes (tu hermana primero)                                    |
| **Después**                  | Bot de WhatsApp (reutiliza `server/services`), lectura de webs de farmacias, acuerdos con cadenas                    | —                                                                                                  |

## Rendimiento (checklist obligatorio)

Cada punto se aplica desde la fase en que aparece la funcionalidad, no al final.

| Punto                                  | Cómo se cumple                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderizar en servidor o en build      | Server Components. Inicio y `/m/[slug]` estáticos con `revalidateTag` cuando entra un reporte                                                                                                                 |
| Skeletons                              | `loading.tsx` por ruta + `<Suspense>` con streaming                                                                                                                                                           |
| JS dividido por página                 | Lo hace el App Router por ruta; `next/dynamic` para mapa, radar y subidor de fotos                                                                                                                            |
| Debounce en búsqueda                   | 250 ms + `AbortController` que cancela la petición anterior                                                                                                                                                   |
| Sin llamadas duplicadas                | `cache()` de React en el servidor y TanStack Query en el cliente                                                                                                                                              |
| Peticiones en paralelo                 | `Promise.all` en Server Components, sin cascadas                                                                                                                                                              |
| UI optimista                           | `useOptimistic` en confirmaciones, reportes y alertas                                                                                                                                                         |
| Sin N+1 / solo columnas necesarias     | Resultados en una sola consulta SQL (disponibilidad + sucursal + distancia) con `select` explícito; log de consultas en desarrollo                                                                            |
| Índices                                | GIST en `Branch.location` y `Alert.center`; GIN trigram en nombres y alias de medicamentos; `(medicationId, status)` en Availability; `(branchId, medicationId, createdAt)` y `(userId, createdAt)` en Report |
| Paginación                             | Por cursor en historial, feed y admin                                                                                                                                                                         |
| Listas virtualizadas                   | TanStack Virtual en historial y tablas de admin                                                                                                                                                               |
| Pool de conexiones                     | Pool de Prisma con `connection_limit`; PgBouncer al escalar a varias instancias                                                                                                                               |
| Servidor cerca de la DB                | App y Postgres en el mismo droplet                                                                                                                                                                            |
| Caché Redis                            | Disponibilidad por medicamento y autocompletado (TTL corto, se invalida al reportar)                                                                                                                          |
| Cola de trabajos                       | Fotos, correos, push y disparo de alertas en BullMQ                                                                                                                                                           |
| Timeouts externos                      | `AbortSignal.timeout()` en SMTP, push, R2 y OAuth; los reintentos los hace la cola                                                                                                                            |
| Compresión                             | `encode zstd gzip` en Caddy; Brotli en Cloudflare                                                                                                                                                             |
| Estáticos en CDN y caché del navegador | Archivos con hash y `Cache-Control: immutable` de 1 año, en caché de Cloudflare                                                                                                                               |
| Fuentes                                | `next/font` (alojadas en el propio servidor), variables y solo el subconjunto latino                                                                                                                          |
| Imágenes                               | Variantes AVIF/WebP pregeneradas, `srcset`, `loading="lazy"` fuera de pantalla                                                                                                                                |
| Scripts de terceros                    | `next/script` con `lazyOnload`                                                                                                                                                                                |
| Re-renders                             | Poco estado en el cliente y React Compiler activado                                                                                                                                                           |
| Dependencias sin usar                  | `knip` en CI + presupuesto de bundle                                                                                                                                                                          |
| Peticiones lentas                      | OpenTelemetry → Sentry, con tracing de Prisma                                                                                                                                                                 |
| Usuarios reales                        | `useReportWebVitals` → Umami; Lighthouse CI con 4G lenta; pruebas en un Android de gama baja                                                                                                                  |
| Varias instancias                      | App sin estado propio (sesiones en DB, estado compartido en Redis); Caddy puede repartir entre réplicas                                                                                                       |
| IA token a token                       | No aplica en el MVP; si el bot usa IA, la respuesta se transmite por streaming                                                                                                                                |

## Imágenes (fotos de reportes)

1. **En el cliente:** se redimensiona a 1600 px como máximo y se convierte a WebP antes de subir (unos 200 KB en vez de 4 MB).
2. **Subida directa a R2** con una URL firmada de corta duración. La foto no pasa por el droplet.
3. **El worker (BullMQ + `sharp`):** borra el EXIF (incluido el **GPS**), genera AVIF y WebP en 400, 800 y 1200 px y borra el original.
4. **Entrega** desde un subdominio en Cloudflare con caché `immutable`. `next/image` usa un loader propio, así no se optimiza en el servidor.
5. **Moderación:** la foto queda `pending` hasta que el worker la procesa; el admin puede ocultarla.

## Datos iniciales (lo más laborioso fuera del código)

1. **Medicamentos:** 30 a 50 crónicos que suelen escasear en la CSS: artritis, diabetes, hipertensión, tiroides, lupus, anticoagulantes, etc. Cada uno con principio activo, concentración y presentación.
2. **Cadenas y sucursales reales:** nombre, dirección, teléfono, horario y coordenadas. Se cargan desde un CSV que llenamos a mano con datos públicos (páginas de "sucursales" de cada cadena). Las coordenadas se toman marcando el punto en el mapa, para no depender de un geocodificador.
3. **Sin reportes inventados en producción.** Los primeros reportes los hacen la beta y tu hermana.

## Legal y privacidad

- Aviso visible: MyFarma informa, no vende, y los medicamentos con receta requieren receta.
- Política de privacidad alineada con la ley de protección de datos personales de Panamá (Ley 81 de 2019). Antes del lanzamiento hay que validarla con alguien que conozca la ley.
- No se usan logos ni marcas de las cadenas sin permiso; se muestra su nombre como dato.

## Para el portafolio

- README con capturas, diagrama de arquitectura y la historia del proyecto (el problema real de tu hermana).
- Demo pública con datos de ejemplo separada de producción, o un modo demo.
- Decisiones técnicas documentadas: PostGIS, frescura de datos, reglas contra abuso.
