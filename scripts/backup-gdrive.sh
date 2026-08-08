#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# RESPALDO DE CONTROL FINANZAS
#
# ── POR QUE ESTA REESCRITO ────────────────────────────────────────────────
#
# La version anterior era correcta y aun asi el negocio estuvo 140 noches sin
# un solo respaldo. El 14 de marzo de 2026 corrio bien —la base tenia 11
# organizaciones— y esa misma tarde el archivo perdio el permiso de ejecucion.
# Desde entonces cron lo intento cada madrugada y escribio «Permission denied»
# en /home/backups/cron.log, que nadie lee. El otro log, backup.log, se quedo
# congelado en el ultimo exito, asi que quien lo mirara veia «Backup completado
# exitosamente» y se quedaba tranquilo.
#
# Mientras tanto el negocio paso de 11 organizaciones a 398, y de 13 prestamos
# a 8.398.
#
# El fallo no fue del script: fue que NADIE PODIA SABER que estaba caido. Por
# eso los cambios de abajo son casi todos de deteccion, no de respaldo.
#
# ── QUE CAMBIA ────────────────────────────────────────────────────────────
#
# 1. AVISA POR TELEGRAM. Cualquier fallo, en cualquier linea (`trap ERR`), no
#    solo los dos que la version vieja comprobaba a mano. El aviso viejo iba a
#    un endpoint con `X-Backup-Secret`, y esa clave ya no esta en el .env: la
#    alerta no podia llegar aunque saltara.
# 2. COMPRUEBA QUE EL VOLCADO SIRVE, con tres pruebas que se suman:
#    a) el marcador `-- Dump completed` que escribe mysqldump al terminar bien,
#    b) un piso absoluto contra el tamaño real de la base en information_schema,
#    c) una comparacion con el ultimo volcado bueno: si encoge de golpe, para.
# 3. GUARDA COPIA LOCAL. La version vieja borraba el archivo despues de subirlo
#    (paso 10), asi que la UNICA copia vivia en Google Drive. Si la autorizacion
#    de rclone caduca, te quedas sin nada y sin enterarte.
# 4. EXIGE CIFRADO. El paquete incluye una copia de `.env`, o sea TODOS los
#    secretos de produccion. Subir eso sin cifrar a la nube no es un respaldo,
#    es una filtracion. Antes, si faltaba la clave, avisaba y subia igual.
# 5. DEJA UNA MARCA DE ULTIMO EXITO (`ULTIMO-EXITO`) para que el vigilante
#    —el otro cron— pueda gritar si el respaldo deja de correr. Un script no
#    puede avisar de que no se esta ejecutando; hace falta alguien fuera.
#
# ── DONDE VIVE ────────────────────────────────────────────────────────────
#
# La copia que corre esta en /opt/cf-backup/backup.sh, FUERA del arbol de git,
# para que ningun despliegue ni ningun `git checkout` la pueda romper. Esta de
# aqui es la fuente: si se cambia, hay que copiarla alli.
#
#   cron:  0 3 * * * /bin/bash /opt/cf-backup/backup.sh
#
# Se invoca con `bash` a proposito: asi el permiso de ejecucion deja de ser un
# punto unico de fallo.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/home/control-finanzas"
BACKUP_DIR="/home/backups/cf"
ESTADO_DIR="/opt/cf-backup"
# El destino de la copia de fuera se fija mas abajo, cuando ya se leyo el
# .env (ver REMOTO_FUERA).
RETENCION_LOCAL_DIAS=7
RETENCION_DRIVE_DIAS=60
FECHA=$(date +%Y-%m-%d_%H-%M-%S)
NOMBRE="cf-backup-${FECHA}"
TRABAJO="${BACKUP_DIR}/.trabajo-${FECHA}"
LOG="${BACKUP_DIR}/backup.log"
MARCA_EXITO="${ESTADO_DIR}/ULTIMO-EXITO"
# La copia de fuera lleva su propia marca: son dos cosas distintas.
MARCA_FUERA="${ESTADO_DIR}/ULTIMO-EXITO-FUERA"
TAMANO_PREVIO="${ESTADO_DIR}/ULTIMO-TAMANO"

mkdir -p "$BACKUP_DIR" "$ESTADO_DIR"

set -a
# shellcheck disable=SC1091
source "${APP_DIR}/.env"
set +a

# ─── A donde va la copia de FUERA ─────────────────────────
#
# Sale del .env para que cambiar de proveedor sea UNA LINEA y no editar el
# script en el servidor — que es exactamente como se perdio el permiso de
# ejecucion en marzo y estuvo 140 noches caido.
#
#   BACKUP_REMOTE="b2:cf-respaldos/control-finanzas"
#
# Google Drive queda de valor por defecto solo para no romper nada si el .env
# no lo trae; el plan es B2, porque la cuota de Drive la comparte rclone entre
# todos sus usuarios y estaba agotada.
REMOTO_FUERA="${BACKUP_REMOTE:-gdrive:ControlFinanzas/backups}"

