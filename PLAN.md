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

| Estado | Fase                         | Entregable                                                                                                                             | Hecho cuando                                                                                       |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ✅     | **F0 · Base**                | Repo git, Next.js + Tailwind con tokens y fuentes, Prisma + PostGIS + Redis + Mailpit en Docker, ESLint/Prettier, CI                   | `pnpm dev` levanta la app con la DB local; `/api/health` responde con PostGIS y Redis; CI en verde |
| ✅     | **F1 · Catálogo y búsqueda** | Schema + seed, inicio, autocompletar, resultados con mapa real, ficha de sucursal (solo lectura)                                       | Busco "metotrexato" y veo las sucursales del seed ordenadas por distancia                          |
| ✅     | **Deploy temprano**          | Droplet NYC1 aprovisionado, imágenes en GHCR, Caddy + Cloudflare, pipeline push → producción                                           | https://myfarma.net en línea; cada push a `main` despliega en ~2 min                               |
| ✅     | **F2a · Cuentas y reportes** | Backups a R2, Auth.js (Google + correo), formulario de reporte, confirmaciones, recálculo de disponibilidad                            | Un usuario logueado reporta y el resultado cambia al instante para todos                           |
| ✅     | **F2b · Fotos**              | Subida directa a R2, worker BullMQ + `sharp` (sin EXIF), variantes AVIF/WebP, moderación                                               | Un reporte con foto se ve sin datos GPS y en el formato adecuado                                   |
| 🧪     | **F3 · Alertas**             | CRUD de alertas con radar, correo y Web Push, PWA instalable                                                                           | Al reportar "Hay", llega un correo o push a quien tiene alerta en el radio                         |
| ⏳     | **F4 · Moderación y pulido** | Panel admin, página de privacidad, SEO/OG (404 reales, abrir `robots.txt`), agrupar marcadores del mapa, estados de error, modo oscuro | Checklist de lanzamiento completa                                                                  |
| ⏳     | **F5 · Beta y lanzamiento**  | Mapa propio (PMTiles en R2), Umami, Sentry, Lighthouse CI, sucursales reales verificadas                                               | En línea con un grupo pequeño de pacientes (tu hermana primero)                                    |
| ⏳     | **Después**                  | Bot de WhatsApp (reutiliza `server/services`), lectura de webs de farmacias, acuerdos con cadenas                                      | —                                                                                                  |

## F2 en detalle (siguiente sesión)

### Antes de empezar: lo que prepara el dueño del proyecto

- [x] **Google OAuth** (Google Cloud Console → APIs y servicios → Credenciales → ID de cliente OAuth, tipo "Aplicación web").
  - Orígenes autorizados: `https://myfarma.net` y `http://localhost:3000`
  - URI de redirección: `https://myfarma.net/api/auth/callback/google` y `http://localhost:3000/api/auth/callback/google`
  - Pantalla de consentimiento: nombre "MyFarma", correo de soporte, dominio `myfarma.net`
  - Entregar: `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`
- [x] **Correo transaccional** para los enlaces mágicos en producción. Recomendado: **Resend** (3,000 correos/mes gratis).
  - Verificar el dominio `myfarma.net` (registros SPF/DKIM en Cloudflare)
  - Entregar: API key o credenciales SMTP; remitente `MyFarma <hola@myfarma.net>`
- [x] **Cloudflare R2** activado (pide tarjeta; el plan gratis de 10 GB alcanza).
  - Buckets: `myfarma-backups` (privado) y `myfarma-photos` (F2b)
  - Token de API con permisos de lectura y escritura solo para esos buckets
  - Entregar: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

> Credenciales listas el 2026-11-25. En el servidor: `AUTH_*`, `SMTP_*` (Resend por el puerto **2465**, porque DigitalOcean bloquea 25/465/587), `R2_*` y `ALERT_EMAIL`.
>
> Los secretos de producción se cargan en `/opt/myfarma/.env` del servidor y, si el CI los necesita, con `gh secret set` desde Git Bash (no CMD).

### F2a · Cuentas y reportes

**0. Backups (antes de cualquier dato real)** ✅

- [x] `deploy/backup.sh` con timer de systemd (03:00): `pg_dump -Fc` → rclone → R2 `myfarma-backups/AAAA/MM/DD.dump`
- [x] Retención de 30 días (regla de ciclo de vida en el bucket)
- [x] `deploy/restore.sh` (prueba en base temporal, `--list`, `--real`) y **prueba real de restauración** hecha el 2026-11-25
- [x] Alerta por correo (Resend → `ALERT_EMAIL`) si el backup falla; último backup visible en `/api/health`

**1. Login (Auth.js)** ✅

- [x] Modelos de Auth.js en Prisma (Account, Session, VerificationToken) + migración
- [x] Proveedores: Google y enlace por correo (nodemailer → Mailpit en local, Resend por el puerto 2465 en producción). Máximo 5 enlaces por hora por correo
- [x] Sesiones en base de datos; `AUTH_SECRET` en el `.env` del servidor
- [x] Páginas: `/entrar` (Google o correo), `/entrar/revisa`, `/cuenta` (nombre público editable, mis reportes, salir)
- [x] Header: botón "Entrar" o iniciales (enlace a `/cuenta`)
- [x] Nombre público: nombre + inicial ("Mariela G."); nunca el correo (`src/lib/people.ts`)
- [x] Sesión dentro de `<Suspense>` con `currentUser()` (llama a `connection()` antes de `auth()`: Auth.js usa `crypto` y eso no puede pasar en el prerender)

