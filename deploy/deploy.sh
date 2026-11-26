#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# MyFarma — deploy en el servidor. Lo ejecuta GitHub Actions por SSH:
#
#   bash /opt/myfarma/deploy.sh <tag-de-imagen>
#
# 1. Descarga las imágenes nuevas  2. Aplica migraciones y catálogo
# 3. Reemplaza la app sin bajar la base de datos  4. Limpia imágenes viejas
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /opt/myfarma

TAG="${1:?Falta el tag de la imagen}"
COMPOSE="docker compose -f docker-compose.prod.yml"

# El tag queda guardado en .env: un reinicio del servidor levanta la misma versión.
if grep -q '^TAG=' .env; then sed -i "s/^TAG=.*/TAG=${TAG}/" .env; else echo "TAG=${TAG}" >> .env; fi

echo "▶ Descargando imágenes ${TAG}"
$COMPOSE pull app migrate worker caddy

echo "▶ Base de datos y Redis"
$COMPOSE up -d --wait db redis

echo "▶ Migraciones y catálogo"
$COMPOSE run --rm migrate

echo "▶ Levantando la app"
$COMPOSE up -d --wait --remove-orphans

echo "▶ Recargando Caddy (por si cambió el Caddyfile; sin cortar conexiones)"
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true

echo "▶ Timer de backups diarios"
mkdir -p state
cat > /etc/systemd/system/myfarma-backup.service <<'UNIT'
[Unit]
Description=MyFarma: backup de Postgres a R2
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/bash /opt/myfarma/backup.sh
UNIT
cat > /etc/systemd/system/myfarma-backup.timer <<'UNIT'
[Unit]
Description=MyFarma: backup diario a las 03:00

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now myfarma-backup.timer >/dev/null

echo "▶ Limpiando imágenes sin uso"
docker image prune -f >/dev/null

$COMPOSE ps --format 'table {{.Service}}\t{{.Status}}'
echo "✓ Deploy ${TAG} listo"