DATABASE_URL=$(echo "${DATABASE_URL:-}" | tr -d '"' | tr -d "'")
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^/]*/\([^?]*\).*|\1|p')

# ─── Aviso y registro ──────────────────────────────────────────────────────

registrar() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

avisar() {
    local texto="$1"
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -sS --max-time 20 -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${texto}" >/dev/null 2>&1 || true
    fi
}

# Cualquier linea que falle pasa por aqui. La version vieja solo comprobaba la
# subida y la verificacion; un fallo del mysqldump moria en silencio.
al_fallar() {
    local linea="$1"
    registrar "FALLO en la linea ${linea}"
    avisar "🔴 RESPALDO FALLIDO — Control Finanzas

Murio en la linea ${linea} del script.
Intento: ${NOMBRE}
Servidor: $(hostname)

Revisa: tail -40 ${LOG}"
    rm -rf "$TRABAJO"
}
trap 'al_fallar $LINENO' ERR

registrar "═══ Iniciando ${NOMBRE} ═══"

if [ -z "$DB_NAME" ]; then
    registrar "No se pudo sacar el nombre de la base del DATABASE_URL"
    exit 1
fi

# El paquete lleva el .env dentro. Sin clave de cifrado NO se sube: preferimos
# quedarnos sin respaldo de hoy antes que dejar los secretos en la nube.
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    registrar "Falta BACKUP_ENCRYPTION_KEY en el .env — el paquete lleva secretos dentro"
    avisar "🔴 RESPALDO FALLIDO — falta BACKUP_ENCRYPTION_KEY en el .env. No se sube nada sin cifrar."
    exit 1
fi

# ─── 1 · Volcado ───────────────────────────────────────────────────────────

mkdir -p "$TRABAJO"
registrar "Volcando ${DB_NAME}..."

mysqldump \
    --single-transaction \
    --routines --triggers --events \
    --quick \
    --lock-tables=false \
    "$DB_NAME" > "${TRABAJO}/database.sql"

BYTES=$(stat -c%s "${TRABAJO}/database.sql")
registrar "Volcado: $(numfmt --to=iec "$BYTES")"

# ─── 2 · Las tres comprobaciones ───────────────────────────────────────────

# (a) mysqldump escribe esta linea SOLO si llego al final. Sin ella, el archivo
#     esta truncado aunque tenga buen tamaño.
if ! tail -5 "${TRABAJO}/database.sql" | grep -q "^-- Dump completed"; then
    registrar "El volcado no termina en '-- Dump completed': esta truncado"
    exit 1
fi

# (b) Piso absoluto contra el tamaño real de la base. Un volcado sano pesa un
#     orden parecido a los datos; uno de 64 KB sobre una base de 240 MB no
#     pasa de aqui.
DATOS_MB=$(mysql -N -e "SELECT COALESCE(ROUND(SUM(data_length)/1048576),1) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo 1)
PISO=$(( DATOS_MB * 1048576 / 4 ))
if [ "$BYTES" -lt "$PISO" ]; then
    registrar "Volcado sospechosamente pequeño: $(numfmt --to=iec "$BYTES") sobre una base de ${DATOS_MB} MB"
    exit 1
fi

# (c) Contra el ultimo volcado bueno. Si de un dia para otro encoge a menos de
#     la mitad, algo se rompio aunque las otras dos pasen.
if [ -f "$TAMANO_PREVIO" ]; then
    PREVIO=$(cat "$TAMANO_PREVIO")
    if [ "$PREVIO" -gt 0 ] && [ "$BYTES" -lt $(( PREVIO / 2 )) ]; then
        registrar "El volcado encogio a la mitad: antes $(numfmt --to=iec "$PREVIO"), hoy $(numfmt --to=iec "$BYTES")"
        exit 1
    fi
fi

# ─── 3 · Empaquetar y cifrar ───────────────────────────────────────────────

cp "${APP_DIR}/.env" "${TRABAJO}/env-backup"
cp "${APP_DIR}/prisma/schema.prisma" "${TRABAJO}/schema.prisma"

registrar "Comprimiendo..."
tar -czf "${BACKUP_DIR}/${NOMBRE}.tar.gz" -C "$BACKUP_DIR" "$(basename "$TRABAJO")"

registrar "Cifrando..."
gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
    --symmetric --cipher-algo AES256 \
    "${BACKUP_DIR}/${NOMBRE}.tar.gz"
rm -f "${BACKUP_DIR}/${NOMBRE}.tar.gz"
rm -rf "$TRABAJO"

ARCHIVO="${NOMBRE}.tar.gz.gpg"
PESO=$(stat -c%s "${BACKUP_DIR}/${ARCHIVO}")
registrar "Paquete: ${ARCHIVO} ($(numfmt --to=iec "$PESO"))"

# ─── 4 · La copia local YA ESTA HECHA. Se marca aqui. ──────────────────────
#
# ⚠ ESTA MARCA SE MOVIO, Y ES EL ARREGLO DEL 8 DE AGOSTO DE 2026.
#
# Estaba al final del script, DESPUES de subir a Drive. Siete noches seguidas la
# subida fallo por el limite de la API de Google, el script murio en la
# verificacion y la marca no se escribio nunca. Resultado: el vigilante grito
# «RESPALDO CAIDO — el ultimo correcto fue hace 160 horas» cuando habia SIETE
# respaldos locales, el ultimo de hacia una hora.
#
# Es el fallo de las 140 noches del reves: entonces el aviso decia que todo iba
# bien estando caido; ahora decia caido estando bien. Las dos veces el problema
# es el mismo: la senal no describe la realidad.
#
# Son DOS cosas distintas y ahora se miden por separado:
#   · copia LOCAL  — el volcado existe y esta cifrado.        CRITICO
#   · copia FUERA  — ademas hay un duplicado en Drive.        GRAVE, no critico
#
# Si el disco del VPS muere, la copia local muere con el: por eso la de fuera
# sigue avisando, pero con su propio mensaje.

date +%s > "$MARCA_EXITO"
echo "$BYTES" > "$TAMANO_PREVIO"
registrar "Copia local lista y verificada"

# ─── 5 · Subir fuera y verificar ───────────────────────────────────────────

registrar "Subiendo a Google Drive..."

# ⚠ Reintentos y paso lento por el limite de Google. El error dice «Quota
# exceeded … consumer project_number:202264815644», y ese proyecto NO es
# nuestro: es el cliente COMPARTIDO que rclone trae de fabrica y que usa todo el
# mundo, por eso se agota. La solucion de verdad es un client_id propio —cinco
# minutos en la consola de Google Cloud, ver
# https://rclone.org/drive/#making-your-own-client-id— y esa la tiene que hacer
# el dueno con su cuenta. Esto solo aguanta mejor mientras tanto.
# `--drive-pacer-min-sleep` solo existe para Drive; con B2 sobra.
case "$REMOTO_FUERA" in
    gdrive:*|drive:*) RITMO_DRIVE="--drive-pacer-min-sleep 200ms" ;;
    *)                RITMO_DRIVE="" ;;
