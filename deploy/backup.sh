#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# MyFarma — backup diario de Postgres a Cloudflare R2.
#
#   bash /opt/myfarma/backup.sh
#
# Lo ejecuta el timer de systemd `myfarma-backup` (03:00, hora de Panamá).
# pg_dump -Fc (comprimido) → R2 myfarma-backups/AAAA/MM/DD.dump
# La retención de 30 días es una regla de ciclo de vida del bucket.
# Si sale bien, deja state/backup.json (lo muestra /api/health).
# Si falla, avisa por correo a ALERT_EMAIL con Resend.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /opt/myfarma

set -a; . ./.env; set +a
: "${R2_ACCOUNT_ID:?Falta R2_ACCOUNT_ID}" "${R2_BACKUP_BUCKET:?Falta R2_BACKUP_BUCKET}"

COMPOSE="docker compose -f docker-compose.prod.yml"
KEY="$(date +%Y/%m/%d).dump"

# rclone se configura solo con variables de entorno: nada de secretos en disco aparte del .env.
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

alert() {
  echo "✗ $1" >&2
  [ -n "${ALERT_EMAIL:-}" ] && [ -n "${SMTP_PASS:-}" ] || return 0
  curl -fsS --max-time 15 https://api.resend.com/emails \
    -H "Authorization: Bearer ${SMTP_PASS}" -H "Content-Type: application/json" \
    -d "$(printf '{"from":%s,"to":[%s],"subject":"MyFarma: falló el backup","text":%s}' \
      "\"${EMAIL_FROM//\"/}\"" "\"$ALERT_EMAIL\"" \
      "\"El backup del $(date '+%F %R') falló: $1. Revisa: journalctl -u myfarma-backup\"")" \
    >/dev/null || echo "✗ Tampoco se pudo enviar el correo de alerta" >&2
}
trap 'alert "error en la línea $LINENO"' ERR

echo "▶ pg_dump → r2:${R2_BACKUP_BUCKET}/${KEY}"
$COMPOSE exec -T db pg_dump -Fc -U myfarma myfarma \
  | rclone rcat "r2:${R2_BACKUP_BUCKET}/${KEY}"

# Un dump vacío o truncado no cuenta como backup.
BYTES="$(rclone size --json "r2:${R2_BACKUP_BUCKET}/${KEY}" | sed -E 's/.*"bytes":([0-9]+).*/\1/')"
if [ "${BYTES:-0}" -lt 10000 ]; then
  alert "el archivo ${KEY} pesa solo ${BYTES:-0} bytes"
  exit 1
fi

mkdir -p state
printf '{"at":"%s","key":"%s","bytes":%s}\n' "$(date -Is)" "$KEY" "$BYTES" > state/backup.json
echo "✓ Backup ${KEY} (${BYTES} bytes)"