**2. Reportar** ✅

- [x] `/reportar` con el diseño del prototipo: medicamento, sucursal, Hay / Quedan pocas / No hay, precio opcional, vista previa en vivo (la foto llega en la F2b)
- [x] Atajo desde la ficha de sucursal: `/reportar?med=<slug>&sucursal=<slug>`; sin sesión pide entrar y vuelve con todo elegido
- [x] Server Action con validación Zod y sesión obligatoria
- [x] Transacción con candado por (sucursal, medicamento): crear `Report` → recalcular `Availability` (reglas puras en `src/lib/availability-rules.ts`)
- [x] `updateTag` de disponibilidad, resumen, reportes y "mis reportes": el cambio se ve al instante
- [x] Límites con Redis: 10 reportes por hora por usuario; misma sucursal + medicamento cada 30 min
- [x] Pantalla de éxito ("¡Gracias!") con confeti, como en el prototipo
- [ ] El seed deja de crear reportes de ejemplo en producción (`SEED_DEMO=0`) cuando entren reportes reales

**3. Confirmaciones** ✅

- [x] "Sí había / Ya no había" (o "Tampoco había / Sí había" sobre un No hay) en la ficha, con `useOptimistic`
- [x] Reglas: un voto por usuario por reporte vigente (se puede cambiar), no se confirma el propio; la observación más nueva gana
- [x] El historial muestra quién confirmó y quién no coincidió (nombre público)

**4. Pruebas** ✅

- [x] Vitest (`pnpm test`): reglas de disponibilidad, precio, nombre público, redirección segura. Falta: límites de uso contra Redis
- [x] Playwright (`pnpm test:e2e`): entrar con correo (Mailpit) → reportar → otra persona confirma → el estado cambia para todos
- [x] Job `e2e` en el CI con Postgres/PostGIS, Redis y Mailpit; el deploy espera a que pase

### F2b · Fotos ✅

Dos buckets: `myfarma-uploads` (privado, originales, se borran solos al día) y `myfarma-photos` (público en `img.myfarma.net`, solo variantes limpias).

- [x] URL firmada de R2 (5 min, solo `image/webp` o `image/jpeg`, tamaño exacto firmado, máx. 4 MB, 20 por hora, solo con sesión, clave `u/<userId>/…`)
- [x] En el cliente: endereza, reduce a 1600 px y convierte a WebP (JPEG si el navegador no puede) antes de subir
- [x] Contenedor `worker` (BullMQ + `sharp`, imagen de 441 MB): quita EXIF/GPS, genera AVIF y WebP en 400/800/1200 px, borra el original y avisa a la app (`/api/internal/revalidate`, bloqueada en Caddy)
- [x] Estados `PENDING → READY | FAILED | HIDDEN`; barrido cada 5 min de las pendientes (Redis no guarda la cola en disco); botón "Ocultar foto" para ADMIN que borra las variantes
- [x] `img.myfarma.net` con `Cache-Control: immutable`; `<picture>` con AVIF + WebP y `srcset` (en vez de un loader de `next/image`)
- [x] Prueba: Vitest confirma que una foto con GPS sale sin EXIF; Playwright (`E2E_PHOTOS=1`, no corre en el CI) sube una foto real y verifica la variante pública

### F3 · Alertas 🧪

- [x] Modelos `Alert` (centro PostGIS por trigger, radio 1–10 km, canales, activa, `lastNotifiedAt`), `AlertDelivery` (una por alerta y reporte) y `PushSubscription`
- [x] `/alertas` con el diseño del prototipo: medicamento, "Mi ubicación" o barrio, radar con las sucursales del radio y cuántas tienen hoy, canales Correo/Celular; lista con pausar, borrar y "Probar aviso al celular". Máximo 10 alertas por persona; el punto se guarda redondeado a ~100 m
- [x] Disparo: un reporte o confirmación que deja "Hay"/"Quedan pocas" encola un trabajo; el worker toma las alertas con `UPDATE … RETURNING` (`ST_DWithin`, nunca a quien reportó, máximo 1 aviso cada 12 h) y manda correo y/o push
- [x] Correo con "Ver detalle", "Cómo llegar" y baja: página con botón (los filtros de correo abren enlaces solos) + `List-Unsubscribe` de un clic (RFC 8058)
- [x] Web Push con VAPID (`web-push`); se borran las suscripciones que el navegador dio de baja (404/410)
- [x] PWA: `manifest.ts`, íconos normal/maskable/badge, `public/sw.js` (solo push, sin caché). En iPhone el push requiere instalar la app (la página lo explica)
- [x] Pruebas: Vitest (firmas, radar) y Playwright (alerta → reporte en el radio → correo en Mailpit → baja). El push real no se puede probar sin interfaz: se prueba a mano con "Probar aviso al celular"

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
