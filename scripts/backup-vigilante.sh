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
MARCA_FUERA="${ESTADO_DIR}/ULTIMO-EXITO-FUERA"

# ⚠ DOS UMBRALES PORQUE SON DOS RIESGOS DISTINTOS.
#
# El 8 ago 2026 este vigilante grito «RESPALDO CAIDO — hace 160 horas» durante
# siete noches, y habia siete respaldos locales; el ultimo, de hacia una hora.
# Lo que fallaba era la subida a Drive, y como el script moria ahi, la marca de
# exito no se escribia. El aviso era literalmente falso.
#
# Un aviso que exagera se acaba ignorando, y entonces no sirve el dia que sea
# verdad. Asi que ahora:
#   · sin copia LOCAL en 30 h  → CRITICO. No hay respaldo de nada.
#   · sin copia FUERA en 48 h  → GRAVE. Hay respaldo, pero en el mismo disco
#                                que la base: si el VPS muere, muere con el.
UMBRAL_HORAS=30
UMBRAL_FUERA_HORAS=48

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
    avisar "🔴 SIN RESPALDO — Control Finanzas

No hay copia local desde hace ${HORAS} horas (${DIAS} dias).
Ultima: $(date -d "@${ULTIMO}" '+%Y-%m-%d %H:%M')

Deberia correr cada noche a las 3:00.
Servidor: $(hostname)

Revisa: tail -40 /home/backups/cf/backup.log"
    exit 1
fi

# ── La copia de fuera, que es otra cosa ────────────────────────────────────
FUERA=$(cat "$MARCA_FUERA" 2>/dev/null || echo 0)
HORAS_FUERA=$(( (AHORA - FUERA) / 3600 ))

if [ "$HORAS_FUERA" -gt "$UMBRAL_FUERA_HORAS" ]; then
    # ⚠ Sin marca, `HORAS_FUERA` se cuenta desde 1970 y salia «20673 dias sin
    #   subir», que es ruido. Si nunca ha subido, se dice asi.
    if [ "$FUERA" -gt 0 ]; then
        CUANTO="${HORAS_FUERA} horas ($(( HORAS_FUERA / 24 )) dias) sin subir"
        CUANDO=$(date -d "@${FUERA}" '+%Y-%m-%d %H:%M')
    else
        CUANTO="nunca ha subido desde que se separo la cuenta"
        CUANDO="nunca"
    fi
    avisar "🟠 SIN COPIA FUERA — Control Finanzas

El respaldo local SI se esta haciendo (el ultimo, hace ${HORAS} h).
Lo que falla es el duplicado en Google Drive: ${CUANTO}.
Ultima subida: ${CUANDO}

Riesgo: la unica copia vive en el mismo disco que la base.
Si el VPS se pierde, se pierde todo.

Casi siempre es el limite de la API de Google (el cliente compartido de
rclone). El arreglo de fondo es un client_id propio:
https://rclone.org/drive/#making-your-own-client-id

Servidor: $(hostname)
Revisa: tail -40 /home/backups/cf/backup.log"
    exit 1
fi

echo "OK: local hace ${HORAS}h · fuera hace ${HORAS_FUERA}h"
