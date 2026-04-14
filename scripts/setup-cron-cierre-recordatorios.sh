#!/bin/bash
# ============================================================
# Setup de cron para recordatorios de cierre de caja
# Ejecutar en VPS: bash /home/control-finanzas/scripts/setup-cron-cierre-recordatorios.sh
# ============================================================

set -euo pipefail

ENV_FILE="${1:-/home/control-finanzas/.env}"
LOG_FILE="/home/backups/cron-cierre-recordatorios.log"
CRON_TAG_MAIN="cf-cierre-recordatorios-main"
CRON_TAG_FINAL="cf-cierre-recordatorios-final"

if ! command -v crontab >/dev/null 2>&1; then
  echo "Error: crontab no esta disponible en este servidor."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl no esta instalado en este servidor."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: no se encontro archivo de entorno en $ENV_FILE"
  exit 1
fi

CRON_SECRET_VALUE=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
if [ -z "${CRON_SECRET_VALUE:-}" ]; then
  echo "Error: CRON_SECRET no esta definido en $ENV_FILE"
  exit 1
fi

APP_BASE_URL_VALUE=$(grep -E '^APP_BASE_URL=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
if [ -z "${APP_BASE_URL_VALUE:-}" ]; then
  APP_BASE_URL_VALUE="https://app.control-finanzas.com"
fi

mkdir -p "$(dirname "$LOG_FILE")"

echo "Configurando cron para cierre-recordatorios"
echo "Env: $ENV_FILE"
echo "App URL: $APP_BASE_URL_VALUE"
echo "Log: $LOG_FILE"

CRON_CMD="/bin/bash -lc 'set -a; source ${ENV_FILE} >/dev/null 2>&1; set +a; if [ -z \"\${CRON_SECRET:-}\" ]; then echo \"CRON_SECRET missing\"; exit 1; fi; curl -fsS -X POST \"\${APP_BASE_URL:-${APP_BASE_URL_VALUE}}/api/cron/cierre-recordatorios\" -H \"x-cron-secret: \${CRON_SECRET}\" >/dev/null'"

CRON_LINE_MAIN="0,30 20-23 * * * ${CRON_CMD} >> ${LOG_FILE} 2>&1 # ${CRON_TAG_MAIN}"
CRON_LINE_FINAL="55 23 * * * ${CRON_CMD} >> ${LOG_FILE} 2>&1 # ${CRON_TAG_FINAL}"

TMP_CRON=$(mktemp)
trap 'rm -f "$TMP_CRON"' EXIT

crontab -l 2>/dev/null | grep -v "$CRON_TAG_MAIN" | grep -v "$CRON_TAG_FINAL" > "$TMP_CRON" || true

echo "$CRON_LINE_MAIN" >> "$TMP_CRON"
echo "$CRON_LINE_FINAL" >> "$TMP_CRON"

crontab "$TMP_CRON"

echo "OK: cron configurado."
echo "Lineas activas:"
crontab -l | grep -E "$CRON_TAG_MAIN|$CRON_TAG_FINAL"

echo "Sugerencia: revisar ejecuciones con"
echo "tail -f $LOG_FILE"
