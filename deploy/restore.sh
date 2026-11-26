#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# MyFarma — restaurar un backup de R2.
#
#   bash /opt/myfarma/restore.sh                  # prueba: último backup → base temporal, la cuenta y la borra
#   bash /opt/myfarma/restore.sh 2026/11/26       # prueba con un día concreto
#   bash /opt/myfarma/restore.sh 2026/11/26 --real   # REEMPLAZA la base de producción (pide confirmación)
#   bash /opt/myfarma/restore.sh --list           # lista los backups disponibles
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /opt/myfarma

set -a; . ./.env; set +a
COMPOSE="docker compose -f docker-compose.prod.yml"

rclone() {
  docker run --rm -i --memory 256m \
    -e RCLONE_CONFIG_R2_TYPE=s3 \
    -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
    rclone/rclone:1 -q "$@"
}
psql() { $COMPOSE exec -T db psql -v ON_ERROR_STOP=1 -U myfarma "$@"; }

if [ "${1:-}" = "--list" ]; then
  rclone lsl "r2:${R2_BACKUP_BUCKET}" | sort -k2,3
  exit 0
fi

DAY="${1:-$(rclone lsf -R --files-only "r2:${R2_BACKUP_BUCKET}" | sort | tail -1 | sed 's/\.dump$//')}"
[ -n "$DAY" ] || { echo "✗ No hay backups en R2"; exit 1; }
KEY="${DAY}.dump"
REAL="${2:-}"

if [ "$REAL" = "--real" ]; then
  TARGET=myfarma
  echo "⚠ Esto BORRA la base de producción y la reemplaza con ${KEY}."
  read -r -p "Escribe RESTAURAR para seguir: " ok
  [ "$ok" = "RESTAURAR" ] || { echo "Cancelado"; exit 1; }
  $COMPOSE stop app
else
  TARGET=myfarma_restore_test
fi

echo "▶ Descargando ${KEY} → base ${TARGET}"
if [ "$TARGET" = "myfarma" ]; then
  rclone cat "r2:${R2_BACKUP_BUCKET}/${KEY}" \
    | $COMPOSE exec -T db pg_restore -U myfarma -d myfarma --clean --if-exists --no-owner --exit-on-error
  $COMPOSE up -d --wait app
  echo "✓ Producción restaurada desde ${KEY}"
  exit 0
fi

psql -d postgres -qc "DROP DATABASE IF EXISTS ${TARGET}" -c "CREATE DATABASE ${TARGET}"
trap 'psql -d postgres -qc "DROP DATABASE IF EXISTS ${TARGET}"' EXIT
rclone cat "r2:${R2_BACKUP_BUCKET}/${KEY}" \
  | $COMPOSE exec -T db pg_restore -U myfarma -d "$TARGET" --no-owner --exit-on-error

echo "▶ Comparando con producción"
COUNT="SELECT 'medications', count(*) FROM medications UNION ALL SELECT 'branches', count(*) FROM branches
       UNION ALL SELECT 'reports', count(*) FROM reports UNION ALL SELECT 'users', count(*) FROM users
       UNION ALL SELECT 'branches con location', count(*) FROM branches WHERE location IS NOT NULL"
diff <(psql -d "$TARGET" -Atc "$COUNT") <(psql -d myfarma -Atc "$COUNT") \
  && echo "✓ Restauración de prueba OK: los conteos coinciden con producción" \
  || echo "ℹ Los conteos difieren (normal si hubo cambios después del backup). Arriba: backup; abajo: producción."
