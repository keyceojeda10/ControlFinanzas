#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# EL VIGILANTE DEL RESPALDO
#
# ── POR QUE EXISTE ────────────────────────────────────────────────────────
#
# Un script no puede avisar de que NO se esta ejecutando. Es la unica clase de
# fallo que no puede detectar por si mismo, y es exactamente la que tumbo el
# respaldo de Control Finanzas durante 140 noches: cron lo llamaba, el sistema
# devolvia «Permission denied», y el script —que nunca llego a arrancar— no
# tuvo ocasion de quejarse.
#
# Asi que hace falta alguien de fuera que mire el reloj. Esto es ese alguien.
#
# No sabe nada de bases de datos ni de Google Drive. Solo sabe una cosa:
# «¿cuando fue la ultima vez que el respaldo dijo que habia terminado bien?».
# Si esa marca tiene mas de UMBRAL_HORAS, grita por Telegram.
#
# ── UNA REGLA QUE NO SE SALTA ─────────────────────────────────────────────
#
# El vigilante NUNCA arregla nada ni vuelve a lanzar el respaldo. Solo avisa.
# Un vigilante que intenta arreglar el problema acaba escondiendolo, que es de
# donde venimos.
#
#   cron:  0 9 * * * /bin/bash /opt/cf-backup/vigilante.sh
#
# A las 9 de la mañana: el respaldo corre a las 3, asi que si a las 9 no hay
# marca fresca es que lo de esta noche no paso.
# ═══════════════════════════════════════════════════════════════════════════

set -uo pipefail

APP_DIR="/home/control-finanzas"
ESTADO_DIR="/opt/cf-backup"
MARCA_EXITO="${ESTADO_DIR}/ULTIMO-EXITO"
UMBRAL_HORAS=30   # el respaldo es diario; 30h da margen sin dejar pasar dos dias

set -a
# shellcheck disable=SC1091
source "${APP_DIR}/.env" 2>/dev/null || true
set +a

avisar() {
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -sS --max-time 20 -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=$1" >/dev/null 2>&1 || true
    fi
    echo "$1"
}

AHORA=$(date +%s)

if [ ! -f "$MARCA_EXITO" ]; then
    avisar "🔴 RESPALDO — Control Finanzas

No existe ninguna marca de respaldo correcto en ${MARCA_EXITO}.
O nunca ha corrido, o alguien borro el estado.

Servidor: $(hostname)"
    exit 1
fi

ULTIMO=$(cat "$MARCA_EXITO" 2>/dev/null || echo 0)
HORAS=$(( (AHORA - ULTIMO) / 3600 ))

if [ "$HORAS" -gt "$UMBRAL_HORAS" ]; then
    DIAS=$(( HORAS / 24 ))
    avisar "🔴 RESPALDO CAIDO — Control Finanzas

El ultimo respaldo correcto fue hace ${HORAS} horas (${DIAS} dias).
Fecha: $(date -d "@${ULTIMO}" '+%Y-%m-%d %H:%M')

El respaldo deberia correr cada noche a las 3:00.
Servidor: $(hostname)

Revisa: tail -40 /home/backups/cf/backup.log"
    exit 1
fi

echo "OK: ultimo respaldo hace ${HORAS}h ($(date -d "@${ULTIMO}" '+%Y-%m-%d %H:%M'))"