esac
SUBIDA_OK=0
if rclone copy "${BACKUP_DIR}/${ARCHIVO}" "$REMOTO_FUERA"        --stats-one-line --retries 5 --retries-sleep 60s        --low-level-retries 20 ${RITMO_DRIVE}        --timeout 10m 2>&1 | tee -a "$LOG"; then
    # ⚠ EL GRUPO DE CAPTURA DE ESTE SED SE PERDIO AL REESCRIBIR EL SCRIPT.
    #   Python interpreto la referencia como el byte de control 0x01 en vez de dejar
    #   las dos letras, asi que sed no veia una referencia: REMOTO salia VACIO
    #   y la verificacion habria fallado SIEMPRE, incluso con la cuota de
    #   Google ya arreglada. La marca de copia-fuera no se habria escrito
    #   nunca y el vigilante seguiria avisando sin motivo.
    #   Lo cace mirando los bytes del archivo (`od -c`), no ejecutandolo:
    #   en pantalla se veia igual que el original.
    REMOTO=$(rclone size "$REMOTO_FUERA/${ARCHIVO}" --json 2>/dev/null | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')
    if [ "${REMOTO:-0}" = "$PESO" ]; then
        registrar "Verificado en Drive: mismo tamaño"
        date +%s > "$MARCA_FUERA"
        SUBIDA_OK=1
    else
        registrar "En Drive pesa '${REMOTO:-nada}' y aqui ${PESO}"
    fi
else
    registrar "rclone no pudo subir (ver el error arriba)"
fi

# ⚠ NO se sale con error: la copia local esta hecha y verificada, y matar el
# script aqui es lo que borraba esa verdad durante siete noches.
[ "$SUBIDA_OK" = "1" ] || registrar "SIN COPIA FUERA — la local si esta. Avisa el vigilante."

# ─── 5 · Retencion ─────────────────────────────────────────────────────────
# La copia local se QUEDA. La version vieja la borraba, asi que la unica copia
# vivia en Drive: si caducaba la autorizacion, no quedaba nada.

find "$BACKUP_DIR" -name "cf-backup-*.gpg" -type f -mtime "+${RETENCION_LOCAL_DIAS}" -delete 2>/dev/null || true
rclone delete "$REMOTO_FUERA" --min-age "${RETENCION_DRIVE_DIAS}d" 2>/dev/null || true

LOCALES=$(find "$BACKUP_DIR" -name "cf-backup-*.gpg" -type f | wc -l)

# ─── 7 · Cierre ────────────────────────────────────────────────────────────
# La marca de exito ya se escribio arriba, en cuanto la copia local quedo
# verificada. Aqui no se vuelve a tocar.

registrar "═══ Listo: ${ARCHIVO} · ${LOCALES} copias locales ═══"
registrar ""
